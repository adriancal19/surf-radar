// Runs the steps in order: fetch → group into days → blend → rate → label confidence.
//
// Each day keeps every stage so later phases can plug in without reshaping anything:
//   raw       per-model values for each window
//   blended   models combined
//   final     what gets rated (same as blended until Phase 1.5 adds the buoy correction)
//   slots     one per time of day: final values, wind, score, rating, spread and confidence
//   score     the whole day, weighted by the profile; rating is the rounded version
//   flags     empty until Phase 3 adds the tropical flag

import { blendReadings } from './blend.js';
import { confidenceLabel } from './confidence.js';
import { scoreConditions, scoreDay, toRating } from './rating.js';
import { fetchOpenMeteo } from './sources/open-meteo.js';

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

function buildDay(data, date, dayIndex, settings, profile, nowKey) {
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
    final[name] = { ...values };
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
    flags: [],
  };
}

function buildNow(data, nowKey) {
  const index = data.times.indexOf(nowKey);
  if (index === -1) return null;
  const readings = Object.values(data.models).map((series) => readingsAt(series, [index]));
  const { heightSpreadFt, ...values } = blendReadings(readings);
  return { time: nowKey, ...values, wind: windAt(data.wind, [index]) };
}

export function buildSpotForecast(spot, data, settings, nowKey) {
  const profile = settings.profiles[settings.activeProfile];
  const dates = [...new Set(data.times.map(dateOf))];
  return {
    ...spot,
    now: buildNow(data, nowKey),
    days: dates.map((date, dayIndex) => buildDay(data, date, dayIndex, settings, profile, nowKey)),
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

export async function loadForecast(spots, settings) {
  const data = await fetchOpenMeteo(spots, settings);
  const nowKey = localHourKey(new Date(), settings.timezone);
  return spots.map((spot, index) => buildSpotForecast(spot, data[index], settings, nowKey));
}
