// Draws the page. The spot list is the home view; `#cocoa-beach` opens that spot's forecast,
// so the back button works and a spot can be linked to directly.

import { buoys } from '../buoys.js';
import { settings } from '../settings.js';
import { spots } from '../spots.js';
import { LOW } from './confidence.js';
import {
  ALL_DAY,
  applyView,
  bestDay,
  bestDayInRange,
  bestTimeToGo,
  driveMinutes,
  DRIVE_LIMITS,
  formatDrive,
  formatDriveShort,
  RANGES,
  restoreView,
  slotForTime,
  SORTS,
  TIMES,
} from './filters.js';
import { icon } from './icons.js';
import { landPath, layoutPins, MAP_HEIGHT, MAP_WIDTH, toX, toY } from './map.js';
import { loadForecast } from './pipeline.js';
import { ratingLabel } from './rating.js';

const main = document.querySelector('#main');
const status = document.querySelector('#status');

const profile = settings.profiles[settings.activeProfile];
const home = settings.homes[profile.home];
const MISSING = '–';
const STORAGE_KEY = 'surf-radar-view';
const TIME_ICONS = { morning: 'sunrise', midday: 'sun', evening: 'sunset', [ALL_DAY]: 'allDay' };

let forecast = null;
let view = restoreView(readSavedView());

function readSavedView() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function saveView() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(view));
  } catch {
    // Private browsing can block storage. The controls still work, they just won't be remembered.
  }
}

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

const formatFt = (value) => (Number.isFinite(value) ? `${value.toFixed(1)} ft` : MISSING);
// One decimal, because small period differences can change the rating.
const formatPeriod = (value) => (Number.isFinite(value) ? `${value.toFixed(1)} s` : MISSING);

function compass(degrees) {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return names[Math.round(degrees / 45) % 8];
}

function formatWind({ speedMph, directionDeg }) {
  if (!Number.isFinite(speedMph)) return MISSING;
  const direction = Number.isFinite(directionDeg) ? `${compass(directionDeg)} ` : '';
  return `${direction}${Math.round(speedMph)} mph`;
}

// Noon UTC keeps the date from sliding a day when formatted.
function formatDate(date, options) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

function dayName(day) {
  if (day.dayIndex === 0) return 'Today';
  return formatDate(day.date, { weekday: 'short' });
}

function ratingBadge(rating) {
  const value = rating ?? MISSING;
  return `<span class="badge badge-${rating ?? 'none'}" role="img" aria-label="Rating ${value} of 5, ${ratingLabel(rating)}">${value}</span>`;
}

function windowHours({ startHour, endHour }) {
  const hour = (value) => `${value % 12 || 12} ${value < 12 ? 'am' : 'pm'}`;
  return `${hour(startHour)}–${hour(endHour)}`;
}

const windowName = (slot) => profile.windows[slot.name].label.toLowerCase();
const unsureNote = (slot) => (slot.confidence === LOW ? ' (unsure)' : '');

const windNote = (slot) =>
  slot.windWarning ? `<span class="wind-warning">${icon('wind', 14)} ${slot.windWarning}</span>` : '';

// "this morning", "midday today" or "Sat evening".
function whenWithTime(day, slot) {
  if (day.dayIndex > 0) return `${dayName(day)} ${windowName(slot)}`;
  return slot.name === 'midday' ? 'midday today' : `this ${windowName(slot)}`;
}

// Reads as a phrase: "Good on Tue", "Fair today", "Great Sat evening", "Skip it all 5 days".
function ratingPhrase(best, rangeDays, time) {
  if (!best) return ratingLabel(null);
  const { day, slot } = best;
  const label = ratingLabel(slot.rating);
  if (slot.past) return `Earlier today: ${label}`;
  if (slot.tooLate) return `Too late to drive today: ${label}`;
  if (slot.rating === 1) return rangeDays > 1 ? `${label} all ${rangeDays} days` : `${label} today`;
  if (time === ALL_DAY) return `${label} ${whenWithTime(day, slot)}${unsureNote(slot)}`;
  const when = day.dayIndex === 0 ? 'today' : `on ${dayName(day)}`;
  return `${label} ${when}${unsureNote(slot)}`;
}

