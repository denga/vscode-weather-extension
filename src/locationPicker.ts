import * as vscode from 'vscode';
import { locationSchema, WeatherClient } from './weather';
import type { Weather, WeatherLocation } from './weather';

const selectionSchema = locationSchema.extend({ query: locationSchema.shape.name });
type LocationItem = vscode.QuickPickItem & { readonly location?: WeatherLocation };

export class WeatherLocationPicker implements vscode.Disposable {
	private picker: vscode.QuickPick<LocationItem> | undefined;

	constructor(private readonly state: vscode.Memento, private readonly client = new WeatherClient()) {}

	load(query: string, signal: AbortSignal): Promise<Weather> {
		const selection = selectionSchema.safeParse(this.state.get<unknown>(`weather.selectedLocation.${query}`));
		return this.client.load(selection.success && selection.data.query === query ? selection.data : query, signal);
	}

	choose(): Promise<boolean> {
		this.picker?.hide();
		const picker = vscode.window.createQuickPick<LocationItem>();
		this.picker = picker;
		picker.title = vscode.l10n.t('Weather: Choose location');
		picker.placeholder = vscode.l10n.t('Type a city or postal code (at least 2 characters)');
		picker.matchOnDescription = true;
		let request: AbortController | undefined;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let saved = false;
		let saving = false;
		return new Promise(resolve => {
			picker.onDidChangeValue(value => {
				clearTimeout(timer);
				request?.abort();
				picker.items = [];
				picker.busy = false;
				if (value.trim().length < 2) {
					return;
				}
				const current = new AbortController();
				request = current;
				timer = setTimeout(() => {
					picker.busy = true;
					void this.client.search(value.trim(), current.signal).then(locations => {
						if (current.signal.aborted) {
							return;
						}
						picker.items = locations.length ? locations.map(location => ({
							label: location.name,
							description: [location.admin1, location.country].filter(Boolean).join(', '),
							detail: vscode.l10n.t('Coordinates: {0}, {1}', location.latitude, location.longitude),
							location,
							alwaysShow: true,
						})) : [{ label: vscode.l10n.t('No locations found. Try another city or add a country.'), alwaysShow: true }];
					}).catch((error: unknown) => {
						if (!current.signal.aborted) {
							picker.items = [{ label: vscode.l10n.t('Location search failed. Change the search to retry.'),
								detail: error instanceof Error ? error.message : undefined, alwaysShow: true }];
						}
					}).finally(() => {
						if (!current.signal.aborted) {
							picker.busy = false;
						}
					});
				}, 300);
			});
			picker.onDidAccept(async () => {
				const location = picker.selectedItems[0]?.location;
				if (!location || saving) {
					return;
				}
				saving = true;
				picker.enabled = false;
				const query = [...new Set([location.name, location.admin1, location.country].filter(Boolean))].join(', ');
				const key = `weather.selectedLocation.${query}`;
				const previousSelection = this.state.get<unknown>(key);
				try {
					await this.state.update(key, { ...location, query });
					const config = vscode.workspace.getConfiguration('weather');
					const target = config.inspect<string>('location')?.workspaceFolderValue !== undefined
						? vscode.ConfigurationTarget.WorkspaceFolder
						: config.inspect<string>('location')?.workspaceValue !== undefined
							? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
					await config.update('location', query, target);
					saved = true;
					picker.hide();
				} catch (error) {
					await this.state.update(key, previousSelection);
					picker.items = [{ label: vscode.l10n.t('Could not save the location. Please try again.'),
						detail: error instanceof Error ? error.message : undefined, alwaysShow: true }];
					picker.enabled = true;
					saving = false;
				}
			});
			picker.onDidHide(() => {
				clearTimeout(timer);
				request?.abort();
				picker.dispose();
				this.picker = undefined;
				resolve(saved);
			});
			picker.show();
		});
	}

	dispose(): void {
		this.picker?.hide();
	}
}
