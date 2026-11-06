// Turns plain numbers plus a profile into a 1–5 score. No fetching and no page drawing,
// so it's easy to test and to reuse in the Phase 3 alert job.

const MIN_SCORE = 1;
const MAX_SCORE = 5;

// Reads a value off a list of [x, y] points, with straight lines between them.
// Flat before the first point and after the last.
export function interpolate(points, x) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return points[points.length - 1][1];
}

// Score for one window of conditions. Returns null if there's no wave height.
export function scoreConditions({ waveHeightFt, swellPeriodS }, profile) {
  if (!Number.isFinite(waveHeightFt)) return null;
  if (waveHeightFt < profile.minWaveFt) return MIN_SCORE;

  const size = interpolate(profile.sizeCurve, waveHeightFt);
  // A missing period leaves the score alone rather than counting as short or long.
  const period = Number.isFinite(swellPeriodS) ? interpolate(profile.periodCurve, swellPeriodS) : 0;
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, size + period));
}

// Scores each window separately, then combines them by weight. If a window has no data,
// the remaining windows make up the full weight.
export function scoreDay(conditionsByWindow, profile) {
  let total = 0;
  let totalWeight = 0;
  for (const [name, window] of Object.entries(profile.windows)) {
    const score = conditionsByWindow[name] ? scoreConditions(conditionsByWindow[name], profile) : null;
    if (score !== null) {
      total += score * window.weight;
      totalWeight += window.weight;
    }
  }
  return totalWeight > 0 ? total / totalWeight : null;
}

export const toRating = (score) => (score === null ? null : Math.round(score));

const LABELS = { 1: 'Skip it', 2: 'Marginal', 3: 'Fair', 4: 'Good', 5: 'Great' };
export const ratingLabel = (rating) => LABELS[rating] ?? 'No data';
