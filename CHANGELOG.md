# Changelog

## 0.0.1 — 2026-10-25

### Weather and location selection

- Show current conditions for a configurable location in the VS Code status bar.
- Search for cities or postal codes and choose an exact result using its region, country, and coordinates.
- Remember selected coordinates across refreshes and VS Code restarts.
- Refresh automatically at a configurable interval or manually from the status bar, hover, or Command Palette.

### Weather details and connection handling

- Display temperature, weather conditions, feels-like temperature, humidity, wind, precipitation, and observation time on hover.
- Group hover details into current conditions, measurements, and freshness information, with direct refresh and location actions.
- Keep the last successful reading visible during refreshes and mark it as stale after network failures for the same location.
- Clear previous readings when the location changes or the service returns invalid data, and provide guidance for missing or unknown locations.

### Languages, documentation, and distribution

- Support English and German based on the VS Code display language, with English fallback.
- Localize commands, settings descriptions, status messages, weather conditions, tooltips, accessibility labels, number and date formats, and location search results.
- Provide English documentation with weather and location-search screenshots, VSIX packaging instructions, and manual installation steps.
- Run tests with GitHub Actions and attach VSIX packages to tagged GitHub releases after successful tests.
- License the extension and its documentation under MIT.
