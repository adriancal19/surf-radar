// Decides what to email and writes the emails. No fetching or sending here, so it's easy
// to test. `sent` remembers what's gone out: { key: time sent }.

import { driveMinutes, formatDrive } from './filters.js';
import { ratingLabel } from './rating.js';

const STATE_KEEP_DAYS = 30;
const NHC_URL = 'https://www.nhc.noaa.gov/';

const dayText = (date, options) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(new Date(`${date}T12:00:00Z`));

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

// Spots rated well enough, 3 days out, that haven't been emailed yet. Best first, then closest.
export function findSurfAlerts(forecast, settings, sent) {
  const { daysAhead, minRating, windows } = settings.alerts;
  const homeId = settings.profiles[settings.activeProfile].home;
  const alerts = [];
  for (const spot of forecast) {
    const day = spot.days[daysAhead];
    if (!day) continue;
    for (const windowName of windows) {
      const slot = day.slots[windowName];
      const key = `surf|${spot.id}|${day.date}|${windowName}`;
      if (slot?.rating >= minRating && !sent[key]) alerts.push({ key, spot, day, slot });
    }
  }
  const drive = (alert) => driveMinutes(alert.spot, homeId) ?? Infinity;
  const windy = (alert) => Number(Boolean(alert.slot.windWarning));
  return alerts.sort(
    (a, b) => b.slot.rating - a.slot.rating || windy(a) - windy(b) || drive(a) - drive(b),
  );
}

// One entry per spot, best spot first. Each spot's first alert is its best window.
function groupBySpot(alerts) {
  const groups = new Map();
  for (const alert of alerts) {
    if (!groups.has(alert.spot.id)) groups.set(alert.spot.id, []);
    groups.get(alert.spot.id).push(alert);
  }
  return [...groups.values()];
}

export function buildSurfEmail(alerts, settings) {
  const profile = settings.profiles[settings.activeProfile];
  const home = settings.homes[profile.home];
  const date = alerts[0].day.date;
  const dayLong = dayText(date, { weekday: 'long', month: 'short', day: 'numeric' });

  const groups = groupBySpot(alerts);
  const place = groups.length === 1 ? groups[0][0].spot.name : `${groups[0][0].spot.name} and ${groups.length - 1} more`;
  const subject = `Surf alert: ${place} on ${dayText(date, { weekday: 'long' })}`;

  const shown = groups.slice(0, settings.alerts.maxSpots);
  const hiddenCount = groups.length - shown.length;

  const lines = shown.map((group) => {
    const { spot, slot: best } = group[0];
    const windows = settings.alerts.windows
      .map((name) => group.find((alert) => alert.slot.name === name))
      .filter(Boolean)
      .map((alert) => `${profile.windows[alert.slot.name].label} rated ${alert.slot.rating}`)
      .join(', ');
    const size = `${best.final.waveHeightFt.toFixed(1)} ft at ${best.final.swellPeriodS?.toFixed(1) ?? '?'} s`;
    const drive = formatDrive(driveMinutes(spot, profile.home));
    const parts = [
      `${windows} (${ratingLabel(best.rating)})`,
      size,
      best.confidence,
      drive && `${drive[0].toUpperCase()}${drive.slice(1)} from ${home.label}`,
      best.windWarning,
    ];
    return {
      url: `${settings.siteUrl}#${spot.id}`,
      title: spot.name,
      detail: `${parts.filter(Boolean).join('. ')}.`,
    };
  });

  const intro = `Forecast for ${dayLong}, 3 days out:`;
  const more = hiddenCount > 0 ? `Plus ${hiddenCount} more ${hiddenCount === 1 ? 'spot' : 'spots'} on the site.` : '';
  const closing = 'This is a forecast, not a guarantee. Check again closer to the day.';
  return {
    subject,
    text: [
      intro,
      '',
      ...lines.flatMap((line) => [line.title, line.detail, line.url, '']),
      ...(more ? [`${more} ${settings.siteUrl}`, ''] : []),
      closing,
    ].join('\n'),
    html: [
      `<p>${escapeHtml(intro)}</p>`,
      ...lines.map(
        (line) => `<p><a href="${escapeHtml(line.url)}"><strong>${escapeHtml(line.title)}</strong></a><br>${escapeHtml(line.detail)}</p>`,
      ),
      ...(more ? [`<p><a href="${escapeHtml(settings.siteUrl)}">${escapeHtml(more)}</a></p>`] : []),
      `<p>${escapeHtml(closing)}</p>`,
    ].join('\n'),
  };
}

const tropicalKey = (system) => `tropical|${system.id}`;

export function findTropicalAlerts(systems, sent) {
  return systems.filter((system) => !sent[tropicalKey(system)]).map((system) => ({ key: tropicalKey(system), system }));
}

export function buildTropicalEmail(alerts, settings) {
  const systems = alerts.map((alert) => alert.system);
  const subject = `Tropical heads-up: ${systems.map((system) => system.name).join(', ')}`;
  const lines = systems.map((system) =>
    system.kind === 'storm'
      ? `${system.name}, near ${system.position}.`
      : `${system.name}, with a ${system.chance7Day}% chance of forming within 7 days.`,
  );
  const note =
    'This could send swell our way, possibly before the wave models show it. The Bahamas often block swell from reaching spots south of Jupiter.';
  return {
    subject,
    text: [...lines, '', note, '', `Forecast: ${settings.siteUrl}`, `National Hurricane Center: ${NHC_URL}`].join('\n'),
    html: [
      ...lines.map((line) => `<p><strong>${escapeHtml(line)}</strong></p>`),
      `<p>${escapeHtml(note)}</p>`,
      `<p><a href="${escapeHtml(settings.siteUrl)}">Forecast</a> · <a href="${NHC_URL}">National Hurricane Center</a></p>`,
    ].join('\n'),
  };
}

export function markSent(sent, alerts, now) {
  const updated = { ...sent };
  for (const alert of alerts) updated[alert.key] = now.toISOString();
  return updated;
}

// Old entries can't come up again, so the record doesn't need to keep growing.
export function pruneSent(sent, now) {
  const cutoff = now - STATE_KEEP_DAYS * 24 * 3600000;
  return Object.fromEntries(Object.entries(sent).filter(([, time]) => new Date(time) >= cutoff));
}
