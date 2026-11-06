// NOAA NDBC buoys that report waves near these spots. Each spot picks one in spots.js.
// Checked 2026-11-06. 41009 and 41010 are left out because they sit far offshore, past
// where the Bahamas and the coastline affect the swell, and 41068 had no recent waves.

export const buoys = [
  { id: '41113', name: 'Cape Canaveral nearshore', lat: 28.4, lon: -80.533 },
  { id: '41114', name: 'Fort Pierce', lat: 27.564, lon: -80.215 },
  { id: '41122', name: 'Hollywood Beach', lat: 26.001, lon: -80.096 },
];
