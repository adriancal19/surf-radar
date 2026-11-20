// Fetches Open-Meteo data and converts it to the common format the pipeline uses:
//
//   {
//     times: ['2026-11-06T00:00', ...],
//     models: { meteofrance_wave: { waveHeightFt: [...], wavePeriodS: [...], swellDirectionDeg: [...], ... } },
//     wind: { speedMph: [...], directionDeg: [...] } or null if wind couldn't be loaded,
//   }
//
// One of these per spot, in the same order as the spots list. A new data source only
// needs to produce this same format.

const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

// The whole sea, then its parts: wind chop and up to three swells. Directions are where the
// waves come from. Not every model splits the sea; ECMWF gives only the totals, and the
// others report an absent part as 0 ft.
const PARTS = {
  wave: 'wave',
  windWave: 'wind_wave',
  swell: 'swell_wave',
  secondarySwell: 'secondary_swell_wave',
  tertiarySwell: 'tertiary_swell_wave',
};
const MARINE_FIELDS = Object.fromEntries(
  Object.entries(PARTS).flatMap(([prefix, api]) => [
    [`${prefix}HeightFt`, `${api}_height`],
    [`${prefix}PeriodS`, `${api}_period`],
    [`${prefix}DirectionDeg`, `${api}_direction`],
  ]),
);

function locationParams(spots, settings) {
  return {
    latitude: spots.map((spot) => spot.lat).join(','),
    longitude: spots.map((spot) => spot.lon).join(','),
    forecast_days: settings.forecastDays,
    timezone: settings.timezone,
  };
}

async function getJson(baseUrl, params) {
  const response = await fetch(`${baseUrl}?${new URLSearchParams(params)}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.reason || `Open-Meteo returned status ${response.status}`);
  }
  return response.json();
}

// Open-Meteo returns a plain object for one location and a list for several.
const asList = (json) => (Array.isArray(json) ? json : [json]);

// With one model, fields are named `wave_height`. With several, `wave_height_<model>`.
export function parseMarineLocation(location, modelIds) {
  const hourly = location.hourly;
  const models = {};
  for (const modelId of modelIds) {
    models[modelId] = {};
    for (const [name, apiField] of Object.entries(MARINE_FIELDS)) {
      const key = modelIds.length === 1 ? apiField : `${apiField}_${modelId}`;
      models[modelId][name] = hourly[key] ?? hourly.time.map(() => null);
    }
    // Some models report a part that isn't there as 0 ft at 0 s. Left in, those zeros would
    // drag down the averages of the models that do see it, so they become missing values.
    for (const prefix of Object.keys(PARTS).filter((part) => part !== 'wave')) {
      const heights = models[modelId][`${prefix}HeightFt`];
      const absent = (index) => !(heights[index] > 0);
      for (const field of [`${prefix}HeightFt`, `${prefix}PeriodS`, `${prefix}DirectionDeg`]) {
        models[modelId][field] = models[modelId][field].map((value, index) => (absent(index) ? null : value));
      }
    }
  }
  return { times: hourly.time, models };
}

// Lines wind up with the marine hours by timestamp.
export function parseWindLocation(location, times) {
  const hourly = location.hourly;
  const indexByTime = new Map(hourly.time.map((time, index) => [time, index]));
  const pick = (values) => times.map((time) => values[indexByTime.get(time)] ?? null);
  return {
    speedMph: pick(hourly.wind_speed_10m),
    directionDeg: pick(hourly.wind_direction_10m),
  };
}

// Wave models only, for any list of points with lat and lon.
export async function fetchMarine(points, settings) {
  const modelIds = settings.models.map((model) => model.id);
  const json = await getJson(MARINE_URL, {
    ...locationParams(points, settings),
    hourly: Object.values(MARINE_FIELDS).join(','),
    models: modelIds.join(','),
    length_unit: 'imperial',
  });
  return asList(json).map((location) => parseMarineLocation(location, modelIds));
}

export async function fetchOpenMeteo(spots, settings) {
  const marineRequest = fetchMarine(spots, settings);

  // Wind is display-only, so a wind failure shouldn't take down the whole forecast.
  const windRequest = getJson(WEATHER_URL, {
    ...locationParams(spots, settings),
    hourly: 'wind_speed_10m,wind_direction_10m',
    wind_speed_unit: 'mph',
  }).catch((error) => {
    console.warn('Wind data unavailable:', error);
    return null;
  });

  const [marine, windJson] = await Promise.all([marineRequest, windRequest]);
  const wind = windJson && asList(windJson);

  return marine.map((parsed, index) => ({
    ...parsed,
    wind: wind ? parseWindLocation(wind[index], parsed.times) : null,
  }));
}

// The forecasts each model made 1, 3 and 5 days before every hour of the last month, at
// each point. One response per point, in the same order, for the track record (track.js).
export async function fetchPreviousRuns(points, settings, fields) {
  const json = await getJson(MARINE_URL, {
    latitude: points.map((point) => point.lat).join(','),
    longitude: points.map((point) => point.lon).join(','),
    hourly: fields.join(','),
    models: settings.models.map((model) => model.id).join(','),
    past_days: 31,
    forecast_days: 1,
    timezone: settings.timezone,
    length_unit: 'imperial',
  });
  return asList(json);
}