function bestDayText(spot) {
  const best = bestDay(spot.days, view.time);
  if (!best) return '';
  const { day, slot } = best;
  if (slot.rating === 1) return 'No day above 1 this week';
  const when = view.time === ALL_DAY ? whenWithTime(day, slot) : dayName(day);
  return `Best: ${when}, rated ${slot.rating}${unsureNote(slot)}`;
}

function driveText(spot) {
  const drive = formatDrive(driveMinutes(spot, profile.home));
  return drive ? `${drive[0].toUpperCase()}${drive.slice(1)} from ${escapeHtml(home.label)}` : '';
}

const pickOptions = () => ({
  homeId: profile.home,
  worthSurfingRating: profile.worthSurfingRating,
});

function renderTopPick() {
  const pick = bestTimeToGo(forecast, view, pickOptions());
  if (!pick) {
    const days = view.rangeDays === 1 ? 'today' : `in the next ${view.rangeDays} days`;
    return `
      <div class="top-pick top-pick-none">
        <span class="top-pick-label">Best time to go</span>
        <strong class="top-pick-title">Nothing rated ${profile.worthSurfingRating}+ ${days}</strong>
        <span>Try looking further ahead or allowing a longer drive.</span>
      </div>`;
  }
  const { spot, day, slot } = pick;
  const drive = formatDriveShort(driveMinutes(spot, profile.home));
  return `
    <a class="top-pick" href="#${escapeHtml(spot.id)}">
      <svg class="top-pick-waves" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 30c40-22 70-22 110 0s70 22 110 0 70-22 110 0 50 16 70 8v22H0Z" fill="#fff" opacity=".07"/>
        <path d="M0 44c50-16 80-16 125 0s75 16 125 0 85-16 150 0v16H0Z" fill="#fff" opacity=".09"/>
      </svg>
      <span class="top-pick-text">
        <span class="top-pick-label">Best time to go</span>
        <strong class="top-pick-title">${escapeHtml(spot.name)}</strong>
        <span class="top-pick-when">${whenWithTime(day, slot)}${unsureNote(slot)}</span>
        <span class="top-pick-stats">
          <span>${icon('wave')} ${formatFt(slot.final.waveHeightFt)} at ${formatPeriod(slot.final.swellPeriodS)}</span>
          ${drive ? `<span>${icon('car')} ${drive}</span>` : ''}
        </span>
        ${windNote(slot)}
      </span>
      <span class="top-pick-rating">
        ${ratingBadge(slot.rating)}
        <span>${ratingLabel(slot.rating)}</span>
      </span>
    </a>`;
}

function renderCams(spot) {
  const search = encodeURIComponent(`${spot.name} Florida live beach cam`);
  const links = [
    ...(spot.cams ?? []),
    // sp= limits the results to streams that are live right now.
    { label: 'Search live cams on YouTube', url: `https://www.youtube.com/results?search_query=${search}&sp=EgJAAQ%253D%253D` },
  ];
  return `
    <section>
      <h2>${icon('camera', 18)} See it live</h2>
      <ul class="cam-list">
        ${links
          .map(
            ({ label, url }) =>
              `<li><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><span>${escapeHtml(label)}</span>${icon('external', 15)}</a></li>`,
          )
          .join('')}
      </ul>
      <p class="intro">Free public cams on other sites. Some have ads or go offline.</p>
    </section>`;
}

// Every spot gets the same tropical flags, so any spot can supply the list.
function tropicalBanner() {
  const texts = [...new Set(forecast[0].days.flatMap((day) => day.flags.map((flag) => flag.text)))];
  if (!texts.length) return '';
  return `
    <div class="tropical-banner" role="status">
      ${icon('storm', 22)}
      <p>
        <strong>${texts.map(escapeHtml).join('<br />')}</strong><br />
        Waves may build before the models show it. The Bahamas often block swell south of Jupiter.
        <a href="https://www.nhc.noaa.gov/">National Hurricane Center</a>
      </p>
    </div>`;
}

function chip(label, attributes, iconName) {
  return `<button type="button" class="chip" ${attributes}>${iconName ? icon(iconName, 15) : ''}<span>${label}</span></button>`;
}

function controlRow(label, chips, segmented = false) {
  return `
    <div class="control-row" role="group" aria-label="${label}">
      <span class="control-label">${label}</span>
      <div class="${segmented ? 'segments' : 'chips'}">${chips}</div>
    </div>`;
}

