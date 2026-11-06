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
  return alerts.sort((a, b) => b.slot.rating - a.slot.rating || drive(a) - drive(b));
}

export function buildSurfEmail(alerts, settings) {
  const profile = settings.profiles[settings.activeProfile];
  const home = settings.homes[profile.home];
  const date = alerts[0].day.date;
  const dayLong = dayText(date, { weekday: 'long', month: 'short', day: 'numeric' });

  const names = [...new Set(alerts.map((alert) => alert.spot.name))];
  const place = names.length === 1 ? names[0] : `${names[0]} and ${names.length - 1} more`;
  const subject = `Surf alert: ${place} on ${dayText(date, { weekday: 'long' })}`;

  const lines = alerts.map(({ spot, slot }) => {
    const window = profile.windows[slot.name].label.toLowerCase();
    const size = `${slot.final.waveHeightFt.toFixed(1)} ft at ${slot.final.swellPeriodS?.toFixed(1) ?? '?'} s`;
    const drive = formatDrive(driveMinutes(spot, profile.home));
    return {
      url: `${settings.siteUrl}#${spot.id}`,
      title: `${spot.name}, ${window}`,
      detail: `Rated ${slot.rating} (${ratingLabel(slot.rating)}), ${size}. ${slot.confidence}.${drive ? ` ${drive[0].toUpperCase()}${drive.slice(1)} from ${home.label}.` : ''}`,
    };
  });

  const intro = `Forecast for ${dayLong}, 3 days out:`;
  const closing = 'This is a forecast, not a guarantee. Check again closer to the day.';
  return {
    subject,
    text: [intro, '', ...lines.flatMap((line) => [line.title, line.detail, line.url, '']), closing].join('\n'),
    html: [
      `<p>${escapeHtml(intro)}</p>`,
      ...lines.map(
        (line) => `<p><a href="${escapeHtml(line.url)}"><strong>${escapeHtml(line.title)}</strong></a><br>${escapeHtml(line.detail)}</p>`,
      ),
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
