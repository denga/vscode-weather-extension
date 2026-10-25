# Weather extension development guide

## Project structure

- `package.json`: extension manifest, commands, settings, and build scripts.
- `package.nls.json` and `package.nls.de.json`: English and German manifest strings.
- `l10n/`: English source messages and German runtime translations.
- `src/extension.ts`: status bar, tooltips, configuration changes, and commands.
- `src/weather.ts`: weather requests, response validation, and condition descriptions.
- `src/locationPicker.ts`: native location search and saved coordinate selection.
- `src/weatherTooltip.ts`: weather details, freshness notices, and hover actions.
- `src/test/`: extension-host tests and local HTTP fixtures.

## Run and debug

1. Run `npm install` and `npm run compile`.
2. Press **F5** to start the **Run Extension** configuration.
3. In the Extension Development Host, run **Weather: Choose location** from
   the Command Palette, search for `Berlin`, and select the intended result.
4. Hover over the weather status bar item to inspect the details, or click it
   to refresh. Set breakpoints in `src/extension.ts` or `src/weather.ts`.

Use the debug toolbar to relaunch after code changes. Run `npm run watch` for
continuous compilation.

## Package and install locally

Follow [Create a VSIX package](README.md#create-a-vsix-package) for prerequisites,
publisher metadata, and the packaging command. Packaging runs the compilation
step automatically and produces `weather.vsix`.

Use [Manual installation](README.md#manual-installation) to install the package
through the VS Code interface or the `code` command, configure a location, and
install later updates. This lets you test the installed extension in a regular
VS Code window in addition to the Extension Development Host.

## Localization

Use English source messages with `vscode.l10n.t` and add matching entries to
`l10n/bundle.l10n.json` and `l10n/bundle.l10n.de.json`. Keep placeholders such
as `{0}` intact in translations. Manifest strings use `%key%` references to
`package.nls.json` and `package.nls.de.json`.

To check the UI manually, use **Configure Display Language** to select English
or German and restart VS Code. The extension uses English for other languages.

## Verify changes

- `npm run compile`: check types and compile.
- `npm run lint`: check code style.
- `npm test`: run the extension-host tests in the default language.
- `npm run test:languages`: run the tests in English, German, and French
  (to verify the English fallback).

The tests use a local HTTP server for weather responses. They do not require
access to Open-Meteo. The test runner downloads VS Code unless
`VSCODE_EXECUTABLE_PATH` points to an existing executable.
