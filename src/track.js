// The track record: how far off the wave forecast was, against what NOAA buoys measured.
//
// Open-Meteo keeps the forecast each model made 1, 3 and 5 days before every hour of the
// last month, so this compares what the forecast really said back then, not hindsight. The
// buoys measure the offshore sea, so this checks the offshore forecast; the surf estimate
// built on it is checked against cams instead.
// No page drawing here, so it's easy to test.

import { blendValues } from './blend.js';
import { localHourKey } from './pipeline.js';

export const LEADS = [1, 3, 5];

// Daytime only, matching the hours the site rates.
const FIRST_HOUR = 6;
const LAST_HOUR = 18;

const inDaytime = (hourKey) => {
  const hour = Number(hourKey.slice(11, 13));
  return hour >= FIRST_HOUR && hour < LAST_HOUR;
};

// Buoy readings (newest first, UTC times) → { 'YYYY-MM-DD': { ft, count } } of daytime
// averages in local time, for the last `days` days.
export function dailyAverages(readings, timezone, days = 31) {
  const sums = {};
  for (const reading of readings) {
    if (!Number.isFinite(reading.waveHeightFt)) continue;
    const key = localHourKey(new Date(reading.time), timezone);
    if (!inDaytime(key)) continue;
    const date = key.slice(0, 10);
    sums[date] ??= { total: 0, count: 0 };
    sums[date].total += reading.waveHeightFt;
    sums[date].count += 1;
  }
  const dates = Object.keys(sums).sort().slice(-days);
  return Object.fromEntries(
    dates.map((date) => [date, { ft: sums[date].total / sums[date].count, count: sums[date].count }]),
  );
}

// The marine fields to ask for, one per lead: wave_height_previous_day1 and so on.
export const previousRunFields = () => LEADS.map((lead) => `wave_height_previous_day${lead}`);

// One location's response → { lead: { date: blended daytime forecast in ft } }. Each hour
// takes the middle model, then each day averages its daytime hours.
export function forecastByDay(hourly, modelIds) {
  const result = {};
  for (const lead of LEADS) {
    const field = `wave_height_previous_day${lead}`;
    const key = (modelId) => (modelIds.length === 1 ? field : `${field}_${modelId}`);
    const sums = {};
    hourly.time.forEach((time, index) => {
      if (!inDaytime(time)) return;
      const value = blendValues(modelIds.map((modelId) => hourly[key(modelId)]?.[index])).value;
      if (!Number.isFinite(value)) return;
      const date = time.slice(0, 10);
      sums[date] ??= { total: 0, count: 0 };
      sums[date].total += value;
      sums[date].count += 1;
    });
    result[lead] = Object.fromEntries(Object.entries(sums).map(([date, sum]) => [date, sum.total / sum.count]));
  }
  return result;
}

// A day needs this many buoy readings to count, so a buoy that was down most of the day
// doesn't score the forecast on a few odd readings.
const MIN_READINGS = 6;

// pairs: [{ forecast: forecastByDay result, measured: dailyAverages result }], one per buoy.
// Returns one row per lead: { lead, missFt, biasFt, days }. missFt is the average size of
// the miss; biasFt is the average signed miss, positive when the forecast ran high.
// Today is left out, since it isn't over.
export function trackRecord(pairs, today) {
  return LEADS.map((lead) => {
    const misses = [];
    for (const { forecast, measured } of pairs) {
      for (const [date, buoy] of Object.entries(measured ?? {})) {
        const predicted = forecast?.[lead]?.[date];
        if (date >= today || buoy.count < MIN_READINGS || !Number.isFinite(predicted)) continue;
        misses.push(predicted - buoy.ft);
      }
    }
    if (!misses.length) return { lead, missFt: null, biasFt: null, days: 0 };
    const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
    return {
      lead,
      missFt: mean(misses.map(Math.abs)),
      biasFt: mean(misses),
      days: misses.length,
    };
  });
}
