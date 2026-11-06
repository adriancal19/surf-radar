// Spots, north to south. IDs are permanent: session logs will refer to them later.
//
// lat/lon is the point sent to the forecast, not the beach itself. The wave model has
// no data close to most of this coast, so these sit offshore and the model uses its
// nearest point with data, usually 12–22 km out. Heights are not directly comparable
// between spots at different distances from shore. Phase 4 session logs will correct this.
//
// buoyId is the buoy used for the live correction. Spots south of about Jupiter use the
// Hollywood buoy even when Fort Pierce is similarly close, because the Bahamas block swell
// there and Fort Pierce wouldn't see that.
//
// driveMinutes is a saved estimate without traffic, from each starting point in settings.js
// to the beach. Road distances came from the OSRM routing service on 2026-11-06. OSRM's raw
// times ran long (4 hr to Cocoa Beach, against about 3 hr in practice), so these use:
// 15 minutes + road miles × 0.817, which gives 3 hr for Cocoa's 202 miles.

export const spots = [
  { id: 'cocoa-beach', name: 'Cocoa Beach', lat: 28.32, lon: -80.59, buoyId: '41113', driveMinutes: { doral: 180 } },
  { id: 'melbourne-beach', name: 'Melbourne Beach', lat: 28.042, lon: -80.458, buoyId: '41113', driveMinutes: { doral: 165 } },
  { id: 'sebastian-inlet', name: 'Sebastian Inlet', lat: 27.86, lon: -80.43, buoyId: '41114', driveMinutes: { doral: 148 } },
  { id: 'vero-beach', name: 'Vero Beach', lat: 27.65, lon: -80.34, buoyId: '41114', driveMinutes: { doral: 134 } },
  { id: 'fort-pierce-inlet', name: 'Fort Pierce Inlet', lat: 27.458, lon: -80.208, buoyId: '41114', driveMinutes: { doral: 126 } },
  { id: 'stuart-jensen-beach', name: 'Stuart / Jensen Beach', lat: 27.208, lon: -80.125, buoyId: '41114', driveMinutes: { doral: 113 } },
  { id: 'jupiter-juno', name: 'Jupiter Inlet / Juno', lat: 26.958, lon: -79.958, buoyId: '41114', driveMinutes: { doral: 94 } },
  { id: 'palm-beach', name: 'Palm Beach', lat: 26.708, lon: -79.958, buoyId: '41122', driveMinutes: { doral: 80 } },
  { id: 'lake-worth-pier', name: 'Lake Worth Pier', lat: 26.61, lon: -80.02, buoyId: '41122', driveMinutes: { doral: 75 } },
  { id: 'delray-beach', name: 'Delray Beach', lat: 26.46, lon: -80.05, buoyId: '41122', driveMinutes: { doral: 65 } },
  { id: 'boca-inlet', name: 'Boca Inlet', lat: 26.375, lon: -79.958, buoyId: '41122', driveMinutes: { doral: 59 } },
  { id: 'deerfield-beach', name: 'Deerfield Beach', lat: 26.292, lon: -79.958, buoyId: '41122', driveMinutes: { doral: 58 } },
  { id: 'pompano-beach', name: 'Pompano Beach', lat: 26.208, lon: -79.958, buoyId: '41122', driveMinutes: { doral: 53 } },
  { id: 'fort-lauderdale', name: 'Fort Lauderdale', lat: 26.125, lon: -79.958, buoyId: '41122', driveMinutes: { doral: 47 } },
  { id: 'hollywood', name: 'Hollywood', lat: 26.01, lon: -80.1, buoyId: '41122', driveMinutes: { doral: 37 } },
  { id: 'haulover', name: 'Haulover', lat: 25.9, lon: -80.11, buoyId: '41122', driveMinutes: { doral: 33 } },
  { id: 'south-beach', name: 'South Beach', lat: 25.78, lon: -80.115, buoyId: '41122', driveMinutes: { doral: 29 } },
];
