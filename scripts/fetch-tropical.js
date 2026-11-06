// Run by the GitHub Action in .github/workflows/fetch-buoys.yml. Saves tropical systems that
// could send swell to a file the site can read. Usage: node scripts/fetch-tropical.js <output path>

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { settings } from '../settings.js';
import { fetchNhcSystems } from '../src/sources/nhc.js';

const outputPath = process.argv[2];
if (!outputPath) {
  console.error('Usage: node scripts/fetch-tropical.js <output path>');
  process.exit(1);
}

const systems = await fetchNhcSystems(settings.tropical.minOutlookChance);
console.log(`${systems.length} tropical systems: ${systems.map((system) => system.name).join(', ') || 'none'}`);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify({ fetchedAt: new Date().toISOString(), systems }));
