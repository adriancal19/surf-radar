// Runs the steps in order: fetch → group into days → blend → correct → rate → label confidence.
//
// Each day keeps every stage so later phases can plug in without reshaping anything:
//   raw       per-model values for each window
//   blended   models combined
//   final     what gets rated: blended, with wave height adjusted by the nearest buoy
//   slots     one per time of day: final values, wind, score, rating, spread and confidence
//   score     the whole day, weighted by the profile; rating is the rounded version
//   flags     notes for that day, like a tropical system that could send swell

import { blendReadings, blendValues } from './blend.js';
import { confidenceLabel } from './confidence.js';
import { computeBias, correctionFactor, distanceKm, distanceStrength } from './correction.js';
import { scoreConditions, scoreDay, toRating } from './rating.js';
import { fetchBuoyData } from './sources/ndbc.js';
import { fetchTropicalData, flagsForDay } from './sources/nhc.js';
import { fetchMarine, fetchOpenMeteo } from './sources/open-meteo.js';

const average = (values) => {
  const present = values.filter((value) => Number.isFinite(value));
  return present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : null;
};

// Wind direction wraps around: the average of 350° and 10° is 0°, not 180°.
export function averageDirection(degrees) {
  const present = degrees.filter((value) => Number.isFinite(value));
  if (!present.length) return null;
  const toRadians = Math.PI / 180;
  const x = present.reduce((sum, value) => sum + Math.cos(value * toRadians), 0);
  const y = present.reduce((sum, value) => sum + Math.sin(value * toRadians), 0);
  return ((Math.atan2(y, x) / toRadians) + 360) % 360;
}

// Times arrive as local strings like 2026-11-06T06:00, so no time zone math is needed.
const dateOf = (time) => time.slice(0, 10);
const hourOf = (time) => Number(time.slice(11, 13));
const localMs = (date, hour) => Date.parse(`${date}T${String(hour).padStart(2, '0')}:00:00Z`);

function hourIndexes(times, date, window) {
  const indexes = [];
  times.forEach((time, index) => {
    if (dateOf(time) === date && hourOf(time) >= window.startHour && hourOf(time) < window.endHour) {
      indexes.push(index);
    }
  });
  return indexes;
}

function readingsAt(modelSeries, indexes) {
  const reading = {};
  for (const [field, values] of Object.entries(modelSeries)) {
    reading[field] = average(indexes.map((index) => values[index]));
  }
  return reading;
}

function windAt(wind, indexes) {
  if (!wind) return { speedMph: null, directionDeg: null };
  return {
    speedMph: average(indexes.map((index) => wind.speedMph[index])),
    directionDeg: averageDirection(indexes.map((index) => wind.directionDeg[index])),
  };
}

// The adjustment for one point in time. No buoy, or a time already past, means no change.
function factorAt(buoy, hoursAhead, settings) {
  if (!buoy?.bias || hoursAhead === null) return 1;
  return correctionFactor(buoy.bias.ratio, hoursAhead, buoy.strength, settings.buoyCorrection);
}

function hoursAheadOfWindow(window, date, nowKey) {
  const nowHour = hourOf(nowKey);
  if (dateOf(nowKey) === date && nowHour >= window.endHour) return null;
  const middle = (window.startHour + window.endHour) / 2;
  return Math.max(0, (localMs(date, middle) - localMs(dateOf(nowKey), nowHour)) / 3600000);
}

function scaled(values, factor) {
  return {
    ...values,
    waveHeightFt: Number.isFinite(values.waveHeightFt) ? values.waveHeightFt * factor : values.waveHeightFt,
  };
}

