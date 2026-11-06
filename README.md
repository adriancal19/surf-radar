# Surf Radar

A free surf forecast for Florida's east coast, from Cocoa Beach to South Beach. Each spot gets a 1–5 rating and a 7-day forecast with confidence labels.

## Run it

The page uses JavaScript modules, which browsers won't load from a file opened directly, so it needs a small local server:

1. Install the **Live Server** extension in VS Code.
2. Open this folder in VS Code, right-click `index.html`, and choose **Open with Live Server**.

To run the tests, open `tests/tests.html` the same way.

## Change the settings

- `settings.js`: rating preferences, morning and midday windows, wave models, confidence rules.
- `spots.js`: spot names and forecast coordinates.

## How the rating works

Wave height drives the score, and swell period moves it up or down by up to 1 point. Each day's score is 75% morning (6–10 am) and 25% midday (10 am–2 pm). Wind is shown for information but doesn't affect the rating.

## Known limitation

The wave model has no data close to most of this coast, so forecast points are usually 12–22 km offshore, though a few are much closer. Heights are modeled rather than measured at the beach, and comparisons between spots at different distances from shore can be misleading. Ratings will be tuned against real sessions over time.

## Data

Weather and marine data by [Open-Meteo.com](https://open-meteo.com/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The free data source is for non-commercial use only.
