// Run by the GitHub Action in .github/workflows/fetch-buoys.yml. Saves each buoy's latest
// readings (for the live correction) and its daytime average for each of the last 31 days
// (for the track record) to a file the site can read.
// Usage: node scripts/fetch-buoys.js <output path>

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { buoys } from '../buoys.js';
import { settings } from '../settings.js';
import { parseNdbcText } from '../src/sources/ndbc.js';
import { dailyAverages } from '../src/track.js';

const outputPath = process.argv[2];
if (!outputPath) {
  console.error('Usage: node scripts/fetch-buoys.js <output path>');
  process.exit(1);
}

const stations = {};
for (const buoy of buoys) {
  try {
    const response = await fetch(`https://www.ndbc.noaa.gov/data/realtime2/${buoy.id}.txt`, {
      headers: { 'User-Agent': 'surf-radar' },
    });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const text = await response.text();
    // NDBC keeps about 45 days. The newest few drive the correction; all of them feed the daily averages.
    const all = parseNdbcText(text, Infinity);
    stations[buoy.id] = { readings: all.slice(0, 12), daily: dailyAverages(all, settings.timezone) };
    console.log(`${buoy.id}: ${all.length} readings, ${Object.keys(stations[buoy.id].daily).length} days`);
  } catch (error) {
    // One buoy being down shouldn't stop the others.
    console.warn(`${buoy.id}: ${error.message}`);
  }
}

// If every buoy failed, keep the last good file rather than replacing it with nothing.
if (Object.keys(stations).length === 0) {
  console.error('No buoys could be read.');
  process.exit(1);
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify({ fetchedAt: new Date().toISOString(), stations }));
