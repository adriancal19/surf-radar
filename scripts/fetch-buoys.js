// Run by the GitHub Action in .github/workflows/fetch-buoys.yml. Saves the latest readings
// from each buoy to a file the site can read. Usage: node scripts/fetch-buoys.js <output path>

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { buoys } from '../buoys.js';
import { parseNdbcText } from '../src/sources/ndbc.js';

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
    stations[buoy.id] = { readings: parseNdbcText(await response.text()) };
    console.log(`${buoy.id}: ${stations[buoy.id].readings.length} readings`);
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
