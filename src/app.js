// Draws the page. The spot list is the home view; `#cocoa-beach` opens that spot's forecast,
// so the back button works and a spot can be linked to directly.

import { settings } from '../settings.js';
import { spots } from '../spots.js';
import { loadForecast } from './pipeline.js';
import { ratingLabel } from './rating.js';

const main = document.querySelector('#main');
const status = document.querySelector('#status');

const profile = settings.profiles[settings.activeProfile];
const MISSING = '–';

let forecast = null;

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

function renderList() {
  const rows = forecast
    .map((spot) => {
      const today = spot.days[0];
      const morning = today.final.morning;
      return `
        <li>
          <a class="spot-row" href="#${escapeHtml(spot.id)}">
            ${ratingBadge(today.rating)}
            <span class="spot-name">
              <strong>${escapeHtml(spot.name)}</strong>
              <small>${ratingLabel(today.rating)}</small>
            </span>
            <span class="spot-numbers">
              <strong>${formatFt(morning.waveHeightFt)}</strong>
              <small>${formatPeriod(morning.swellPeriodS)} · ${formatWind(today.wind.morning)}</small>
            </span>
          </a>
        </li>`;
    })
    .join('');

  main.innerHTML = `
    <p class="intro">Today's rating, with ${escapeHtml(windowHours(profile.windows.morning))} morning conditions. North to south.</p>
    <ul class="spot-list">${rows}</ul>`;
  document.title = 'Surf Radar';
}

function windowHours({ startHour, endHour }) {
  const hour = (value) => `${value % 12 || 12} ${value < 12 ? 'am' : 'pm'}`;
  return `${hour(startHour)}–${hour(endHour)}`;
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