const timeRow = () =>
  controlRow(
    'When can you go?',
    TIMES.map(({ id, label }) => chip(label, `data-time="${id}"`, TIME_ICONS[id])).join(''),
    true,
  );

function renderControls() {
  const ranges = RANGES.map(({ days, label }) => chip(label, `data-range="${days}"`)).join('');
  const sorts = Object.entries(SORTS)
    .map(([value, label]) => chip(label, `data-sort="${value}"`))
    .join('');
  const filters = [
    chip(`Rated ${profile.worthSurfingRating}+`, 'data-worth="true"'),
    ...DRIVE_LIMITS.map(({ minutes, label }) => chip(label, `data-drive="${minutes}"`)),
  ].join('');

  return `
    ${tropicalBanner()}
    <div id="top-pick"></div>
    <div class="controls">
      ${timeRow()}
      ${controlRow('Look ahead', ranges, true)}
    </div>
    <div class="list-head">
      <details class="more-controls">
        <summary>${icon('sliders', 15)}<span id="filter-summary"></span></summary>
        <div class="controls">
          ${controlRow('Sort', sorts)}
          ${controlRow('Only show', filters)}
        </div>
      </details>
      <div class="segments display-toggle" role="group" aria-label="Show as">
        ${chip('List', 'data-display="list"', 'list')}
        ${chip('Map', 'data-display="map"', 'map')}
      </div>
    </div>
    <p class="intro" id="list-summary" aria-live="polite"></p>
    <div id="spot-results"></div>`;
}

function renderSpotRow(spot) {
  const best = bestDayInRange(spot, view.rangeDays, view.time);
  const final = best?.slot.final;
  const drive = formatDriveShort(driveMinutes(spot, profile.home));
  return `
    <li>
      <a class="spot-row" href="#${escapeHtml(spot.id)}">
        ${ratingBadge(best?.slot.rating ?? null)}
        <span class="row-text">
          <span class="row-line">
            <strong>${escapeHtml(spot.name)}</strong>
            <strong class="row-value">${formatFt(final?.waveHeightFt)}</strong>
          </span>
          <span class="row-line row-detail">
            <span>${ratingPhrase(best, view.rangeDays, view.time)}${drive ? ` · <span class="row-drive">${icon('car', 14)} ${drive}</span>` : ''}</span>
            <span class="row-value">${formatPeriod(final?.swellPeriodS)}</span>
          </span>
          ${best ? windNote(best.slot) : ''}
        </span>
      </a>
    </li>`;
}

