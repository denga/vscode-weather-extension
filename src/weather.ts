import { z } from 'zod';
import { env, l10n } from 'vscode';

export const locationSchema = z.object({
	name: z.string().min(1),
	latitude: z.number().min(-90).max(90),
	longitude: z.number().min(-180).max(180),
	admin1: z.string().optional(),
	country: z.string().optional()
});
const geocodingSchema = z.object({ results: z.array(locationSchema).optional() });
const forecastSchema = z.object({
	timezone: z.string().refine(value => {
		try {
			new Intl.DateTimeFormat('en-US', { timeZone: value });
			return true;
		} catch (error) {
			if (error instanceof RangeError) {
				return false;
			}
			throw error;
		}
	}),
	current: z.object({
		time: z.number().int().min(0).max(8_640_000_000_000),
		temperature_2m: z.number(),
		apparent_temperature: z.number(),
		relative_humidity_2m: z.number().min(0).max(100),
		precipitation: z.number().min(0),
		weather_code: z.number().int(),
		wind_speed_10m: z.number().min(0),
		is_day: z.union([z.literal(0), z.literal(1)])
	})
});

export type Weather = Readonly<z.infer<typeof forecastSchema>> & {
	readonly location: Readonly<z.infer<typeof locationSchema>>;
};

export type WeatherLocation = Readonly<z.infer<typeof locationSchema>>;

export class WeatherError extends Error {
	constructor(readonly kind: 'not-found' | 'invalid-response' | 'network', message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'WeatherError';
	}
}

export class WeatherClient {
	constructor(
		private readonly geocodingUrl = 'https://geocoding-api.open-meteo.com/v1/search',
		private readonly forecastUrl = 'https://api.open-meteo.com/v1/forecast'
	) {}

	async search(location: string, signal: AbortSignal): Promise<readonly WeatherLocation[]> {
		const geocodingUrl = new URL(this.geocodingUrl);
		geocodingUrl.search = new URLSearchParams({ name: location, count: '10', language: env.language.toLowerCase().split('-')[0] === 'de' ? 'de' : 'en', format: 'json' }).toString();
		const geocoding = geocodingSchema.safeParse(await this.getJson(geocodingUrl, signal));
		if (!geocoding.success) {
			throw new WeatherError('invalid-response', l10n.t('The location search returned invalid data.'));
		}
		return geocoding.data.results ?? [];
	}

	async load(location: string | WeatherLocation, signal: AbortSignal): Promise<Weather> {
		const resolved = typeof location === 'string' ? (await this.search(location, signal))[0] : location;
		if (!resolved) {
			throw new WeatherError('not-found', l10n.t('Location not found. Please check the name and try adding a country (e.g. Freiburg, DE).'));
		}
		const forecastUrl = new URL(this.forecastUrl);
		forecastUrl.search = new URLSearchParams({
			latitude: String(resolved.latitude), longitude: String(resolved.longitude),
			current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day',
			temperature_unit: 'celsius', wind_speed_unit: 'kmh', precipitation_unit: 'mm',
			timezone: 'auto', timeformat: 'unixtime', forecast_days: '1'
		}).toString();
		const forecast = forecastSchema.safeParse(await this.getJson(forecastUrl, signal));
		if (!forecast.success) {
			throw new WeatherError('invalid-response', l10n.t('The weather service returned invalid or incomplete data.'));
		}
		return { ...forecast.data, location: resolved };
	}

	private async getJson(url: URL, signal: AbortSignal): Promise<unknown> {
		try {
			const { default: ky } = await import('ky');
			return await ky.get(url, { signal, timeout: 10_000, retry: 1 }).json<unknown>();
		} catch (error) {
			if (signal.aborted) {
				throw error;
			}
			throw new WeatherError('network', l10n.t('Weather service unreachable. Please check your network connection and try again.'), { cause: error });
		}
	}
}

export function describeWeather(code: number, isDay: boolean): { readonly label: string; readonly icon: string } {
	switch (code) {
		case 0: return { label: isDay ? l10n.t('Clear sky') : l10n.t('Clear night'), icon: isDay ? '☀︎' : '☾' };
		case 1: return { label: l10n.t('Mainly clear'), icon: isDay ? '☀︎' : '☾' };
		case 2: return { label: l10n.t('Partly cloudy'), icon: '$(cloud)' };
		case 3: return { label: l10n.t('Overcast'), icon: '$(cloud)' };
		case 45: case 48: return { label: l10n.t('Fog'), icon: '$(cloud)' };
		case 51: case 53: case 55: return { label: l10n.t('Drizzle'), icon: '$(cloud)' };
		case 56: case 57: return { label: l10n.t('Freezing drizzle'), icon: '$(cloud)' };
		case 61: case 63: case 65: return { label: l10n.t('Rain'), icon: '$(cloud)' };
		case 66: case 67: return { label: l10n.t('Freezing rain'), icon: '$(cloud)' };
		case 71: case 73: case 75: case 77: return { label: l10n.t('Snow'), icon: '$(cloud)' };
		case 80: case 81: case 82: return { label: l10n.t('Rain showers'), icon: '$(cloud)' };
		case 85: case 86: return { label: l10n.t('Snow showers'), icon: '$(cloud)' };
		case 95: case 96: case 99: return { label: l10n.t('Thunderstorm'), icon: '$(zap)' };
		default: return { label: l10n.t('Unknown weather conditions'), icon: '$(globe)' };
	}
}
