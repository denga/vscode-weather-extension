import * as assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { WeatherClient, WeatherError, describeWeather } from '../weather';
import { berlinWeather } from './fixtures';

suite('Weather HTTP boundary', () => {
	let server: Server;
	let client: WeatherClient;
	let geocoding: unknown;
	let forecast: unknown;
	let statusCode: number;
	let requests: URL[];

	setup(async () => {
		geocoding = { results: [berlinWeather.location] };
		forecast = { timezone: berlinWeather.timezone, current: berlinWeather.current };
		statusCode = 200;
		requests = [];
		server = createServer((request, response) => {
			const url = new URL(request.url ?? '/', 'http://localhost');
			requests.push(url);
			response.writeHead(statusCode, { 'Content-Type': 'application/json' });
			response.end(JSON.stringify(url.pathname === '/search' ? geocoding : forecast));
		});
		await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
		const address = server.address();
		assert.ok(address && typeof address !== 'string');
		const base = `http://127.0.0.1:${address.port}`;
		client = new WeatherClient(`${base}/search`, `${base}/forecast`);
	});

	teardown(async () => {
		server.closeAllConnections();
		await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
	});

	test('resolves the city and requests metric conditions over HTTP', async () => {
		const weather = await client.load('München, DE', new AbortController().signal);
		assert.equal(weather.location.name, 'Berlin');
		assert.equal(weather.current.temperature_2m, 12.4);
		assert.equal(requests[0]?.searchParams.get('name'), 'München, DE');
		assert.equal(requests[0]?.searchParams.get('count'), '10');
		assert.equal(requests[0]?.searchParams.get('language'), process.env.WEATHER_TEST_LANGUAGE === 'de' ? 'de' : 'en');
		assert.equal(requests[1]?.searchParams.get('latitude'), '52.52');
		assert.equal(requests[1]?.searchParams.get('temperature_unit'), 'celsius');
		assert.equal(requests[1]?.searchParams.get('timeformat'), 'unixtime');
	});

	test('returns multiple candidates without fetching forecasts', async () => {
		geocoding = { results: [berlinWeather.location, { ...berlinWeather.location, country: 'United States', latitude: 44.47, longitude: -71.19 }] };
		const locations = await client.search('Berlin', new AbortController().signal);
		assert.equal(locations.length, 2);
		assert.equal(locations[1]?.latitude, 44.47);
		assert.equal(requests.length, 1);
	});

	test('loads the exact selected coordinates without geocoding again', async () => {
		const selected = { ...berlinWeather.location, latitude: 44.47, longitude: -71.19 };
		const weather = await client.load(selected, new AbortController().signal);
		assert.equal(weather.location.latitude, 44.47);
		assert.equal(requests.length, 1);
		assert.equal(requests[0]?.pathname, '/forecast');
		assert.equal(requests[0]?.searchParams.get('latitude'), '44.47');
		assert.equal(requests[0]?.searchParams.get('longitude'), '-71.19');
	});

	test('reports no match when geocoding returns no results', async () => {
		geocoding = {};
		await assert.rejects(client.load('unknown', new AbortController().signal), error => error instanceof WeatherError
			&& error.kind === 'not-found'
			&& error.message.startsWith(process.env.WEATHER_TEST_LANGUAGE === 'de' ? 'Ort nicht gefunden.' : 'Location not found.'));
	});

	test('rejects incomplete weather instead of displaying undefined values', async () => {
		forecast = { timezone: 'Europe/Berlin', current: { temperature_2m: null } };
		await assert.rejects(client.load('Berlin', new AbortController().signal), error => error instanceof WeatherError && error.kind === 'invalid-response');
	});

	test('rejects invalid coordinates before requesting weather', async () => {
		geocoding = { results: [{ ...berlinWeather.location, latitude: 100 }] };
		await assert.rejects(client.load('Berlin', new AbortController().signal), error => error instanceof WeatherError && error.kind === 'invalid-response');
		assert.equal(requests.length, 1);
	});

	test('rejects invalid timezones before rendering the tooltip', async () => {
		forecast = { ...berlinWeather, timezone: 'Invalid/Timezone' };
		await assert.rejects(client.load('Berlin', new AbortController().signal), error => error instanceof WeatherError && error.kind === 'invalid-response');
	});

	test('reports HTTP errors as an actionable network failure', async () => {
		statusCode = 400;
		await assert.rejects(client.load('Berlin', new AbortController().signal), error => error instanceof WeatherError && error.kind === 'network');
	});

	test('cancels a request when its signal is aborted', async () => {
		const controller = new AbortController();
		controller.abort();
		await assert.rejects(client.load('Berlin', controller.signal), error => error instanceof Error && error.name === 'AbortError');
	});

	test('distinguishes clear nights from sunny days and handles unknown WMO codes', () => {
		assert.notEqual(describeWeather(0, false).icon, describeWeather(0, true).icon);
		assert.notEqual(describeWeather(0, false).label, describeWeather(0, true).label);
		assert.equal(describeWeather(999, true).icon, '$(globe)');
	});
});
