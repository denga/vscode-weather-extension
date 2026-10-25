import * as vscode from 'vscode';
import { describeWeather } from './weather';
import type { Weather } from './weather';

type TooltipOptions = {
	readonly minutes: number;
	readonly stale?: { readonly message: string; readonly refreshedAt: number };
	readonly refreshing?: boolean;
};

export function weatherTooltip(weather: Weather, options: TooltipOptions): vscode.MarkdownString {
	const locale = vscode.env.language.toLowerCase().split('-')[0] === 'de' ? 'de-DE' : 'en-US';
	const formatTime = (time: number) => new Intl.DateTimeFormat(locale, {
		timeZone: weather.timezone, dateStyle: 'short', timeStyle: 'short',
	}).format(new Date(time));
	const tooltip = new vscode.MarkdownString();
	tooltip.supportThemeIcons = true;
	tooltip.isTrusted = { enabledCommands: ['weather.refresh', 'weather.chooseLocation'] };
	tooltip.appendMarkdown('### ');
	tooltip.appendText(weather.location.name);
	const region = [...new Set([weather.location.admin1, weather.location.country].filter(value => value && value !== weather.location.name))].join(', ');
	if (region) {
		tooltip.appendMarkdown('\n\n');
		tooltip.appendText(region);
	}
	tooltip.appendMarkdown('\n\n**');
	tooltip.appendText(`${Math.round(weather.current.temperature_2m)} °C`);
	tooltip.appendMarkdown('** · ');
	tooltip.appendText(describeWeather(weather.current.weather_code, weather.current.is_day === 1).label);
	if (options.stale) {
		tooltip.appendMarkdown('\n\n$(warning) **');
		tooltip.appendText(vscode.l10n.t('Data may be outdated'));
		tooltip.appendMarkdown('**\n\n');
		tooltip.appendText(options.stale.message);
		tooltip.appendMarkdown('  \n');
		tooltip.appendText(vscode.l10n.t('Last successful refresh: {0} ({1})', formatTime(options.stale.refreshedAt), weather.timezone));
	}
	if (options.refreshing) {
		tooltip.appendMarkdown('\n\n$(loading~spin) ');
		tooltip.appendText(vscode.l10n.t('Refreshing weather …'));
	}
	tooltip.appendMarkdown('\n\n---\n\n');
	tooltip.appendText(vscode.l10n.t('Feels like: {0} °C', weather.current.apparent_temperature.toLocaleString(locale)));
	tooltip.appendMarkdown('  \n');
	tooltip.appendText(vscode.l10n.t('Humidity: {0} %', weather.current.relative_humidity_2m.toLocaleString(locale)));
	tooltip.appendMarkdown('  \n');
	tooltip.appendText(vscode.l10n.t('Wind: {0} km/h', weather.current.wind_speed_10m.toLocaleString(locale)));
	tooltip.appendMarkdown('  \n');
	tooltip.appendText(vscode.l10n.t('Precipitation: {0} mm', weather.current.precipitation.toLocaleString(locale)));
	tooltip.appendMarkdown('\n\n---\n\n');
	tooltip.appendText(vscode.l10n.t('Observed: {0} ({1})', formatTime(weather.current.time * 1000), weather.timezone));
	tooltip.appendMarkdown('  \n');
	tooltip.appendText(vscode.l10n.t('Refresh every {0} min.', options.minutes.toLocaleString(locale)));
	tooltip.appendMarkdown(`\n\n[$(refresh) ${vscode.l10n.t('Refresh')}](command:weather.refresh) · [$(location) ${vscode.l10n.t('Choose location')}](command:weather.chooseLocation)`);
	tooltip.appendMarkdown('\n\n[Open-Meteo](https://open-meteo.com/) · [GeoNames](https://www.geonames.org/)');
	return tooltip;
}