function renderMap(visible) {
  const visibleIds = new Set(visible.map((spot) => spot.id));
  const pick = bestTimeToGo(forecast, view, pickOptions());
  const pins = layoutPins(forecast.filter((spot) => visibleIds.has(spot.id)));

  const pinMarkup = pins
    .map(({ spot, x, y }) => {
      const best = bestDayInRange(spot, view.rangeDays, view.time);
      const rating = best?.slot.rating ?? null;
      const summary = `${spot.name}: ${ratingPhrase(best, view.rangeDays, view.time)}`;
      const isPick = pick?.spot.id === spot.id;
      return `
        <a href="#${escapeHtml(spot.id)}" class="map-pin" aria-label="${escapeHtml(summary)}">
          <title>${escapeHtml(summary)}</title>
          <rect x="${x - 14}" y="${y - 10}" width="${MAP_WIDTH - x + 14}" height="20" fill="transparent" />
          ${isPick ? `<circle cx="${x}" cy="${y}" r="13" class="map-pick-ring" />` : ''}
          <circle cx="${x}" cy="${y}" r="9.5" class="map-dot badge-fill-${rating ?? 'none'}" />
          <text x="${x}" y="${y + 3.8}" text-anchor="middle" class="map-number badge-text-${rating ?? 'none'}">${rating ?? MISSING}</text>
          <text x="${x + 15}" y="${y + 4}" class="map-label${isPick ? ' map-label-pick' : ''}">${escapeHtml(spot.name)}</text>
        </a>`;
    })
    .join('');

  const legend = [1, 2, 3, 4, 5]
    .map((rating) => `<span>${ratingBadge(rating)} ${ratingLabel(rating)}</span>`)
    .join('');

  const doralX = toX(home.lon);
  const doralY = toY(home.lat);

  return `
    <div class="map-card">
      <svg viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT.toFixed(0)}" role="group" aria-label="Map of the spots along the coast">
        <defs>
          <linearGradient id="sea" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stop-color="#bfe3e4" />
            <stop offset="1" stop-color="#e3f3f1" />
          </linearGradient>
        </defs>
        <rect width="${MAP_WIDTH}" height="${MAP_HEIGHT}" fill="url(#sea)" />
        <g class="map-swells" fill="none" stroke="#8cc7ca" stroke-width="1.4" stroke-linecap="round">
          <path d="M292 180c5-5 9-5 14 0s9 5 14 0" />
          <path d="M285 316c5-5 9-5 14 0s9 5 14 0" />
          <path d="M318 368c5-5 9-5 14 0s9 5 14 0" />
          <path d="M300 530c5-5 9-5 14 0s9 5 14 0" />
        </g>
        <path d="${landPath()}" fill="#f1e3c6" stroke="#d9c49a" stroke-width="1.5" />
        <g aria-hidden="true">
          <text x="24" y="130" class="map-region">Florida</text>
          <g transform="translate(46 240)" fill="none" stroke="#7c9a6a" stroke-width="2" stroke-linecap="round">
            <path d="M0 26c1-9 2-15 6-22" stroke="#9a7f55" />
            <path d="M6 4c-5-3-10-2-13 2M6 4c-2-5-7-7-11-5M6 4c3-5 8-6 12-3M6 4c5-1 9 1 11 6M6 4c0 3-1 6-3 8" />
          </g>
          <g transform="translate(62 395)" fill="none" stroke="#7c9a6a" stroke-width="2" stroke-linecap="round">
            <path d="M0 22c1-8 2-13 5-19" stroke="#9a7f55" />
            <path d="M5 3c-4-3-9-2-11 2M5 3c-2-4-6-6-10-4M5 3c3-4 7-5 10-2M5 3c4-1 8 1 9 5" />
          </g>
          <text x="${MAP_WIDTH - 14}" y="52" text-anchor="end" class="map-sea">Atlantic Ocean</text>
          <g transform="translate(${MAP_WIDTH - 28} 18)" fill="none" stroke="#3f7f86" stroke-width="1.5" stroke-linecap="round">
            <path d="M0 -8 3 0 0 8-3 0Z" fill="#3f7f86" stroke="none" />
            <text x="0" y="-10" text-anchor="middle" class="map-north" stroke="none">N</text>
          </g>
        </g>
        <g aria-label="${escapeHtml(home.label)}">
          <circle cx="${doralX}" cy="${doralY}" r="4.500" class="map-home" />
          <text x="${doralX - 9}" y="${doralY + 4}" text-anchor="end" class="map-home-label">${escapeHtml(home.label)}</text>
        </g>
        ${pinMarkup}
      </svg>
      <div class="map-legend">${legend}</div>
      <p class="intro">An illustration, not to scale. Tap a spot to open it. The ring marks the best time to go.</p>
    </div>`;
}

function isSelected(button) {
  const { range, time, sort, worth, drive, display } = button.dataset;
  if (range) return Number(range) === view.rangeDays;
  if (time) return time === view.time;
  if (sort) return sort === view.sort;
  if (worth) return view.worthSurfingOnly;
  if (display) return display === view.display;
  return Number(drive) === view.maxDriveMinutes;
}

function updateChips() {
  document.querySelectorAll('.chip').forEach((button) => {
    button.setAttribute('aria-pressed', String(isSelected(button)));
  });
}

function listSummaryText() {
  const days = view.rangeDays;
  if (view.time === ALL_DAY) {
    return days === 1 ? "Today's best time to go." : `Best time to go in the next ${days} days.`;
  }
  const window = profile.windows[view.time];
  const name = window.label.toLowerCase();
  const hours = windowHours(window);
  return days === 1 ? `Today's ${name} rating (${hours}).` : `Best ${name} in the next ${days} days (${hours}).`;
}

function filterSummaryText() {
  const parts = [SORTS[view.sort]];
  if (view.worthSurfingOnly) parts.push(`rated ${profile.worthSurfingRating}+`);
  const limit = DRIVE_LIMITS.find(({ minutes }) => minutes === view.maxDriveMinutes);
  if (limit) parts.push(limit.label.toLowerCase());
  return parts.join(', ');
}

