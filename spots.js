// Spots, north to south. IDs are permanent: session logs will refer to them later.
//
// lat/lon is the point sent to the forecast, not the beach itself. The wave model has
// no data close to most of this coast, so these sit offshore and the model uses its
// nearest point with data, usually 12–22 km out. Heights are not directly comparable
// between spots at different distances from shore. Phase 4 session logs will correct this.
//
// driveMinutes is a saved estimate without traffic, from each starting point in settings.js
// to the beach. Calculated once with the OSRM routing service on 2026-11-06.

export const spots = [
  { id: 'cocoa-beach', name: 'Cocoa Beach', lat: 28.32, lon: -80.59, driveMinutes: { doral: 239 } },
  { id: 'melbourne-beach', name: 'Melbourne Beach', lat: 28.042, lon: -80.458, driveMinutes: { doral: 217 } },
  { id: 'sebastian-inlet', name: 'Sebastian Inlet', lat: 27.86, lon: -80.43, driveMinutes: { doral: 204 } },
  { id: 'vero-beach', name: 'Vero Beach', lat: 27.65, lon: -80.34, driveMinutes: { doral: 176 } },
  { id: 'fort-pierce-inlet', name: 'Fort Pierce Inlet', lat: 27.458, lon: -80.208, driveMinutes: { doral: 162 } },
  { id: 'stuart-jensen-beach', name: 'Stuart / Jensen Beach', lat: 27.208, lon: -80.125, driveMinutes: { doral: 147 } },
  { id: 'jupiter-juno', name: 'Jupiter Inlet / Juno', lat: 26.958, lon: -79.958, driveMinutes: { doral: 120 } },
  { id: 'palm-beach', name: 'Palm Beach', lat: 26.708, lon: -79.958, driveMinutes: { doral: 102 } },
  { id: 'lake-worth-pier', name: 'Lake Worth Pier', lat: 26.61, lon: -80.02, driveMinutes: { doral: 94 } },
  { id: 'delray-beach', name: 'Delray Beach', lat: 26.46, lon: -80.05, driveMinutes: { doral: 80 } },
  { id: 'boca-inlet', name: 'Boca Inlet', lat: 26.375, lon: -79.958, driveMinutes: { doral: 74 } },
  { id: 'deerfield-beach', name: 'Deerfield Beach', lat: 26.292, lon: -79.958, driveMinutes: { doral: 69 } },
  { id: 'pompano-beach', name: 'Pompano Beach', lat: 26.208, lon: -79.958, driveMinutes: { doral: 61 } },
  { id: 'fort-lauderdale', name: 'Fort Lauderdale', lat: 26.125, lon: -79.958, driveMinutes: { doral: 55 } },
  { id: 'hollywood', name: 'Hollywood', lat: 26.01, lon: -80.1, driveMinutes: { doral: 46 } },
  { id: 'haulover', name: 'Haulover', lat: 25.9, lon: -80.11, driveMinutes: { doral: 44 } },
  { id: 'south-beach', name: 'South Beach', lat: 25.78, lon: -80.115, driveMinutes: { doral: 31 } },
];
