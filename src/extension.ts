import * as vscode from 'vscode';
import { WeatherClient, WeatherError, describeWeather } from './weather';
import type { Weather } from './weather';
import { weatherTooltip } from './weatherTooltip';
import { WeatherLocationPicker } from './locationPicker';

type LoadWeather = (location: string, signal: AbortSignal) => Promise<Weather>;

export class WeatherStatusBar implements vscode.Disposable {
	readonly item = vscode.window.createStatusBarItem('weather.current', vscode.StatusBarAlignment.Right, 100);
	private request: AbortController | undefined;
	private timer: ReturnType<typeof setInterval> | undefined;
	private disposed = false;
	private lastSuccess: { readonly query: string; readonly weather: Weather; readonly refreshedAt: number } | undefined;
	private staleMessage: string | undefined;
	private readonly configurationListener: vscode.Disposable;

	constructor(private readonly loadWeather: LoadWeather = (location, signal) => new WeatherClient().load(location, signal)) {
		this.item.name = vscode.l10n.t('Weather');
		this.item.command = 'weather.refresh';
		this.configurationListener = vscode.workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration('weather')) {
				void this.refresh();
			}
		});
	}

	async refresh(reset = false): Promise<void> {
		if (this.disposed) {
			return;
		}
		this.request?.abort();
		clearInterval(this.timer);
		const request = new AbortController();
		this.request = request;
		const config = vscode.workspace.getConfiguration('weather');
		const configuredLocation = config.get<unknown>('location');
		const location = typeof configuredLocation === 'string' ? configuredLocation.trim() : '';
		const configuredInterval = config.get<unknown>('refreshInterval');
		const minutes = typeof configuredInterval === 'number' && Number.isFinite(configuredInterval)
			? Math.min(120, Math.max(5, configuredInterval)) : 15;
		if (reset || this.lastSuccess?.query !== location) {
			this.lastSuccess = undefined;
			this.staleMessage = undefined;
		}
		this.item.backgroundColor = undefined;
		this.item.command = 'weather.refresh';
		this.item.show();
		if (!location) {
			this.item.text = `$(globe) ${vscode.l10n.t('Weather: Set location')}`;
			this.item.tooltip = vscode.l10n.t('Click to search for a city and choose a location.');
			this.item.command = 'weather.chooseLocation';
			this.item.accessibilityInformation = { label: vscode.l10n.t('Weather: Choose a location to get started.') };
			return;
		}
		this.timer = setInterval(() => void this.refresh(), minutes * 60_000);
		if (this.lastSuccess) {
			this.item.tooltip = weatherTooltip(this.lastSuccess.weather, {
				minutes, refreshing: true,
				stale: this.staleMessage ? { message: this.staleMessage, refreshedAt: this.lastSuccess.refreshedAt } : undefined,
			});
		} else {
			this.item.text = `$(loading~spin) ${vscode.l10n.t('Weather')}`;
			this.item.tooltip = vscode.l10n.t('Loading weather for {0} …', location);
			this.item.accessibilityInformation = { label: vscode.l10n.t('Loading weather for {0}.', location) };
		}
		try {
			const weather = await this.loadWeather(location, request.signal);
			if (request.signal.aborted || this.disposed) {
				return;
			}
			const condition = describeWeather(weather.current.weather_code, weather.current.is_day === 1);
			const temperature = `${Math.round(weather.current.temperature_2m)} °C`;
			this.item.text = `${condition.icon} ${weather.location.name}: ${temperature}`;
			this.item.accessibilityInformation = { label: vscode.l10n.t('Weather in {0}: {1}, {2}', weather.location.name, temperature, condition.label) };
			this.lastSuccess = { query: location, weather, refreshedAt: Date.now() };
			this.staleMessage = undefined;
			this.item.tooltip = weatherTooltip(weather, { minutes });
		} catch (error) {
			if (request.signal.aborted || this.disposed) {
				return;
			}
			const message = error instanceof WeatherError ? error.message : vscode.l10n.t('Could not load weather data. Please check your network connection and try again.');
			if (error instanceof WeatherError && error.kind === 'network' && this.lastSuccess) {
				this.staleMessage = message;
				const previous = this.lastSuccess.weather;
				const temperature = `${Math.round(previous.current.temperature_2m)} °C`;
				this.item.text = `$(warning) ${previous.location.name}: ${temperature} · ${vscode.l10n.t('Stale')}`;
				this.item.tooltip = weatherTooltip(previous, { minutes, stale: { message, refreshedAt: this.lastSuccess.refreshedAt } });
				this.item.accessibilityInformation = { label: vscode.l10n.t('Outdated weather for {0}: {1}. {2}', previous.location.name, temperature, message) };
				return;
			}
			this.lastSuccess = undefined;
			this.staleMessage = undefined;
			this.item.text = `$(warning) ${vscode.l10n.t('Weather unavailable')}`;
			this.item.tooltip = `${location}: ${message}\n${vscode.l10n.t('Click to retry. To change location, run Weather: Choose location.')}`;
			this.item.accessibilityInformation = { label: vscode.l10n.t('Weather for {0} unavailable. {1}', location, message) };
		}
	}

	dispose(): void {
		this.disposed = true;
		this.request?.abort();
		clearInterval(this.timer);
		this.configurationListener.dispose();
		this.item.dispose();
	}
}

export function activate(context: vscode.ExtensionContext): void {
	const locations = new WeatherLocationPicker(context.globalState);
	const weather = new WeatherStatusBar((query, signal) => locations.load(query, signal));
	context.subscriptions.push(
		weather,
		locations,
		vscode.commands.registerCommand('weather.refresh', () => weather.refresh()),
		vscode.commands.registerCommand('weather.chooseLocation', async () => {
			if (await locations.choose()) {
				await weather.refresh(true);
			}
		}),
		vscode.commands.registerCommand('weather.openSettings', () => vscode.commands.executeCommand('workbench.action.openSettings', 'weather.location'))
	);
	void weather.refresh();
}
