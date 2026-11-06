// Spots, north to south. IDs appear in links to each spot and in the record of sent alerts.
//
// lat/lon is the point sent to the forecast, not the beach itself. The wave model has
// no data close to most of this coast, so these sit offshore and the model uses its
// nearest point with data, usually 12–22 km out. Heights are not directly comparable
// between spots at different distances from shore.
//
// buoyId is the buoy used for the live correction. Spots south of about Jupiter use the
// Hollywood buoy even when Fort Pierce is similarly close, because the Bahamas block swell
// there and Fort Pierce wouldn't see that.
//
// driveMinutes is a saved estimate without traffic, from each starting point in settings.js
// to the beach. Road distances came from the OSRM routing service on 2026-11-06. OSRM's raw
// times ran long (4 hr to Cocoa Beach, against about 3 hr in practice), so these use:
// 15 minutes + road miles × 0.817, which gives 3 hr for Cocoa's 202 miles.
//
// beach is the shore itself, used to draw the map.
//
// cams are links to free public pages, never embedded or re-hosted. Streams move and go
// offline, so the page also adds a live YouTube search for every spot. Hand-picked 2026-11-06.

export const spots = [
  {
    id: 'cocoa-beach',
    beach: { lat: 28.32, lon: -80.607 },
    name: 'Cocoa Beach',
    lat: 28.32,
    lon: -80.59,
    buoyId: '41113',
    driveMinutes: { doral: 180 },
    cams: [
      { label: 'Cocoa Beach Pier (East Coast Cams)', url: 'https://www.eastcoastcams.com/florida/cocoa-beach/cocoa-beach-pier/' },
      { label: 'Cocoa Beach Pier (HDBeachCams)', url: 'https://hdbeachcams.com/beach-webcams/cocoa-beach-cam/' },
    ],
  },
  {
    id: 'melbourne-beach',
    beach: { lat: 28.07, lon: -80.56 },
    name: 'Melbourne Beach',
    lat: 28.042,
    lon: -80.458,
    buoyId: '41113',
    driveMinutes: { doral: 165 },
    cams: [{ label: 'Indialantic Boardwalk (Visit Space Coast)', url: 'https://www.visitspacecoast.com/blog/indialantic-boardwalk-surf-cam/' }],
  },
  {
    id: 'sebastian-inlet',
    beach: { lat: 27.86, lon: -80.445 },
    name: 'Sebastian Inlet',
    lat: 27.86,
    lon: -80.43,
    buoyId: '41114',
    driveMinutes: { doral: 148 },
    cams: [
      { label: 'Sebastian Inlet (Inlet District)', url: 'https://www.sebastianinletcam.com/' },
      { label: 'Jetty and surf (Florida State Parks)', url: 'https://www.floridastateparks.org/learn/webcam-watch-jetty-and-surf' },
    ],
  },
  {
    id: 'vero-beach',
    beach: { lat: 27.65, lon: -80.355 },
    name: 'Vero Beach',
    lat: 27.65,
    lon: -80.34,
    buoyId: '41114',
    driveMinutes: { doral: 134 },
    cams: [{ label: 'Vero Beach cams (Visit Indian River County)', url: 'https://visitindianrivercounty.com/discover/on-the-water/' }],
  },
  {
    id: 'fort-pierce-inlet',
    beach: { lat: 27.47, lon: -80.29 },
    name: 'Fort Pierce Inlet',
    lat: 27.458,
    lon: -80.208,
    buoyId: '41114',
    driveMinutes: { doral: 126 },
    cams: [{ label: 'Fort Pierce inlet, surf and jetty (Visit St. Lucie)', url: 'https://visitstlucie.com/live-web-cams/' }],
  },
  {
    id: 'jensen-beach',
    beach: { lat: 27.2, lon: -80.16 },
    name: 'Jensen Beach',
    lat: 27.208,
    lon: -80.125,
    buoyId: '41114',
    driveMinutes: { doral: 113 },
    cams: [{ label: 'Jensen Beach and Bathtub Beach (Hutchinson Island)', url: 'https://floridashutchinsonisland.com/Hutchinson-island-Beaches-Webcam.html' }],
  },
  {
    id: 'jupiter-inlet',
    beach: { lat: 26.94, lon: -80.07 },
    name: 'Jupiter Inlet',
    lat: 26.958,
    lon: -79.958,
    buoyId: '41114',
    driveMinutes: { doral: 94 },
    cams: [
      { label: 'Jupiter Inlet and beach (Jupiter Daily)', url: 'https://www.jupiterdaily.com/all-jupiter-fl-live-cams/' },
      { label: 'Juno Pier (HDBeachCams)', url: 'https://hdbeachcams.com/beach-webcams/juno-pier-cam/' },
    ],
  },
  {
    id: 'palm-beach',
    beach: { lat: 26.7, lon: -80.035 },
    name: 'Palm Beach',
    lat: 26.708,
    lon: -79.958,
    buoyId: '41122',
    driveMinutes: { doral: 80 },
    cams: [{ label: 'Palm Beach cams (The Palm Beaches)', url: 'https://www.thepalmbeaches.com/beachcam' }],
  },
  {
    id: 'lake-worth-pier',
    beach: { lat: 26.612, lon: -80.034 },
    name: 'Lake Worth Pier',
    lat: 26.61,
    lon: -80.02,
    buoyId: '41122',
    driveMinutes: { doral: 75 },
    cams: [{ label: 'Lake Worth Pier North (East Coast Cams)', url: 'https://www.eastcoastcams.com/florida/lake-worth/lake-worth-pier-north/' }],
  },
  {
    id: 'delray-beach',
    beach: { lat: 26.46, lon: -80.06 },
    name: 'Delray Beach',
    lat: 26.46,
    lon: -80.05,
    buoyId: '41122',
    driveMinutes: { doral: 65 },
    cams: [{ label: 'Delray Beach cams (The Palm Beaches)', url: 'https://www.thepalmbeaches.com/beachcam' }],
  },
  {
    id: 'boca-inlet',
    beach: { lat: 26.335, lon: -80.07 },
    name: 'Boca Inlet',
    lat: 26.375,
    lon: -79.958,
    buoyId: '41122',
    driveMinutes: { doral: 59 },
    cams: [{ label: 'Boca Raton cams (Live Beaches)', url: 'https://www.livebeaches.com/city/boca-raton-fl/' }],
  },
  {
    id: 'deerfield-beach',
    beach: { lat: 26.318, lon: -80.075 },
    name: 'Deerfield Beach',
    lat: 26.292,
    lon: -79.958,
    buoyId: '41122',
    driveMinutes: { doral: 58 },
    cams: [{ label: 'Deerfield Beach (SkylineWebcams)', url: 'https://www.skylinewebcams.com/en/webcam/united-states/florida/deerfield-beach/deerfield-beach.html' }],
  },
  {
    id: 'pompano-beach',
    beach: { lat: 26.235, lon: -80.085 },
    name: 'Pompano Beach',
    lat: 26.208,
    lon: -79.958,
    buoyId: '41122',
    driveMinutes: { doral: 53 },
    cams: [{ label: 'Pompano Beach Pier (Visit Pompano Beach)', url: 'https://www.visitpompanobeach.com/webcams/' }],
  },
  {
    id: 'fort-lauderdale',
    beach: { lat: 26.12, lon: -80.1 },
    name: 'Fort Lauderdale',
    lat: 26.125,
    lon: -79.958,
    buoyId: '41122',
    driveMinutes: { doral: 47 },
    cams: [{ label: 'Fort Lauderdale Beach (SkylineWebcams)', url: 'https://www.skylinewebcams.com/webcam/united-states/florida/fort-lauderdale/beach.html' }],
  },
  {
    id: 'hollywood',
    beach: { lat: 26.01, lon: -80.115 },
    name: 'Hollywood',
    lat: 26.01,
    lon: -80.1,
    buoyId: '41122',
    driveMinutes: { doral: 37 },
    cams: [{ label: 'Hollywood Beach Broadwalk (YouTube)', url: 'https://www.youtube.com/live/cmkAbDUEoyA' }],
  },
  {
    id: 'haulover',
    beach: { lat: 25.9, lon: -80.12 },
    name: 'Haulover',
    lat: 25.9,
    lon: -80.11,
    buoyId: '41122',
    driveMinutes: { doral: 33 },
    cams: [{ label: 'Haulover Inlet (Salty Forecast)', url: 'https://saltyforecast.com/cams/haulover-inlet-cam' }],
  },
  {
    id: 'south-beach',
    beach: { lat: 25.78, lon: -80.128 },
    name: 'South Beach',
    lat: 25.78,
    lon: -80.115,
    buoyId: '41122',
    driveMinutes: { doral: 29 },
    cams: [
      { label: 'South Beach (SkylineWebcams)', url: 'https://www.skylinewebcams.com/en/webcam/united-states/florida/miami/south-beach.html' },
      { label: 'South Beach from the Bentley (Cruising Earth)', url: 'https://www.cruisingearth.com/port-webcams/united-states/miami-florida3/' },
    ],
  },
];
