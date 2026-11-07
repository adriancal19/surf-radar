// Sorting and filtering for the spot list, plus the drive time and best-time helpers.
// No page drawing here, so it's easy to test.

import { LOW } from './confidence.js';

// How far ahead to look, counting today. "3 days" is today, tomorrow and the day after.
export const RANGES = [
  { days: 1, label: 'Today' },
  { days: 3, label: '3 days' },
  { days: 5, label: '5 days' },
  { days: 7, label: '7 days' },
];

// `all` finds the best time of day. The others match the windows in settings.js.
export const ALL_DAY = 'all';
export const TIMES = [
  { id: 'morning', label: 'Morning' },
  { id: 'midday', label: 'Midday' },
  { id: 'evening', label: 'Evening' },
  { id: ALL_DAY, label: 'All day' },
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

// How many single days you can pick from, starting today.
export const PICKABLE_DAYS = 7;

// The default answers "when should I go?": any time, over the days with useful confidence.
// `dates` holds days picked one by one ('2026-11-11'). When it's set, it replaces the range.
export const DEFAULT_VIEW = {
  rangeDays: 5,
  dates: null,
  time: ALL_DAY,
  sort: 'best',
  worthSurfingOnly: false,
  maxDriveMinutes: null,
  display: 'list',
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

// A time you can no longer make: it's over, or the drive would use up too much of it.
export const isOutOfReach = (slot) => Boolean(slot?.past || slot?.tooLate);

// One day's conditions for the chosen time. For all day, that's its highest-scoring window
// you can still reach. If windows tie, the earliest wins.
export function slotForTime(day, time) {
  if (time !== ALL_DAY) return day.slots[time];
  const slots = Object.values(day.slots);
  const upcoming = slots.filter((slot) => !isOutOfReach(slot));
  const choices = upcoming.length ? upcoming : slots;
  return choices.reduce(
    (best, slot) => ((slot.score ?? -Infinity) > (best.score ?? -Infinity) ? slot : best),
    choices[0],
  );
}

function highestRated(days, time) {
  let best = null;
  for (const day of days) {
    const slot = slotForTime(day, time);
    if (Number.isFinite(slot?.rating) && (best === null || slot.rating > best.slot.rating)) {
      best = { day, slot };
    }
  }
  return best;
}

// The highest-rated day for the chosen time, as { day, slot }. If several days tie, the
// soonest wins, since it's the most reliable. Times out of reach only count if nothing
// else is left.
export function bestDay(days, time) {
  const upcoming = days.filter((day) => !isOutOfReach(slotForTime(day, time)));
  return highestRated(upcoming, time) ?? highestRated(days, time);
}

export const bestDayInRange = (spot, rangeDays, time) => bestDay(spot.days.slice(0, rangeDays), time);

// The days the view covers: the picked days if there are any, otherwise the range.
export function daysInView(days, view) {
  if (view.dates?.length) return days.filter((day) => view.dates.includes(day.date));
  return days.slice(0, view.rangeDays);
}

export const bestDayInView = (spot, view) => bestDay(daysInView(spot.days, view), view.time);

// Tapping a day. Coming from a range, it starts a new pick with just that day, which answers
// "I'm only free Wednesday". After that, each tap adds or removes a day. Removing the last
// day goes back to the range. Picked days stay in calendar order.
export function toggleDate(view, date, allDates) {
  if (!view.dates) return { ...view, dates: [date] };
  const dates = view.dates.includes(date)
    ? view.dates.filter((picked) => picked !== date)
    : [...view.dates, date];
  return { ...view, dates: dates.length ? allDates.filter((candidate) => dates.includes(candidate)) : null };
}

// Drops picked days that have gone by or aren't in the forecast, such as ones saved last week.
export function keepKnownDates(view, allDates) {
  if (!view.dates) return view;
  const dates = view.dates.filter((date) => allDates.includes(date));
  return { ...view, dates: dates.length ? dates : null };
}

// The single best outing within the chosen time, range and drive, as { spot, day, slot }.
// Times out of reach and low-confidence days don't count, and neither does anything
// rated below "worth surfing", so this can honestly answer that nothing is worth it.
// Highest rating wins. Among equals: no wind warning, then the shorter drive, then the sooner day.
export function bestTimeToGo(forecast, view, { homeId, worthSurfingRating }) {
  const driveOf = (spot) => driveMinutes(spot, homeId) ?? Infinity;
  const options = [];
  for (const spot of forecast) {
    if (view.maxDriveMinutes !== null && driveOf(spot) > view.maxDriveMinutes) continue;
    for (const day of daysInView(spot.days, view)) {
      const slots = view.time === ALL_DAY ? Object.values(day.slots) : [day.slots[view.time]];
      for (const slot of slots) {
        if (slot && !isOutOfReach(slot) && slot.confidence !== LOW && slot.rating >= worthSurfingRating) {
          options.push({ spot, day, slot });
        }
      }
    }
  }
  options.sort(
    (a, b) =>
      b.slot.rating - a.slot.rating ||
      Number(Boolean(a.slot.windWarning)) - Number(Boolean(b.slot.windWarning)) ||
      (driveOf(a.spot) === driveOf(b.spot) ? 0 : driveOf(a.spot) - driveOf(b.spot)) ||
      a.day.dayIndex - b.day.dayIndex,
  );
  return options[0] ?? null;
}

// Returns the spots to show, in order. Each spot counts as its best day in the range.
// `best` groups spots by rating, closest first within each rating.
export function applyView(forecast, view, { homeId, worthSurfingRating }) {
  const ratingOf = (spot) => bestDayInView(spot, view)?.slot.rating ?? 0;
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
  if (Array.isArray(saved.dates)) {
    const dates = saved.dates.filter((date) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date));
    if (dates.length) view.dates = dates;
  }
  if (TIMES.some((time) => time.id === saved.time)) view.time = saved.time;
  if (Object.hasOwn(SORTS, saved.sort)) view.sort = saved.sort;
  if (saved.worthSurfingOnly === true) view.worthSurfingOnly = true;
  if (saved.display === 'map') view.display = 'map';
  if (DRIVE_LIMITS.some((limit) => limit.minutes === saved.maxDriveMinutes)) {
    view.maxDriveMinutes = saved.maxDriveMinutes;
  }
  return view;
}
