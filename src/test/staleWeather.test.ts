import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { WeatherStatusBar } from '../extension';
import { WeatherError } from '../weather';
import { berlinWeather } from './fixtures';
import type { Weather } from '../weather';

suite('Last successful weather', () => {
	const german = process.env.WEATHER_TEST_LANGUAGE === 'de';
	let status: WeatherStatusBar | undefined;
	let originalLocation: string | undefined;
	let failure: WeatherError | undefined;

	setup(async () => {
		originalLocation = vscode.workspace.getConfiguration('weather').inspect<string>('location')?.globalValue;
		await vscode.workspace.getConfiguration('weather').update('location', 'Berlin', vscode.ConfigurationTarget.Global);
		failure = undefined;
		status = new WeatherStatusBar(async () => {
			if (failure) {
				throw failure;
			}
			return berlinWeather;
		});
		await status.refresh();
	});

	teardown(async () => {
		status?.dispose();
		await vscode.workspace.getConfiguration('weather').update('location', originalLocation, vscode.ConfigurationTarget.Global);
	});

	test('retains weather with an explicit freshness warning after network failure', async () => {
		failure = new WeatherError('network', 'Connection failed');
		await status?.refresh();
		assert.equal(status?.item.text, german ? '$(warning) Berlin: 12 °C · Veraltet' : '$(warning) Berlin: 12 °C · Stale');
		const tooltip = status?.item.tooltip;
		assert.ok(tooltip instanceof vscode.MarkdownString);
		const text = tooltip.value.replaceAll('&nbsp;', ' ');
		assert.ok(text.includes(german ? 'Letzte erfolgreiche Aktualisierung:' : 'Last successful refresh:'));
		assert.ok(text.includes(german ? 'Daten möglicherweise veraltet' : 'Data may be outdated'));
		assert.match(text, /Connection failed/);
		assert.ok(status?.item.accessibilityInformation?.label.includes(german ? 'Veraltetes Wetter' : 'Outdated weather'));
	});

	test('clears stale state after a successful retry', async () => {
		failure = new WeatherError('network', 'Connection failed');
		await status?.refresh();
		failure = undefined;
		await status?.refresh();
		assert.equal(status?.item.text, '$(cloud) Berlin: 12 °C');
		const tooltip = status?.item.tooltip;
		assert.ok(tooltip instanceof vscode.MarkdownString);
		assert.doesNotMatch(tooltip.value, /Connection.failed/);
	});

	test('does not reuse weather from another configured city', async () => {
		failure = new WeatherError('network', 'Connection failed');
		await vscode.workspace.getConfiguration('weather').update('location', 'Hamburg', vscode.ConfigurationTarget.Global);
		await status?.refresh();
		assert.doesNotMatch(status?.item.text ?? '', /Berlin|12 °C/);
		assert.match(String(status?.item.tooltip), /Hamburg/);
	});

	test('clears cached weather when location is removed', async () => {
		await vscode.workspace.getConfiguration('weather').update('location', '', vscode.ConfigurationTarget.Global);
		await status?.refresh();
		assert.equal(status?.item.command, 'weather.chooseLocation');
		assert.doesNotMatch(status?.item.text ?? '', /12 °C/);
	});

	test('does not retain weather after an invalid service response', async () => {
		failure = new WeatherError('invalid-response', 'Invalid response');
		await status?.refresh();
		assert.doesNotMatch(status?.item.text ?? '', /12 °C/);
	});

	test('invalidates cache when a different search result has the same display name', async () => {
		failure = new WeatherError('network', 'Connection failed');
		await status?.refresh(true);
		assert.doesNotMatch(status?.item.text ?? '', /12 °C/);
	});

	test('keeps the last reading visible while refreshing', async () => {
		status?.dispose();
		const pending = Promise.withResolvers<Weather>();
		let initial = true;
		status = new WeatherStatusBar(async () => {
			if (initial) {
				initial = false;
				return berlinWeather;
			}
			return pending.promise;
		});
		await status.refresh();
		const refresh = status.refresh();
		assert.match(status.item.text, /Berlin: 12 °C/);
		const tooltip = status.item.tooltip;
		assert.ok(tooltip instanceof vscode.MarkdownString);
		assert.match(tooltip.value, /loading~spin/);
		pending.resolve(berlinWeather);
		await refresh;
	});
});
