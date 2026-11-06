// Draws the page. The spot list is the home view; `#cocoa-beach` opens that spot's forecast,
// so the back button works and a spot can be linked to directly.

import { settings } from '../settings.js';
import { spots } from '../spots.js';
import { LOW } from './confidence.js';
import {
  applyView,
  bestDay,
  bestDayInRange,
  driveMinutes,
  DRIVE_LIMITS,
  formatDrive,
  formatDriveShort,
  RANGES,
  restoreView,
  SORTS,
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

const trendNote = (day) => (day.confidence === LOW ? ' (trend)' : '');

// Reads as a phrase: "Good on Tue", "Fair today", "Skip it all 5 days".
function ratingPhrase(day, rangeDays) {
  if (!day) return ratingLabel(null);
  const label = ratingLabel(day.rating);
  if (day.rating === 1 && rangeDays > 1) return `${label} all ${rangeDays} days`;
  if (day.dayIndex === 0) return `${label} today`;
  return `${label} on ${dayName(day)}${trendNote(day)}`;
}

function bestDayText(spot) {
  const best = bestDay(spot.days);
  if (!best) return '';
  if (best.rating === 1) return 'No day above 1 this week';
  return `Best day: ${dayName(best)}, rated ${best.rating}${trendNote(best)}`;
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
    <div class="controls">
      ${controlRow('Look ahead', ranges)}
      ${controlRow('Sort', sorts)}
      ${controlRow('Only show', filters)}
    </div>
    <p class="intro" id="list-summary" aria-live="polite"></p>
    <div id="spot-results"></div>`;
}

function renderSpotRow(spot) {
  const day = bestDayInRange(spot, view.rangeDays);
  const morning = day?.final.morning;
  const drive = formatDriveShort(driveMinutes(spot, profile.home));
  return `
    <li>
      <a class="spot-row" href="#${escapeHtml(spot.id)}">
        ${ratingBadge(day?.rating ?? null)}
        <span class="row-text">
          <span class="row-line">
            <strong>${escapeHtml(spot.name)}</strong>
            <strong class="row-value">${formatFt(morning?.waveHeightFt)}</strong>
          </span>
          <span class="row-line row-detail">
            <span>${ratingPhrase(day, view.rangeDays)}${drive ? ` · ${drive} drive` : ''}</span>
            <span class="row-value">${formatPeriod(morning?.swellPeriodS)}</span>
          </span>
        </span>
      </a>
    </li>`;
}

function isSelected(button) {
  const { range, sort, worth, drive } = button.dataset;
  if (range) return Number(range) === view.rangeDays;
  if (sort) return sort === view.sort;
  if (worth) return view.worthSurfingOnly;
  return Number(drive) === view.maxDriveMinutes;
}

function updateList() {
  const visible = applyView(forecast, view, {
    homeId: profile.home,
    worthSurfingRating: profile.worthSurfingRating,
  });

  document.querySelectorAll('.chip').forEach((button) => {
    button.setAttribute('aria-pressed', String(isSelected(button)));
  });

  const rangeText = view.rangeDays === 1 ? "Today's rating" : `Best day in the next ${view.rangeDays} days`;
  const hours = windowHours(profile.windows.morning);
  const countText = visible.length === forecast.length ? '' : ` ${visible.length} of ${forecast.length} spots.`;
  document.querySelector('#list-summary').textContent =
    `${rangeText}, with ${hours} wave height and period.${countText}`;

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
      <h2>Right now</h2>
      <dl>
        <div><dt>Waves</dt><dd>${formatFt(spot.now.waveHeightFt)}</dd></div>
        <div><dt>Swell period</dt><dd>${formatPeriod(spot.now.swellPeriodS)}</dd></div>
        <div><dt>Wind</dt><dd>${formatWind(spot.now.wind)}</dd></div>
      </dl>
    </section>`;
}

function renderDay(day) {
  const { morning, midday } = day.final;
  return `
    <li>
      <details class="day">
        <summary>
          ${ratingBadge(day.rating)}
          <span class="row-text">
            <span class="row-line">
              <strong>${dayName(day)}, ${formatDate(day.date, { month: 'short', day: 'numeric' })}</strong>
              <strong class="row-value">${formatFt(morning.waveHeightFt)}</strong>
            </span>
            <span class="row-line row-detail">
              <span>${day.confidence}</span>
              <span class="row-value">${formatPeriod(morning.swellPeriodS)} · ${formatWind(day.wind.morning)}</span>
            </span>
          </span>
        </summary>
        <p class="day-midday">
          Midday: ${formatFt(midday.waveHeightFt)} · ${formatPeriod(midday.swellPeriodS)} · ${formatWind(day.wind.midday)}
        </p>
      </details>
    </li>`;
}

function renderSpot(spot) {
  main.innerHTML = `
    <a class="back" href="#">← All spots</a>
    <h1 class="spot-title">${escapeHtml(spot.name)}</h1>
    <p class="spot-summary">${bestDayText(spot)}<br />${driveText(spot)}</p>
    ${renderNow(spot)}
    <section>
      <h2>Day by day</h2>
      <p class="intro">Numbers are for ${escapeHtml(windowHours(profile.windows.morning))}. Tap a day for midday. Wind doesn't affect the rating.</p>
      <ol class="day-list">${spot.days.map(renderDay).join('')}</ol>
    </section>`;
  document.title = `${spot.name} – Surf Radar`;
}

function render() {
  if (!forecast) return;
  const id = decodeURIComponent(location.hash.slice(1));
  const spot = forecast.find((candidate) => candidate.id === id);
  if (spot) renderSpot(spot);
  else renderList();
  window.scrollTo(0, 0);
}

// The controls get redrawn with the list view, so listen on the container that stays put.
main.addEventListener('click', (event) => {
  const button = event.target.closest('.chip');
  if (!button) return;
  const { range, sort, worth, drive } = button.dataset;
  if (range) view.rangeDays = Number(range);
  else if (sort) view.sort = sort;
  else if (worth) view.worthSurfingOnly = !view.worthSurfingOnly;
  else view.maxDriveMinutes = Number(drive) === view.maxDriveMinutes ? null : Number(drive);
  saveView();
  updateList();
});

async function load() {
  main.innerHTML = '<p class="message">Loading the forecast…</p>';
  status.textContent = '';
  try {
    forecast = await loadForecast(spots, settings);
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
