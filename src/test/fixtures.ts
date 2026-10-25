import type { Weather } from '../weather';

export const berlinWeather: Weather = {
	location: { name: 'Berlin', latitude: 52.52, longitude: 13.41, country: 'Deutschland', admin1: 'Berlin' },
	timezone: 'Europe/Berlin',
	current: {
		time: 1_792_871_100, temperature_2m: 12.4, apparent_temperature: 10.1,
		relative_humidity_2m: 72, precipitation: 0.2, weather_code: 3, wind_speed_10m: 14.5, is_day: 1
	}
};
