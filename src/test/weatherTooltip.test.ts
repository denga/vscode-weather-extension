import * as assert from 'node:assert/strict';
import { weatherTooltip } from '../weatherTooltip';
import { berlinWeather } from './fixtures';

suite('Weather hover actions', () => {
	test('escapes location markup while allowing only the two weather actions', () => {
		const weather = { ...berlinWeather, location: { ...berlinWeather.location, name: '[Click](command:workbench.action.closeWindow)' } };
		const tooltip = weatherTooltip(weather, { minutes: 15 });
		assert.deepEqual(tooltip.isTrusted, { enabledCommands: ['weather.refresh', 'weather.chooseLocation'] });
		assert.ok(tooltip.value.includes('\\[Click\\]'));
		assert.ok(!tooltip.value.includes('[Click](command:workbench.action.closeWindow)'));
		assert.match(tooltip.value, /\]\(command:weather\.chooseLocation\)/);
		assert.match(tooltip.value, /\]\(command:weather\.refresh\)/);
	});
});
