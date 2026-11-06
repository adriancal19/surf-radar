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
import { loadForecast } from './pipeline.js';
import { ratingLabel } from './rating.js';

const main = document.querySelector('#main');
const status = document.querySelector('#status');

const profile = settings.profiles[settings.activeProfile];
const home = settings.homes[profile.home];
const MISSING = '–';
const STORAGE_KEY = 'surf-radar-view';

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

function chip(label, attributes) {
  return `<button type="button" class="chip" ${attributes}>${label}</button>`;
}

function controlRow(label, chips) {
  return `
    <div class="control-row" role="group" aria-label="${label}">
      <span class="control-label">${label}</span>
      <div class="chips">${chips}</div>
    </div>`;
}

const timeRow = () =>
  controlRow(
    'When can you go?',
    TIMES.map(({ id, label }) => chip(label, `data-time="${id}"`)).join(''),
  );

// Every spot gets the same tropical flags, so any spot can supply the list.
function tropicalBanner() {
  const texts = [...new Set(forecast[0].days.flatMap((day) => day.flags.map((flag) => flag.text)))];
  if (!texts.length) return '';
  return `
    <p class="tropical-banner" role="status">
      <strong>${texts.map(escapeHtml).join('<br />')}</strong><br />
      Waves may build before the models show it. The Bahamas often block swell south of Jupiter.
      <a href="https://www.nhc.noaa.gov/">National Hurricane Center</a>
    </p>`;
}

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
    <div class="controls">
      ${timeRow()}
      ${controlRow('Look ahead', ranges)}
      <details class="more-controls">
        <summary>Sort and filter: <span id="filter-summary"></span></summary>
        <div class="controls">
          ${controlRow('Sort', sorts)}
          ${controlRow('Only show', filters)}
        </div>
      </details>
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
            <span>${ratingPhrase(best, view.rangeDays, view.time)}${drive ? ` · ${drive} drive` : ''}</span>
            <span class="row-value">${formatPeriod(final?.swellPeriodS)}</span>
          </span>
        </span>
      </a>
    </li>`;
}

function isSelected(button) {
  const { range, time, sort, worth, drive } = button.dataset;
  if (range) return Number(range) === view.rangeDays;
  if (time) return time === view.time;
  if (sort) return sort === view.sort;
  if (worth) return view.worthSurfingOnly;
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
  const visible = applyView(forecast, view, {
    homeId: profile.home,
    worthSurfingRating: profile.worthSurfingRating,
  });

  updateChips();
  document.querySelector('#filter-summary').textContent = filterSummaryText();

  const countText = visible.length === forecast.length ? '' : ` ${visible.length} of ${forecast.length} spots.`;
  document.querySelector('#list-summary').textContent = `${listSummaryText()}${countText}`;

  document.querySelector('#spot-results').innerHTML = visible.length
    ? `<ul class="spot-list">${visible.map(renderSpotRow).join('')}</ul>`
    : '<p class="message">No spots match. Try looking further ahead or removing a filter.</p>';
}

function renderList() {
  main.innerHTML = renderControls();
  updateList();
  document.title = 'Surf Radar';
}

function renderNow(spot) {
  if (!spot.now) return '';
  return `
    <section class="now">
      <h2>Forecast right now</h2>
      <dl>
        <div><dt>Waves</dt><dd>${formatFt(spot.now.waveHeightFt)}</dd></div>
        <div><dt>Swell period</dt><dd>${formatPeriod(spot.now.swellPeriodS)}</dd></div>
        <div><dt>Wind</dt><dd>${formatWind(spot.now.wind)}</dd></div>
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
      <h2>Nearest buoy</h2>
      <p class="intro">${escapeHtml(name)} (${escapeHtml(id)}), ${Math.round(distanceKm)} km away. Measured ${timeAgo(latest.time)}.</p>
      <dl>
        <div><dt>Waves</dt><dd>${formatFt(latest.waveHeightFt)}</dd></div>
        <div><dt>Main period</dt><dd>${period}</dd></div>
        <div><dt>Direction</dt><dd>${direction}</dd></div>
      </dl>
      <p class="buoy-note">${buoyExplanation(spot)}</p>
    </section>`;
}

function renderWindowLine(slot) {
  const label = profile.windows[slot.name].label;
  return `
    <li>
      <strong>${label}:</strong> rated ${slot.rating ?? MISSING} · ${formatFt(slot.final.waveHeightFt)} · ${formatPeriod(slot.final.swellPeriodS)} · ${formatWind(slot.wind)}
    </li>`;
}

function renderDay(day) {
  const slot = slotForTime(day, view.time);
  const date = `${dayName(day)}, ${formatDate(day.date, { month: 'short', day: 'numeric' })}`;
  const timeNote = slot.past ? ' · passed' : view.time === ALL_DAY ? ` · ${windowName(slot)}` : '';
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
            ${day.flags.map((flag) => `<span class="day-flag">${escapeHtml(flag.text)}</span>`).join('')}
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
    <a class="back" href="#">← All spots</a>
    <h1 class="spot-title">${escapeHtml(spot.name)}</h1>
    <p class="spot-summary"><span id="spot-best">${bestDayText(spot)}</span><br />${driveText(spot)}</p>
    ${tropicalBanner()}
    ${renderNow(spot)}
    ${renderBuoy(spot)}
    <section>
      <h2>Day by day</h2>
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
  const { range, time, sort, worth, drive } = button.dataset;
  if (range) view.rangeDays = Number(range);
  else if (time) view.time = time;
  else if (sort) view.sort = sort;
  else if (worth) view.worthSurfingOnly = !view.worthSurfingOnly;
  else view.maxDriveMinutes = Number(drive) === view.maxDriveMinutes ? null : Number(drive);
  saveView();
  refresh();
});

async function load() {
  main.innerHTML = '<p class="message">Loading the forecast…</p>';
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
