import * as assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import * as vscode from 'vscode';
import { WeatherStatusBar } from '../extension';
import { WeatherError } from '../weather';
import type { Weather } from '../weather';
import { berlinWeather } from './fixtures';

suiteSetup(async () => {
	const extension = vscode.extensions.all.find(candidate => candidate.id.endsWith('.weather'));
	assert.ok(extension);
	await extension.activate();
});

suite('Native weather status bar', () => {
	const german = process.env.WEATHER_TEST_LANGUAGE === 'de';
	let status: WeatherStatusBar | undefined;
	let originalLocation: string | undefined;

	setup(async () => {
		originalLocation = vscode.workspace.getConfiguration('weather').inspect<string>('location')?.globalValue;
		await vscode.workspace.getConfiguration('weather').update('location', 'Berlin', vscode.ConfigurationTarget.Global);
	});

	teardown(async () => {
		status?.dispose();
		status = undefined;
		await vscode.workspace.getConfiguration('weather').update('location', originalLocation, vscode.ConfigurationTarget.Global);
	});

	test('shows current conditions and a hover with restricted actions when weather loads', async () => {
		status = new WeatherStatusBar(async () => berlinWeather);
		await status.refresh();
		assert.match(status.item.text, /Berlin: 12 °C/);
		const tooltip = status.item.tooltip;
		assert.ok(tooltip instanceof vscode.MarkdownString);
		const text = tooltip.value.replaceAll('&nbsp;', ' ');
		assert.match(text, /72 %/);
		assert.ok(text.includes(german ? '14,5 km/h' : '14.5 km/h'));
		assert.ok(text.includes(german ? 'Niederschlag: 0,2 mm' : 'Precipitation: 0.2 mm'));
		assert.ok(text.includes(german ? 'Gefühlt: 10,1 °C' : 'Feels like: 10.1 °C'));
		assert.ok(text.includes(german ? 'Bedeckt' : 'Overcast'));
		assert.ok(text.includes(german ? '24.10.26, 21:45' : '10/24/26, 9:45 PM'));
		assert.ok(status.item.accessibilityInformation?.label.includes(german ? 'Wetter in Berlin' : 'Weather in Berlin'));
		assert.deepEqual(tooltip.isTrusted, { enabledCommands: ['weather.refresh', 'weather.chooseLocation'] });
	});

	test('offers location search without fetching when location is empty', async () => {
		await vscode.workspace.getConfiguration('weather').update('location', '   ', vscode.ConfigurationTarget.Global);
		status = new WeatherStatusBar(async () => assert.fail('Empty location must not send a request'));
		await status.refresh();
		assert.equal(status.item.command, 'weather.chooseLocation');
		assert.ok(status.item.text.includes(german ? 'Ort festlegen' : 'Set location'));
	});

	test('uses the requested display language in the real extension host', () => {
		assert.equal(vscode.env.language, process.env.WEATHER_TEST_LANGUAGE);
	});

	test('localizes loading and unexpected failure messages', async () => {
		const pending = Promise.withResolvers<Weather>();
		status = new WeatherStatusBar(async () => pending.promise);
		const refresh = status.refresh();
		assert.equal(status.item.tooltip, german ? 'Wetter für Berlin wird geladen …' : 'Loading weather for Berlin …');
		pending.reject(new Error('Unexpected failure'));
		await refresh;
		assert.equal(status.item.text, german ? '$(warning) Wetter nicht verfügbar' : '$(warning) Weather unavailable');
		assert.ok(String(status.item.tooltip).includes(german ? 'Netzwerkverbindung prüfen' : 'check your network connection'));
		assert.ok(status.item.accessibilityInformation?.label.includes(german ? 'Wetter für Berlin nicht verfügbar' : 'Weather for Berlin unavailable'));
	});

	test('refreshes automatically when the configured city changes', async () => {
		status = new WeatherStatusBar(async location => ({ ...berlinWeather, location: { ...berlinWeather.location, name: location } }));
		await status.refresh();
		await vscode.workspace.getConfiguration('weather').update('location', 'Hamburg', vscode.ConfigurationTarget.Global);
		await setImmediate();
		assert.match(status.item.text, /Hamburg: 12 °C/);
	});

	test('offers configuration instead of crashing when location has an invalid type', async () => {
		await vscode.workspace.getConfiguration('weather').update('location', 42, vscode.ConfigurationTarget.Global);
		status = new WeatherStatusBar(async () => assert.fail('Invalid location must not send a request'));
		await status.refresh();
		assert.equal(status.item.command, 'weather.chooseLocation');
	});

	test('discards a late response when a newer refresh already completed', async () => {
		const pending = Promise.withResolvers<Weather>();
		let first = true;
		let oldSignal: AbortSignal | undefined;
		status = new WeatherStatusBar(async (_location, signal) => {
			if (first) {
				first = false;
				oldSignal = signal;
				return pending.promise;
			}
			return { ...berlinWeather, location: { ...berlinWeather.location, name: 'Hamburg' } };
		});
		const oldRefresh = status.refresh();
		await status.refresh();
		pending.resolve(berlinWeather);
		await oldRefresh;
		assert.equal(oldSignal?.aborted, true);
		assert.match(status.item.text, /Hamburg/);
	});

	test('removes previous weather when the next request fails', async () => {
		let fail = false;
		status = new WeatherStatusBar(async () => {
			if (fail) {
				throw new WeatherError('not-found', 'Ort nicht gefunden.');
			}
			return berlinWeather;
		});
		await status.refresh();
		fail = true;
		await status.refresh();
		assert.doesNotMatch(status.item.text, /12 °C/);
		assert.match(String(status.item.tooltip), /Ort nicht gefunden/);
	});

	test('aborts pending work when disposed', async () => {
		const pending = Promise.withResolvers<Weather>();
		let activeSignal: AbortSignal | undefined;
		status = new WeatherStatusBar(async (_location, signal) => {
			activeSignal = signal;
			return pending.promise;
		});
		const refresh = status.refresh();
		status.dispose();
		pending.resolve(berlinWeather);
		await refresh;
		assert.equal(activeSignal?.aborted, true);
	});

	test('registers refresh and settings commands on activation', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('weather.refresh'));
		assert.ok(commands.includes('weather.openSettings'));
		assert.ok(commands.includes('weather.chooseLocation'));
	});
});
