// Turns the offshore forecast into an estimate of the surf at the beach.
//
// The models split the sea into parts: wind chop and up to three swells, each with its own
// height, period and direction. Each part becomes surf on its own:
//
//   part surf = height × period factor × direction factor
//
// and the parts combine by energy (square root of the sum of squares), the same way the
// models build their total. The spot factor then scales the result for that beach.
//
// - Period factor: longer-period waves lose less crossing the shelf and grow more in
//   shallow water.
// - Direction factor: waves aimed straight at the beach count in full; waves arriving at
//   an angle bend and spread as they come in, so they count for less; waves running along
//   the coast or out to sea don't count. The Bahamas aren't handled here: the forecast
//   points sit between Florida and the islands, so the models already include their shadow.
// - Spot factor: how much of the swell reaches that beach, mostly down to how wide the
//   shallow shelf is.
//
// A model that doesn't split the sea (ECMWF) uses its total height, period and direction.
// No fetching and no page drawing here, so it's easy to test.

import { interpolate } from './rating.js';

// The parts, wind chop first. Each has <prefix>HeightFt, <prefix>PeriodS and <prefix>DirectionDeg.
export const WAVE_PARTS = ['windWave', 'swell', 'secondarySwell', 'tertiarySwell'];

const toRadians = Math.PI / 180;

// The smaller angle between two compass directions, 0 to 180.
export function angleBetween(a, b) {
  const difference = Math.abs(a - b) % 360;
  return difference > 180 ? 360 - difference : difference;
}

// 1 for waves coming straight in, less at an angle, 0 from 90° off or more. Directions are
// where the waves come from. An unknown direction counts in full.
export function directionFactor(fromDeg, facingDeg) {
  if (!Number.isFinite(fromDeg)) return 1;
  const off = angleBetween(fromDeg, facingDeg);
  return off >= 90 ? 0 : Math.sqrt(Math.cos(off * toRadians));
}

// Surf from one part, before the spot factor. A missing period counts as the neutral 1.
// Models report an absent part as 0 ft, which gives nothing.
export function partSurfFt(heightFt, periodS, fromDeg, facingDeg, rules) {
  if (!Number.isFinite(heightFt) || heightFt <= 0) return null;
  const period = Number.isFinite(periodS) && periodS > 0 ? interpolate(rules.periodCurve, periodS) : 1;
  return heightFt * period * directionFactor(fromDeg, facingDeg);
}

// One model at one hour: { surfHeightFt, windChopShare }. The chop share is the part of the
// surf's energy that comes from wind chop, from 0 (all swell) to 1 (all chop), or null
// when the model doesn't split the sea.
export function surfAt(reading, spot, rules) {
  const parts = WAVE_PARTS.map((prefix) => ({
    prefix,
    surf: partSurfFt(
      reading[`${prefix}HeightFt`],
      reading[`${prefix}PeriodS`],
      reading[`${prefix}DirectionDeg`],
      spot.facingDeg,
      rules,
    ),
  })).filter((part) => part.surf !== null);

  if (parts.length) {
    const energy = parts.reduce((sum, part) => sum + part.surf ** 2, 0);
    const chop = parts.find((part) => part.prefix === 'windWave')?.surf ?? 0;
    return {
      surfHeightFt: Math.sqrt(energy) * spot.surfFactor,
      windChopShare: energy > 0 ? chop ** 2 / energy : null,
    };
  }
  const total = partSurfFt(reading.waveHeightFt, reading.wavePeriodS, reading.waveDirectionDeg, spot.facingDeg, rules);
  return { surfHeightFt: total === null ? null : total * spot.surfFactor, windChopShare: null };
}

// Adds surfHeightFt and windChopShare series to each model's hourly series.
export function addSurfSeries(models, spot, rules) {
  const result = {};
  for (const [modelId, series] of Object.entries(models)) {
    const hours = series.waveHeightFt?.length ?? 0;
    const surf = [];
    const chop = [];
    for (let index = 0; index < hours; index++) {
      const reading = Object.fromEntries(Object.entries(series).map(([field, values]) => [field, values[index]]));
      const { surfHeightFt, windChopShare } = surfAt(reading, spot, rules);
      surf.push(surfHeightFt);
      chop.push(windChopShare);
    }
    result[modelId] = { ...series, surfHeightFt: surf, windChopShare: chop };
  }
  return result;
}

// An estimate shouldn't look precise, so it's shown as a range of whole feet around it:
// 2.5 ft is "2–3 ft". From 4 ft up the range widens, since bigger days vary more.
export function surfRange(feet) {
  if (!Number.isFinite(feet)) return null;
  if (feet < 1) return 'Under 1 ft';
  if (feet < 4) return `${Math.floor(feet)}–${Math.floor(feet) + 1} ft`;
  const low = Math.round(feet * 0.85);
  return `${low}–${Math.max(low + 1, Math.round(feet * 1.15))} ft`;
}

// Rough body heights for an average adult, by surf height in ft.
const BODY = [
  [1, 'Ankle high'],
  [1.5, 'Shin high'],
  [2, 'Knee high'],
  [2.5, 'Thigh high'],
  [3, 'Waist high'],
  [4, 'Chest high'],
  [5, 'Shoulder high'],
  [6, 'Head high'],
];

export function bodyLabel(feet) {
  if (!Number.isFinite(feet)) return null;
  return BODY.find(([below]) => feet < below)?.[1] ?? 'Overhead';
}

// A short note on the sea's makeup, for the small print.
export function chopNote(share) {
  if (!Number.isFinite(share)) return null;
  if (share >= 0.65) return 'mostly wind chop';
  if (share <= 0.35) return 'mostly clean swell';
  return 'swell and wind chop';
}