function buildDay(data, date, dayIndex, settings, profile, nowKey, buoy, tropical) {
  const raw = Object.fromEntries(Object.keys(data.models).map((modelId) => [modelId, {}]));
  const blended = {};
  const final = {};
  const wind = {};
  const slots = {};
  let spreadFt = null;

  for (const [name, window] of Object.entries(profile.windows)) {
    const indexes = hourIndexes(data.times, date, window);
    for (const [modelId, series] of Object.entries(data.models)) {
      raw[modelId][name] = readingsAt(series, indexes);
    }
    const { heightSpreadFt, ...values } = blendReadings(
      Object.keys(data.models).map((modelId) => raw[modelId][name]),
    );
    blended[name] = values;
    final[name] = scaled(values, factorAt(buoy, hoursAheadOfWindow(window, date, nowKey), settings));
    wind[name] = windAt(data.wind, indexes);
    if (heightSpreadFt !== null) spreadFt = Math.max(spreadFt ?? 0, heightSpreadFt);

    const slotScore = scoreConditions(final[name], profile);
    slots[name] = {
      name,
      // Already over, so it shouldn't be suggested as a time to go.
      past: dateOf(nowKey) === date && hourOf(nowKey) >= window.endHour,
      final: final[name],
      wind: wind[name],
      score: slotScore,
      rating: toRating(slotScore),
      spreadFt: heightSpreadFt,
      confidence: confidenceLabel({ dayIndex, spreadFt: heightSpreadFt }, settings.confidence),
    };
  }

  const score = scoreDay(final, profile);
  return {
    date,
    dayIndex,
    raw,
    blended,
    final,
    wind,
    slots,
    spreadFt,
    score,
    rating: toRating(score),
    confidence: confidenceLabel({ dayIndex, spreadFt }, settings.confidence),
    flags: flagsForDay(tropical, dayIndex, settings.tropical),
  };
}

function buildNow(data, nowKey, buoy, settings) {
  const index = data.times.indexOf(nowKey);
  if (index === -1) return null;
  const readings = Object.values(data.models).map((series) => readingsAt(series, [index]));
  const { heightSpreadFt, ...values } = blendReadings(readings);
  return { time: nowKey, ...scaled(values, factorAt(buoy, 0, settings)), wind: windAt(data.wind, [index]) };
}

// Compares one buoy's readings with the blended models at the buoy's own location.
export function buildBuoyStatus(buoy, readings, marine, settings, now) {
  if (!readings?.length) return null;
  const indexByTime = new Map(marine?.times.map((time, index) => [time, index]) ?? []);

  const modelHeightAt = (isoTime) => {
    const index = indexByTime.get(localHourKey(new Date(isoTime), settings.timezone));
    if (index === undefined) return null;
    const values = Object.values(marine.models).map((series) => series.waveHeightFt[index]);
    return blendValues(values).value;
  };

  return {
    ...buoy,
    latest: readings[0],
    bias: computeBias(readings, modelHeightAt, now, settings.buoyCorrection),
  };
}

// Adds what's specific to one spot: how far away the buoy is and how much that weakens it.
function buoyForSpot(spot, status, settings) {
  if (!status) return null;
  const km = distanceKm(spot, status);
  return { ...status, distanceKm: km, strength: distanceStrength(km, settings.buoyCorrection) };
}

export function buildSpotForecast(spot, data, settings, nowKey, buoyStatus = null, tropical = []) {
  const profile = settings.profiles[settings.activeProfile];
  const dates = [...new Set(data.times.map(dateOf))];
  const buoy = buoyForSpot(spot, buoyStatus, settings);
  return {
    ...spot,
    buoy,
    nowFactor: factorAt(buoy, 0, settings),
    now: buildNow(data, nowKey, buoy, settings),
    days: dates.map((date, dayIndex) =>
      buildDay(data, date, dayIndex, settings, profile, nowKey, buoy, tropical),
    ),
  };
}

// The current hour at the beach, in the same format as the forecast times.
export function localHourKey(date, timezone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:00`;
}

// Buoy trouble of any kind just means no correction. It never stops the forecast.
async function loadBuoyStatuses(buoys, settings, now) {
  const statuses = {};
  try {
    const [saved, marine] = await Promise.all([
      fetchBuoyData(settings.buoyCorrection.dataUrl),
      fetchMarine(buoys, settings),
    ]);
    buoys.forEach((buoy, index) => {
      statuses[buoy.id] = buildBuoyStatus(buoy, saved?.stations?.[buoy.id]?.readings, marine[index], settings, now);
    });
  } catch (error) {
    console.warn('Buoy comparison unavailable:', error);
  }
  return statuses;
}

export async function loadForecast(spots, buoys, settings) {
  const now = new Date();
  const [data, statuses, tropical] = await Promise.all([
    fetchOpenMeteo(spots, settings),
    loadBuoyStatuses(buoys, settings, now),
    fetchTropicalData(settings.tropical, now),
  ]);
  const nowKey = localHourKey(now, settings.timezone);
  return spots.map((spot, index) =>
    buildSpotForecast(spot, data[index], settings, nowKey, statuses[spot.buoyId] ?? null, tropical),
  );
}
