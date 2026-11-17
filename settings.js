// Everything you might want to tune lives here.

export const settings = {
  timezone: 'America/New_York',

  // Today plus Days 1–7, so "3 days out" is Day 3.
  forecastDays: 8,

  // Blended by taking the middle value. ECMWF has no swell period, so period comes from the
  // other two. `gwam` is left out: it showed 3.5–4.2 ft across South Florida where the others
  // showed about 2 ft, which suggests it misses the Bahamas swell shadow.
  models: [
    { id: 'meteofrance_wave', label: 'Météo-France' },
    { id: 'ncep_gfswave025', label: 'NOAA GFS' },
    { id: 'ecmwf_wam025', label: 'ECMWF' },
  ],

  siteUrl: 'https://adriancal19.github.io/surf-radar/',

  // Email alerts. Morning and evening are listed separately, so an evening-only day still counts.
  alerts: {
    daysAhead: 3,
    minRating: 4,
    windows: ['morning', 'evening'],
    // The email lists this many spots, then says how many more are on the site.
    maxSpots: 5,
  },

  // The surf estimate: offshore height × the spot's surfFactor (spots.js) × this period factor.
  // Starting guesses, with South Beach checked against its cam on 2026-11-17.
  surf: {
    // [wave period in seconds, factor]. Longer periods lose less crossing the shelf and
    // grow more in shallow water.
    periodCurve: [
      [5, 0.7],
      [6, 0.8],
      [8, 1],
      [10, 1.15],
      [12, 1.3],
    ],
  },

  // Starting guesses for when to warn about wind. It doesn't change the rating.
  windWarning: {
    // Wind from this range of compass directions blows onshore.
    onshoreFromDeg: 30,
    onshoreToDeg: 150,
    onshoreMph: 12,
    // Windy enough to mention from any direction.
    strongMph: 20,
  },

  // Tropical flags. See src/sources/nhc.js.
  tropical: {
    dataUrl: 'https://raw.githubusercontent.com/adriancal19/surf-radar/buoy-data/tropical.json',
    // An older file is ignored rather than showing a storm that may be gone.
    maxAgeHours: 24,
    // A disturbance counts once its 7-day chance of forming reaches this percent.
    minOutlookChance: 40,
    // Which forecast days get flagged, from today (0) through Day 7.
    stormDays: [0, 5],
    outlookDays: [3, 7],
  },

  // The live buoy correction. See src/correction.js.
  buoyCorrection: {
    dataUrl: 'https://raw.githubusercontent.com/adriancal19/surf-radar/buoy-data/buoys.json',
    readingsToAverage: 3,
    // Older readings are ignored. With none left, the forecast isn't adjusted.
    maxAgeHours: 3,
    // The most a forecast can be scaled: 0.7 is 30% down, 1.3 is 30% up.
    minRatio: 0.7,
    maxRatio: 1.3,
    // The adjustment fades to nothing this far ahead.
    fadeHours: 48,
    // Full strength within fullStrengthKm of the buoy, fading to none at zeroStrengthKm.
    fullStrengthKm: 40,
    zeroStrengthKm: 120,
  },

  // Starting points for drive times, kept general on purpose because this code is public.
  // Each one needs matching times under driveMinutes in spots.js.
  homes: {
    doral: { label: 'Doral', lat: 25.82, lon: -80.35 },
  },

  // Today's times aren't suggested unless you could drive there and still get this long in the water.
  minSurfMinutes: 90,

  activeProfile: 'adrian',

  profiles: {
    adrian: {
      name: 'Adrian',
      home: 'doral',

      // Ratings use the estimated surf at the beach (see surf below), not the offshore height.
      // Anything under ankle high rates 1, however clean.
      minSurfFt: 1,

      // The lowest rating the "only worth surfing" filter keeps. Knee high is the start of 3.
      worthSurfingRating: 3,

      // [surf height in ft, score]. Straight lines between points, flat past the last one.
      // Scores round to the rating: shin high 2, knee to thigh 3, waist to chest 4, head high 5.
      sizeCurve: [
        [1, 1.5],
        [1.5, 2.5],
        [2.5, 3.5],
        [5, 4.5],
        [6, 5],
      ],

      // [share of the sea that's wind chop, points added]. Mostly clean swell adds half a
      // point, mostly chop takes one off. In between scales along the line.
      chopCurve: [
        [0.35, 0.5],
        [0.65, -0.5],
      ],

      // Hours are local time. endHour is not included (6–10 means 6:00 through 9:59).
      // The page rates each window on its own. Weight only sets the whole-day score,
      // which the Phase 3 alerts will use.
      windows: {
        morning: { label: 'Morning', startHour: 6, endHour: 10, weight: 0.75 },
        midday: { label: 'Midday', startHour: 10, endHour: 14, weight: 0.25 },
        evening: { label: 'Evening', startHour: 14, endHour: 18, weight: 0 },
      },
    },
  },

  confidence: {
    // Lead time, in days from today.
    highThroughDay: 3,
    mediumThroughDay: 5,

    // Model disagreement in offshore wave height, in ft: the highest model minus the lowest.
    // Starting guesses to tune.
    agreeSpreadFt: 1,
    bigDisagreementSpreadFt: 2,
  },
};
