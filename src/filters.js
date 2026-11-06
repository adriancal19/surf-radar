// Sorting and filtering for the spot list, plus the drive time and best-day helpers.
// No page drawing here, so it's easy to test.

export const SORTS = {
  'north-south': 'North to south',
  best: 'Best to worst',
  closest: 'Closest to farthest',
};

export const DRIVE_LIMITS = [
  { minutes: null, label: 'Any distance' },
  { minutes: 60, label: 'Up to 1 hr' },
  { minutes: 120, label: 'Up to 2 hr' },
];

export const DEFAULT_VIEW = {
  dayIndex: 0,
  sort: 'north-south',
  worthSurfingOnly: false,
  maxDriveMinutes: null,
};

export const driveMinutes = (spot, homeId) => spot.driveMinutes?.[homeId] ?? null;

// Estimates aren't precise, so round to the nearest 5 minutes.
export function formatDrive(minutes) {
  if (minutes === null) return null;
  const rounded = Math.round(minutes / 5) * 5;
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  if (hours === 0) return `about ${remainder} min`;
  return remainder === 0 ? `about ${hours} hr` : `about ${hours} hr ${remainder} min`;
}

// The highest-rated day. If several tie, the soonest wins, since it's the most reliable.
export function bestDay(days) {
  let best = null;
  for (const day of days) {
    if (day.rating !== null && (best === null || day.rating > best.rating)) best = day;
  }
  return best;
}

// Returns the spots to show, in order. `best` groups spots by the rating shown on screen,
// closest first within each rating.
export function applyView(forecast, view, { homeId, worthSurfingRating }) {
  const ratingOf = (spot) => spot.days[view.dayIndex]?.rating ?? null;
  const driveOf = (spot) => driveMinutes(spot, homeId) ?? Infinity;

  const visible = forecast.filter((spot) => {
    if (view.worthSurfingOnly && (ratingOf(spot) ?? 0) < worthSurfingRating) return false;
    if (view.maxDriveMinutes !== null && driveOf(spot) > view.maxDriveMinutes) return false;
    return true;
  });

  const byDrive = (a, b) => (driveOf(a) === driveOf(b) ? 0 : driveOf(a) - driveOf(b));
  if (view.sort === 'closest') return visible.sort(byDrive);
  if (view.sort === 'best') {
    return visible.sort((a, b) => (ratingOf(b) ?? 0) - (ratingOf(a) ?? 0) || byDrive(a, b));
  }
  return visible;
}

// Restores saved choices, ignoring anything unrecognized. The day always starts on today:
// a saved "Saturday" would point at the wrong day by the next visit.
export function restoreView(saved) {
  const view = { ...DEFAULT_VIEW };
  if (!saved || typeof saved !== 'object') return view;
  if (Object.hasOwn(SORTS, saved.sort)) view.sort = saved.sort;
  if (saved.worthSurfingOnly === true) view.worthSurfingOnly = true;
  if (DRIVE_LIMITS.some((limit) => limit.minutes === saved.maxDriveMinutes)) {
    view.maxDriveMinutes = saved.maxDriveMinutes;
  }
  return view;
}
