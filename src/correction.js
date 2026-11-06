// Live buoy correction. Compares what a buoy measures with what the models predicted at
// that same place. If the models run high or low, the near-term forecast is scaled to
// match, fading out over time and counting less for spots far from the buoy.

const HOUR_MS = 60 * 60 * 1000;

export function distanceKm(a, b) {
  const toRadians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRadians;
  const dLon = (b.lon - a.lon) * toRadians;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * toRadians) * Math.cos(b.lat * toRadians) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Averages the latest readings against the models at those same hours. The ratio is
// measured ÷ model, kept within limits so one odd reading can't swing the forecast.
// Returns null if the buoy hasn't reported recently or there's nothing to compare.
export function computeBias(readings, modelHeightAt, now, rules) {
  const pairs = [];
  for (const reading of readings) {
    if (now - new Date(reading.time) > rules.maxAgeHours * HOUR_MS) continue;
    const modelFt = modelHeightAt(reading.time);
    if (Number.isFinite(modelFt) && Number.isFinite(reading.waveHeightFt)) {
      pairs.push({ measuredFt: reading.waveHeightFt, modelFt });
    }
    if (pairs.length === rules.readingsToAverage) break;
  }
  if (pairs.length === 0) return null;

  const mean = (key) => pairs.reduce((sum, pair) => sum + pair[key], 0) / pairs.length;
  const measuredFt = mean('measuredFt');
  const modelFt = mean('modelFt');
  if (modelFt <= 0) return null;

  return {
    measuredFt,
    modelFt,
    ratio: Math.min(rules.maxRatio, Math.max(rules.minRatio, measuredFt / modelFt)),
  };
}

// 1 close to the buoy, falling to 0 far away.
export function distanceStrength(km, rules) {
  if (km <= rules.fullStrengthKm) return 1;
  if (km >= rules.zeroStrengthKm) return 0;
  return 1 - (km - rules.fullStrengthKm) / (rules.zeroStrengthKm - rules.fullStrengthKm);
}

// What to multiply a forecast height by, this many hours ahead. 1 means no change.
export function correctionFactor(ratio, hoursAhead, strength, rules) {
  const fade = Math.max(0, 1 - Math.max(0, hoursAhead) / rules.fadeHours);
  return 1 + (ratio - 1) * fade * strength;
}
