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
        [6, -1],
        [8, 1],
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
