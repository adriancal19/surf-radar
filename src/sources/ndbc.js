// NOAA NDBC buoy readings. Browsers can't read NDBC directly, so a scheduled GitHub Action
// (scripts/fetch-buoys.js) saves them as a file, and the page reads that file.

const FEET_PER_METER = 3.28084;
const MISSING = 'MM';

// Turns an NDBC realtime text file into readings with wave data, newest first:
//   { time, waveHeightFt, dominantPeriodS, averagePeriodS, directionDeg }
export function parseNdbcText(text, maxReadings = 12) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const header = lines[0]?.replace(/^#/, '').split(/\s+/) ?? [];
  const column = (name) => header.indexOf(name);

  const readings = [];
  for (const line of lines) {
    if (line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    const number = (name) => {
      const value = parts[column(name)];
      return value === undefined || value === MISSING ? null : Number(value);
    };

    const heightM = number('WVHT');
    if (heightM === null || !Number.isFinite(heightM)) continue;

    const time = new Date(
      Date.UTC(number('YY'), number('MM') - 1, number('DD'), number('hh'), number('mm')),
    );
    readings.push({
      time: time.toISOString(),
      waveHeightFt: heightM * FEET_PER_METER,
      dominantPeriodS: number('DPD'),
      averagePeriodS: number('APD'),
      directionDeg: number('MWD'),
    });
    if (readings.length === maxReadings) break;
  }
  return readings;
}

// The file saved by the GitHub Action. Returns null if it can't be loaded, and the
// forecast carries on without a correction.
export async function fetchBuoyData(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Status ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('Buoy data unavailable:', error);
    return null;
  }
}
