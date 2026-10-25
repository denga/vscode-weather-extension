import { defineConfig } from '@vscode/test-cli';

export const languageConfiguration = language => ({
	label: language,
	files: 'out/test/**/*.test.js',
	...(process.env.VSCODE_EXECUTABLE_PATH ? {
		useInstallation: { fromPath: process.env.VSCODE_EXECUTABLE_PATH }
	} : {}),
	launchArgs: ['--skip-welcome', '--skip-release-notes', '--disable-extensions', '--disable-gpu', `--locale=${language}`],
	env: { WEATHER_TEST_LANGUAGE: language },
	mocha: { timeout: 10_000 },
});

export default defineConfig(languageConfiguration('en'));
