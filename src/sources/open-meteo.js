// Fetches Open-Meteo data and converts it to the common format the pipeline uses:
//
//   {
//     times: ['2026-11-06T00:00', ...],
//     models: { meteofrance_wave: { waveHeightFt: [...], swellPeriodS: [...], wavePeriodS: [...] } },
//     wind: { speedMph: [...], directionDeg: [...] } or null if wind couldn't be loaded,
//   }
//
// One of these per spot, in the same order as the spots list. A new data source only
// needs to produce this same format.

const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

const MARINE_FIELDS = {
  waveHeightFt: 'wave_height',
  swellPeriodS: 'swell_wave_period',
  wavePeriodS: 'wave_period',
};

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

export async function fetchOpenMeteo(spots, settings) {
  const modelIds = settings.models.map((model) => model.id);

  const marineRequest = getJson(MARINE_URL, {
    ...locationParams(spots, settings),
    hourly: Object.values(MARINE_FIELDS).join(','),
    models: modelIds.join(','),
    length_unit: 'imperial',
  });

  // Wind is display-only, so a wind failure shouldn't take down the whole forecast.
  const windRequest = getJson(WEATHER_URL, {
    ...locationParams(spots, settings),
    hourly: 'wind_speed_10m,wind_direction_10m',
    wind_speed_unit: 'mph',
  }).catch((error) => {
    console.warn('Wind data unavailable:', error);
    return null;
  });

  const [marineJson, windJson] = await Promise.all([marineRequest, windRequest]);
  const marine = asList(marineJson);
  const wind = windJson && asList(windJson);

  return spots.map((_, index) => {
    const parsed = parseMarineLocation(marine[index], modelIds);
    return {
      ...parsed,
      wind: wind ? parseWindLocation(wind[index], parsed.times) : null,
    };
  });
}
