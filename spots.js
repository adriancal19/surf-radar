// Spots, north to south. IDs are permanent: session logs will refer to them later.
//
// lat/lon is the point sent to the forecast, not the beach itself. The wave model has
// no data close to most of this coast, so these sit offshore and the model uses its
// nearest point with data, usually 12–22 km out. Heights are not directly comparable
// between spots at different distances from shore. Phase 4 session logs will correct this.

export const spots = [
  { id: 'cocoa-beach', name: 'Cocoa Beach', lat: 28.32, lon: -80.59 },
  { id: 'melbourne-beach', name: 'Melbourne Beach', lat: 28.042, lon: -80.458 },
  { id: 'sebastian-inlet', name: 'Sebastian Inlet', lat: 27.86, lon: -80.43 },
  { id: 'vero-beach', name: 'Vero Beach', lat: 27.65, lon: -80.34 },
  { id: 'fort-pierce-inlet', name: 'Fort Pierce Inlet', lat: 27.458, lon: -80.208 },
  { id: 'stuart-jensen-beach', name: 'Stuart / Jensen Beach', lat: 27.208, lon: -80.125 },
  { id: 'jupiter-juno', name: 'Jupiter Inlet / Juno', lat: 26.958, lon: -79.958 },
  { id: 'palm-beach', name: 'Palm Beach', lat: 26.708, lon: -79.958 },
  { id: 'lake-worth-pier', name: 'Lake Worth Pier', lat: 26.61, lon: -80.02 },
  { id: 'delray-beach', name: 'Delray Beach', lat: 26.46, lon: -80.05 },
  { id: 'boca-inlet', name: 'Boca Inlet', lat: 26.375, lon: -79.958 },
  { id: 'deerfield-beach', name: 'Deerfield Beach', lat: 26.292, lon: -79.958 },
  { id: 'pompano-beach', name: 'Pompano Beach', lat: 26.208, lon: -79.958 },
  { id: 'fort-lauderdale', name: 'Fort Lauderdale', lat: 26.125, lon: -79.958 },
  { id: 'hollywood', name: 'Hollywood', lat: 26.01, lon: -80.1 },
  { id: 'haulover', name: 'Haulover', lat: 25.9, lon: -80.11 },
  { id: 'south-beach', name: 'South Beach', lat: 25.78, lon: -80.115 },
];
