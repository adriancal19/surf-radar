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

  activeProfile: 'adrian',

  profiles: {
    adrian: {
      name: 'Adrian',
      home: 'doral',

      // Anything smaller than this rates 1, whatever the period.
      minWaveFt: 2.5,

      // The lowest rating the "only worth surfing" filter keeps.
      worthSurfingRating: 3,

      // [wave height in ft, score]. Straight lines between points, flat past the last one.
      sizeCurve: [
        [2.5, 2.5],
        [4, 4.5],
        [5, 5],
      ],

      // [swell period in seconds, points added to the score].
      periodCurve: [
        [6, -0.5],
        [8, 0.5],
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

    // Model disagreement, in ft. Unused until Phase 1.5 adds more models.
    // These are starting guesses to tune once real spread data is available.
    agreeSpreadFt: 1,
    bigDisagreementSpreadFt: 2,
  },
};