function updateList() {
  const visible = applyView(forecast, view, pickOptions());

  updateChips();
  document.querySelector('#top-pick').innerHTML = renderTopPick();
  document.querySelector('#filter-summary').textContent = filterSummaryText();

  const countText = visible.length === forecast.length ? '' : ` ${visible.length} of ${forecast.length} spots.`;
  document.querySelector('#list-summary').textContent = `${listSummaryText()}${countText}`;

  let results = '<p class="message">No spots match. Try looking further ahead or removing a filter.</p>';
  if (visible.length) {
    results = view.display === 'map'
      ? renderMap(visible)
      : `<ul class="spot-list">${visible.map(renderSpotRow).join('')}</ul>`;
  }
  document.querySelector('#spot-results').innerHTML = results;
}

function renderList() {
  main.innerHTML = renderControls();
  updateList();
  document.title = 'Surf Radar';
}

function stat(iconName, label, value) {
  return `<div>${icon(iconName, 18)}<dt>${label}</dt><dd>${value}</dd></div>`;
}

function renderNow(spot) {
  if (!spot.now) return '';
  return `
    <section class="now">
      <h2>${icon('wave', 18)} Forecast right now</h2>
      <dl>
        ${stat('wave', 'Waves', formatFt(spot.now.waveHeightFt))}
        ${stat('timer', 'Swell period', formatPeriod(spot.now.swellPeriodS))}
        ${stat('wind', 'Wind', formatWind(spot.now.wind))}
      </dl>
    </section>`;
}

function timeAgo(isoTime) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(isoTime)) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hr ago`;
}

function buoyExplanation(spot) {
  const { bias } = spot.buoy;
  const { fadeHours, maxAgeHours } = settings.buoyCorrection;
  if (!bias) return `No reading in the last ${maxAgeHours} hours, so the forecast isn't adjusted.`;
  const percent = Math.round((spot.nowFactor - 1) * 100);
  const comparison = `Models read ${formatFt(bias.modelFt)} at this buoy, against a recent average of ${formatFt(bias.measuredFt)} measured.`;
  if (Math.abs(percent) < 3) return `${comparison} That's close, so this forecast barely changes.`;
  const direction = percent < 0 ? 'down' : 'up';
  return `${comparison} This forecast is adjusted ${direction} ${Math.abs(percent)}% now, fading out over ${fadeHours} hours.`;
}

function renderBuoy(spot) {
  if (!spot.buoy) return '';
  const { latest, name, id, distanceKm } = spot.buoy;
  const direction = Number.isFinite(latest.directionDeg) ? `From ${compass(latest.directionDeg)}` : MISSING;
  const period = Number.isFinite(latest.dominantPeriodS) ? `${Math.round(latest.dominantPeriodS)} s` : MISSING;
  return `
    <section class="now">
      <h2>${icon('buoy', 18)} Nearest buoy</h2>
      <p class="intro">${escapeHtml(name)} (${escapeHtml(id)}), ${Math.round(distanceKm)} km away. Measured ${timeAgo(latest.time)}.</p>
      <dl>
        ${stat('wave', 'Waves', formatFt(latest.waveHeightFt))}
        ${stat('timer', 'Main period', period)}
        ${stat('wind', 'Direction', direction)}
      </dl>
      <p class="buoy-note">${buoyExplanation(spot)}</p>
    </section>`;
}

function renderWindowLine(slot) {
  const label = profile.windows[slot.name].label;
  return `
    <li>
      ${icon(TIME_ICONS[slot.name], 15)}
      <span><strong>${label}:</strong> rated ${slot.rating ?? MISSING} · ${formatFt(slot.final.waveHeightFt)} · ${formatPeriod(slot.final.swellPeriodS)} · ${formatWind(slot.wind)}${slot.windWarning ? ` · <span class="wind-warning-inline">${slot.windWarning}</span>` : ''}</span>
    </li>`;
}

