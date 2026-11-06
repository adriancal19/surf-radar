// Sorting and filtering for the spot list, plus the drive time and best-day helpers.
// No page drawing here, so it's easy to test.

// How far ahead to look, counting today. "3 days" is today, tomorrow and the day after.
export const RANGES = [
  { days: 1, label: 'Today' },
  { days: 3, label: '3 days' },
  { days: 5, label: '5 days' },
  { days: 7, label: '7 days' },
];

export const SORTS = {
  'north-south': 'North to south',
  best: 'Best first',
  closest: 'Closest',
};

export const DRIVE_LIMITS = [
  { minutes: 60, label: 'Within 1 hr' },
  { minutes: 120, label: 'Within 2 hr' },
];

export const DEFAULT_VIEW = {
  rangeDays: 1,
  sort: 'north-south',
  worthSurfingOnly: false,
  maxDriveMinutes: null,
};

export const driveMinutes = (spot, homeId) => spot.driveMinutes?.[homeId] ?? null;

// Estimates aren't precise, so round to the nearest 5 minutes.
function roundDrive(minutes) {
  const rounded = Math.round(minutes / 5) * 5;
  return { hours: Math.floor(rounded / 60), remainder: rounded % 60 };
}

export function formatDrive(minutes) {
  if (minutes === null) return null;
  const { hours, remainder } = roundDrive(minutes);
  if (hours === 0) return `about ${remainder} min`;
  return remainder === 0 ? `about ${hours} hr` : `about ${hours} hr ${remainder} min`;
}

// The short form used in the spot list.
export function formatDriveShort(minutes) {
  if (minutes === null) return null;
  const { hours, remainder } = roundDrive(minutes);
  if (hours === 0) return `${remainder}m`;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

// The highest-rated day. If several tie, the soonest wins, since it's the most reliable.
export function bestDay(days) {
  let best = null;
  for (const day of days) {
    if (day.rating !== null && (best === null || day.rating > best.rating)) best = day;
  }
  return best;
}

export const bestDayInRange = (spot, rangeDays) => bestDay(spot.days.slice(0, rangeDays));

// Returns the spots to show, in order. Each spot counts as its best day in the range.
// `best` groups spots by rating, closest first within each rating.
export function applyView(forecast, view, { homeId, worthSurfingRating }) {
  const ratingOf = (spot) => bestDayInRange(spot, view.rangeDays)?.rating ?? 0;
  const driveOf = (spot) => driveMinutes(spot, homeId) ?? Infinity;

  const visible = forecast.filter((spot) => {
    if (view.worthSurfingOnly && ratingOf(spot) < worthSurfingRating) return false;
    if (view.maxDriveMinutes !== null && driveOf(spot) > view.maxDriveMinutes) return false;
    return true;
  });

  const byDrive = (a, b) => (driveOf(a) === driveOf(b) ? 0 : driveOf(a) - driveOf(b));
  if (view.sort === 'closest') return visible.sort(byDrive);
  if (view.sort === 'best') return visible.sort((a, b) => ratingOf(b) - ratingOf(a) || byDrive(a, b));
  return visible;
}

// Restores saved choices, ignoring anything unrecognized.
export function restoreView(saved) {
  const view = { ...DEFAULT_VIEW };
  if (!saved || typeof saved !== 'object') return view;
  if (RANGES.some((range) => range.days === saved.rangeDays)) view.rangeDays = saved.rangeDays;
  if (Object.hasOwn(SORTS, saved.sort)) view.sort = saved.sort;
  if (saved.worthSurfingOnly === true) view.worthSurfingOnly = true;
  if (DRIVE_LIMITS.some((limit) => limit.minutes === saved.maxDriveMinutes)) {
    view.maxDriveMinutes = saved.maxDriveMinutes;
  }
  return view;
}
