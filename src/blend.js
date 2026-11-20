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

// Directions wrap around: the average of 350° and 10° is 0°, not 180°.
export function averageDirection(degrees) {
  const present = degrees.filter((value) => Number.isFinite(value));
  if (!present.length) return null;
  const toRadians = Math.PI / 180;
  const x = present.reduce((sum, value) => sum + Math.cos(value * toRadians), 0);
  const y = present.reduce((sum, value) => sum + Math.sin(value * toRadians), 0);
  return ((Math.atan2(y, x) / toRadians) + 360) % 360;
}

export const isDirectionField = (field) => field.endsWith('DirectionDeg');

// Takes one set of readings per model, e.g. [{ waveHeightFt: 3, swellPeriodS: 8 }, ...],
// and returns one blended set plus the spread in wave height. Directions are averaged
// around the compass; everything else takes the middle value.
export function blendReadings(readings) {
  const fields = [...new Set(readings.flatMap((reading) => Object.keys(reading)))];
  const blended = {};
  for (const field of fields) {
    const values = readings.map((reading) => reading[field]);
    blended[field] = isDirectionField(field) ? averageDirection(values) : blendValues(values).value;
  }
  blended.heightSpreadFt = blendValues(readings.map((reading) => reading.waveHeightFt)).spread;
  return blended;
}