function renderDay(day) {
  const slot = slotForTime(day, view.time);
  const date = `${dayName(day)}, ${formatDate(day.date, { month: 'short', day: 'numeric' })}`;
  const timeNote = slot.past
    ? ' · passed'
    : slot.tooLate
      ? ' · too late today'
      : view.time === ALL_DAY
        ? ` · ${windowName(slot)}`
        : '';
  const spreadNote = Number.isFinite(slot.spreadFt)
    ? `<p>Models differ by ${slot.spreadFt.toFixed(1)} ft for the ${windowName(slot)}.</p>`
    : '';
  return `
    <li>
      <details class="day">
        <summary>
          ${ratingBadge(slot.rating)}
          <span class="row-text">
            <span class="row-line">
              <strong>${date}</strong>
              <strong class="row-value">${formatFt(slot.final.waveHeightFt)}</strong>
            </span>
            <span class="row-line row-detail">
              <span>${slot.confidence}${timeNote}</span>
              <span class="row-value">${formatPeriod(slot.final.swellPeriodS)} · ${formatWind(slot.wind)}</span>
            </span>
            ${windNote(slot)}
            ${day.flags.map((flag) => `<span class="day-flag">${icon('storm', 14)} ${escapeHtml(flag.text)}</span>`).join('')}
          </span>
        </summary>
        <div class="day-more">
          <ul>${Object.values(day.slots).map(renderWindowLine).join('')}</ul>
          ${spreadNote}
        </div>
      </details>
    </li>`;
}

function renderSpot(spot) {
  main.innerHTML = `
    <a class="back" href="#">${icon('back')} All spots</a>
    <h1 class="spot-title">${escapeHtml(spot.name)}</h1>
    <p class="spot-summary">
      <span id="spot-best">${bestDayText(spot)}</span><br />
      <span class="spot-drive">${icon('car', 15)} ${driveText(spot)}</span>
    </p>
    ${tropicalBanner()}
    ${renderCams(spot)}
    ${renderNow(spot)}
    ${renderBuoy(spot)}
    <section>
      <h2>${icon('sun', 18)} Day by day</h2>
      <div class="controls">${timeRow()}</div>
      <p class="intro">Tap a day to compare morning, midday and evening. Wind doesn't affect the rating.</p>
      <ol class="day-list" id="day-list">${spot.days.map(renderDay).join('')}</ol>
    </section>`;
  updateChips();
  document.title = `${spot.name} – Surf Radar`;
}

const currentSpot = () => {
  const id = decodeURIComponent(location.hash.slice(1));
  return forecast.find((candidate) => candidate.id === id);
};

function render() {
  if (!forecast) return;
  const spot = currentSpot();
  if (spot) renderSpot(spot);
  else renderList();
  window.scrollTo(0, 0);
}

// Redraws only what the controls affect, so the page doesn't jump.
function refresh() {
  const spot = currentSpot();
  if (!spot) {
    updateList();
    return;
  }
  document.querySelector('#spot-best').textContent = bestDayText(spot);
  document.querySelector('#day-list').innerHTML = spot.days.map(renderDay).join('');
  updateChips();
}

// The controls get redrawn with each view, so listen on the container that stays put.
main.addEventListener('click', (event) => {
  const button = event.target.closest('.chip');
  if (!button) return;
  const { range, time, sort, worth, drive, display } = button.dataset;
  if (range) view.rangeDays = Number(range);
  else if (time) view.time = time;
  else if (sort) view.sort = sort;
  else if (worth) view.worthSurfingOnly = !view.worthSurfingOnly;
  else if (display) view.display = display;
  else view.maxDriveMinutes = Number(drive) === view.maxDriveMinutes ? null : Number(drive);
  saveView();
  refresh();
});

async function load() {
  main.innerHTML = `
    <div class="message loading">
      <svg viewBox="0 0 120 30" width="120" height="30" aria-hidden="true"><path d="M0 15c15-14 25-14 40 0s25 14 40 0 25-14 40 0" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>
      <p>Checking the waves…</p>
    </div>`;
  status.textContent = '';
  try {
    forecast = await loadForecast(spots, buoys, settings);
    const time = new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(new Date());
    const hasWind = forecast.some((spot) => Number.isFinite(spot.days[0].wind.morning.speedMph));
    status.textContent = `Updated ${time}${hasWind ? '' : ' · Wind unavailable'}`;
    render();
  } catch (error) {
    console.error(error);
    main.innerHTML = `
      <div class="message">
        <p>Couldn't load the forecast. Check your connection and try again.</p>
        <button type="button" id="retry">Try again</button>
      </div>`;
    document.querySelector('#retry').addEventListener('click', load);
  }
}

document.querySelector('#model-name').textContent = settings.models
  .map((model) => model.label)
  .join(', ');

window.addEventListener('hashchange', render);
load();
