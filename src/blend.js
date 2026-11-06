// Combines values from several wave models and measures how much they disagree.
// With one model the value passes through and the spread is unknown (null).

export function blendValues(values) {
  const present = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (present.length === 0) return { value: null, spread: null, count: 0 };
  if (present.length === 1) return { value: present[0], spread: null, count: 1 };

  const middle = Math.floor(present.length / 2);
  const median =
    present.length % 2 === 1 ? present[middle] : (present[middle - 1] + present[middle]) / 2;

  return {
    value: median,
    spread: present[present.length - 1] - present[0],
    count: present.length,
  };
}

// Takes one set of readings per model, e.g. [{ waveHeightFt: 3, swellPeriodS: 8 }, ...],
// and returns one blended set plus the spread in wave height.
export function blendReadings(readings) {
  const fields = [...new Set(readings.flatMap((reading) => Object.keys(reading)))];
  const blended = {};
  for (const field of fields) {
    blended[field] = blendValues(readings.map((reading) => reading[field])).value;
  }
  blended.heightSpreadFt = blendValues(readings.map((reading) => reading.waveHeightFt)).spread;
  return blended;
}
