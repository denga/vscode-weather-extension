import { defineConfig } from '@vscode/test-cli';
import { languageConfiguration } from './.vscode-test.mjs';

export default defineConfig(['en', 'de', 'fr'].map((language, index) => ({
	...languageConfiguration(language),
	installExtensions: index === 0 ? [
		'MS-CEINTL.vscode-language-pack-de',
		'MS-CEINTL.vscode-language-pack-fr',
	] : [],
})));
