// Turns the offshore wave height into an estimate of the surf at the beach.
//
//   surf = offshore height × spot factor × period factor
//
// The spot factor is fixed: how much of the swell reaches that beach, mostly down to the
// Bahamas and the width of the shallow shelf. The period factor changes with each forecast:
// longer-period waves lose less on the way in and grow more as they reach shallow water.
// No fetching and no page drawing here, so it's easy to test.

import { interpolate } from './rating.js';

// How much of the sea is wind chop rather than swell, from 0 (all swell) to 1 (all chop).
// Uses energy, which goes with height squared, so a 2 ft swell under 6 ft of chop is
// still mostly chop. Unknown if either part is missing.
export function windChopShare(swellHeightFt, windWaveHeightFt) {
  if (!Number.isFinite(swellHeightFt) || !Number.isFinite(windWaveHeightFt)) return null;
  const swell = swellHeightFt ** 2;
  const chop = windWaveHeightFt ** 2;
  return swell + chop > 0 ? chop / (swell + chop) : null;
}

// The estimated surf height in ft, or null without an offshore height. A missing period
// counts as the neutral 1 rather than as short or long.
export function surfHeightFt({ waveHeightFt, wavePeriodS }, spotFactor, rules) {
  if (!Number.isFinite(waveHeightFt)) return null;
  const periodFactor = Number.isFinite(wavePeriodS) ? interpolate(rules.periodCurve, wavePeriodS) : 1;
  return waveHeightFt * spotFactor * periodFactor;
}

// Adds the surf estimate and the chop share to one set of offshore values.
export function withSurf(values, spotFactor, rules) {
  return {
    ...values,
    surfHeightFt: surfHeightFt(values, spotFactor, rules),
    windChopShare: windChopShare(values.swellHeightFt, values.windWaveHeightFt),
  };
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
