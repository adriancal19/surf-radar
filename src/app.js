// Draws the page. The spot list is the home view; `#cocoa-beach` opens that spot's forecast,
// so the back button works and a spot can be linked to directly.

import { settings } from '../settings.js';
import { spots } from '../spots.js';
import {
  applyView,
  bestDay,
  driveMinutes,
  DRIVE_LIMITS,
  formatDrive,
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
  const { sort, worthSurfingOnly, maxDriveMinutes } = view;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sort, worthSurfingOnly, maxDriveMinutes }));
  } catch {
    // Private browsing can block storage. The filters still work, they just won't be remembered.
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

function bestDayText(spot) {
  const best = bestDay(spot.days);
  if (!best) return '';
  if (best.rating === 1) return 'No day above 1';
  return `Best: ${dayName(best)}, rated ${best.rating}`;
}

function driveText(spot) {
  const drive = formatDrive(driveMinutes(spot, profile.home));
  return drive ? `${drive[0].toUpperCase()}${drive.slice(1)} from ${escapeHtml(home.label)}` : '';
}

function renderControls() {
  const dayButtons = forecast[0].days
    .map(
      (day) =>
        `<button type="button" class="day-button" data-day="${day.dayIndex}">${dayName(day)}</button>`,
    )
    .join('');
  const sortOptions = Object.entries(SORTS)
    .map(
      ([value, label]) =>
        `<option value="${value}"${value === view.sort ? ' selected' : ''}>${label}</option>`,
    )
    .join('');
  const driveOptions = DRIVE_LIMITS.map(
    ({ minutes, label }) =>
      `<option value="${minutes ?? ''}"${minutes === view.maxDriveMinutes ? ' selected' : ''}>${label}</option>`,
  ).join('');

  return `
    <div class="controls">
      <div class="day-buttons" role="group" aria-label="Forecast day">${dayButtons}</div>
      <div class="control-row">
        <label>Sort
          <select id="sort">${sortOptions}</select>
        </label>
        <label>Drive from ${escapeHtml(home.label)}
          <select id="max-drive">${driveOptions}</select>
        </label>
      </div>
      <label class="checkbox">
        <input type="checkbox" id="worth-surfing"${view.worthSurfingOnly ? ' checked' : ''} />
        Only spots rated ${profile.worthSurfingRating} or higher
      </label>
    </div>
    <p class="intro" id="list-summary" aria-live="polite"></p>
    <div id="spot-results"></div>`;
}

function renderSpotRow(spot) {
  const day = spot.days[view.dayIndex];
  const morning = day.final.morning;
  return `
    <li>
      <a class="spot-row" href="#${escapeHtml(spot.id)}">
        ${ratingBadge(day.rating)}
        <span class="spot-name">
          <strong>${escapeHtml(spot.name)}</strong>
          <small>${ratingLabel(day.rating)} · ${bestDayText(spot)}</small>
          <small>${driveText(spot)}</small>
        </span>
        <span class="spot-numbers">
          <strong>${formatFt(morning.waveHeightFt)}</strong>
          <small>${formatPeriod(morning.swellPeriodS)}</small>
          <small>${formatWind(day.wind.morning)}</small>
        </span>
      </a>
    </li>`;
}

function updateList() {
  const visible = applyView(forecast, view, {
    homeId: profile.home,
    worthSurfingRating: profile.worthSurfingRating,
  });

  const selectedDay = forecast[0].days[view.dayIndex];
  document.querySelectorAll('.day-button').forEach((button) => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.day) === view.dayIndex));
  });

  const dayText =
    view.dayIndex === 0
      ? "Today's ratings"
      : `Ratings for ${formatDate(selectedDay.date, { weekday: 'long', month: 'short', day: 'numeric' })}`;
  const countText = visible.length === forecast.length ? '' : ` Showing ${visible.length} of ${forecast.length} spots.`;
  document.querySelector('#list-summary').textContent =
    `${dayText}, with ${windowHours(profile.windows.morning)} morning conditions.${countText}`;

  document.querySelector('#spot-results').innerHTML = visible.length
    ? `<ul class="spot-list">${visible.map(renderSpotRow).join('')}</ul>`
    : '<p class="message">No spots match these filters.</p>';
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
      <h2>Forecast for right now</h2>
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
    <li class="day">
      ${ratingBadge(day.rating)}
      <div class="day-main">
        <div class="day-heading">
          <strong>${dayName(day)}</strong>
          <span>${formatDate(day.date, { month: 'short', day: 'numeric' })}</span>
          <span class="confidence">${day.confidence}</span>
        </div>
        <div class="day-values">
          <strong>${formatFt(morning.waveHeightFt)}</strong>
          <span>${formatPeriod(morning.swellPeriodS)}</span>
          <span>${formatWind(day.wind.morning)}</span>
        </div>
        <div class="day-midday">
          Midday: ${formatFt(midday.waveHeightFt)} · ${formatPeriod(midday.swellPeriodS)} · ${formatWind(day.wind.midday)}
        </div>
      </div>
    </li>`;
}

function renderSpot(spot) {
  main.innerHTML = `
    <a class="back" href="#">← All spots</a>
    <h1 class="spot-title">${escapeHtml(spot.name)}</h1>
    <p class="spot-summary">${driveText(spot)}<br />${bestDayText(spot)}</p>
    ${renderNow(spot)}
    <section>
      <h2>Today and the next 7 days</h2>
      <p class="intro">Main numbers are ${escapeHtml(windowHours(profile.windows.morning))} morning conditions. Wind is shown for info and doesn't affect the rating.</p>
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
  const button = event.target.closest('.day-button');
  if (!button) return;
  view.dayIndex = Number(button.dataset.day);
  updateList();
});

main.addEventListener('change', (event) => {
  if (event.target.id === 'sort') view.sort = event.target.value;
  else if (event.target.id === 'max-drive') {
    view.maxDriveMinutes = event.target.value === '' ? null : Number(event.target.value);
  } else if (event.target.id === 'worth-surfing') view.worthSurfingOnly = event.target.checked;
  else return;
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
