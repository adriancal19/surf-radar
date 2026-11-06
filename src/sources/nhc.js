// National Hurricane Center storms and outlooks. Browsers can't read NHC directly, so a
// scheduled GitHub Action (scripts/fetch-tropical.js) saves the results as a file.

const STORMS_URL = 'https://www.nhc.noaa.gov/CurrentStorms.json';
const OUTLOOK_URL = 'https://www.nhc.noaa.gov/gtwo.xml';

const CLASSIFICATIONS = {
  TD: 'Tropical Depression',
  STD: 'Subtropical Depression',
  TS: 'Tropical Storm',
  STS: 'Subtropical Storm',
  HU: 'Hurricane',
  PTC: 'Potential Tropical Cyclone',
};

// Where a system could send swell to Florida's east coast: the western and central Atlantic
// and the Caribbean. The Gulf is left out because Florida itself blocks its swell.
export function inSwellRegion(lat, lon) {
  if (lat < 8 || lat > 38 || lon < -88 || lon > -50) return false;
  const inGulf = lat >= 21 && lon < -81.5;
  return !inGulf;
}

export function parseActiveStorms(json) {
  return (json.activeStorms ?? [])
    .filter((storm) => String(storm.id).startsWith('al'))
    .filter((storm) => inSwellRegion(storm.latitudeNumeric, storm.longitudeNumeric))
    .map((storm) => ({
      id: storm.id,
      kind: 'storm',
      name: `${CLASSIFICATIONS[storm.classification] ?? 'Tropical System'} ${storm.name}`,
      position: `${storm.latitude}, ${storm.longitude}`,
    }));
}

// Outlook areas only come with a place name, not coordinates, so this goes by the name.
const outsideSwellRegion = (heading) => /gulf|eastern (tropical )?atlantic|africa/i.test(heading);

// Reads the Atlantic section of the outlook feed. Each disturbance is a paragraph that opens
// with a place name and contains a line like "Formation chance through 7 days...low...10 percent."
export function parseOutlook(xml, minChance) {
  const item = xml
    .split('<item>')
    .find((part) => part.includes('<title>Atlantic Tropical Weather Outlook</title>'));
  if (!item) throw new Error('Atlantic outlook not found in the feed.');

  const text = item.replace(/<br\s*\/?>/gi, '\n').replace(/[ \t]+\n/g, '\n');
  const systems = [];
  for (const block of text.split(/\n\s*\n/)) {
    const chance = block.match(/Formation chance through 7 days\.\.\.\w+\.\.\.(?:near )?(\d+) percent/i);
    const heading = block.match(/^([^\n]*?):\s*$/m)?.[1]?.trim();
    if (!chance || !heading || outsideSwellRegion(heading)) continue;
    const chance7Day = Number(chance[1]);
    if (chance7Day < minChance) continue;
    const invest = heading.match(/\((AL\d+)\)/i)?.[1];
    const place = heading.replace(/\s*\(AL\d+\)/i, '');
    systems.push({
      id: invest ?? place.toLowerCase().replace(/[^a-z]+/g, '-'),
      kind: 'outlook',
      name: `Disturbance in the ${place}`,
      chance7Day,
    });
  }
  return systems;
}

// Used by the scheduled jobs. Throws if a feed can't be read, so a failure is never
// mistaken for "no storms".
export async function fetchNhcSystems(minChance) {
  const headers = { 'User-Agent': 'surf-radar' };
  const [stormsResponse, outlookResponse] = await Promise.all([
    fetch(STORMS_URL, { headers }),
    fetch(OUTLOOK_URL, { headers }),
  ]);
  if (!stormsResponse.ok) throw new Error(`Storm feed returned ${stormsResponse.status}`);
  if (!outlookResponse.ok) throw new Error(`Outlook feed returned ${outlookResponse.status}`);
  return [
    ...parseActiveStorms(await stormsResponse.json()),
    ...parseOutlook(await outlookResponse.text(), minChance),
  ];
}

// The flags for one forecast day. Active storms can already be sending swell; a disturbance
// that hasn't formed yet could only matter later.
export function flagsForDay(systems, dayIndex, rules) {
  return systems
    .filter((system) => {
      const [from, to] = system.kind === 'storm' ? rules.stormDays : rules.outlookDays;
      return dayIndex >= from && dayIndex <= to;
    })
    .map((system) => ({ type: 'tropical', systemId: system.id, text: `Possible swell: ${system.name}` }));
}

// The file saved by the GitHub Action. Trouble loading it, or an old file, means no flags.
export async function fetchTropicalData(rules, now) {
  try {
    const response = await fetch(rules.dataUrl);
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const saved = await response.json();
    const ageHours = (now - new Date(saved.fetchedAt)) / 3600000;
    return ageHours <= rules.maxAgeHours ? saved.systems ?? [] : [];
  } catch (error) {
    console.warn('Tropical data unavailable:', error);
    return [];
  }
}
