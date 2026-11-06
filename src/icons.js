// Small line icons, drawn for this site. They inherit the text color around them.

const PATHS = {
  sunrise: '<path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 4v4M5 10l2 2M19 10l-2 2M2 14h2M20 14h2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  sunset: '<path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 9V4M9.5 6.5 12 9l2.5-2.5M5 10l2 2M19 10l-2 2"/>',
  allDay: '<path d="M3 16c2.5 0 2.5 2 5 2s2.5-2 4-2 2.5 2 5 2 2.5-2 4-2"/><circle cx="12" cy="9" r="3.5"/><path d="M12 2v1.5M5.5 5.5l1 1M18.5 5.5l-1 1"/>',
  wave: '<path d="M2 15c2.5 0 3.5-2 5.5-2s3 2 5 2 3-2 5-2 2.500 2 4.500 2"/><path d="M2 9c2.500 0 3.500-2 5.500-2s3 2 5 2 3-2 5-2 2.500 2 4.500 2"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.500 2M9.500 2.500h5"/>',
  wind: '<path d="M3 9h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M3 19h6"/>',
  car: '<path d="M4 16v-3l2-5.500A2 2 0 0 1 7.900 6h8.200A2 2 0 0 1 18 7.500L20 13v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1ZM4.500 12.500h15"/><circle cx="7.500" cy="17.500" r="1.500"/><circle cx="16.500" cy="17.500" r="1.500"/>',
  camera: '<rect x="3" y="7" width="13" height="10" rx="2"/><path d="m16 11 5-3v8l-5-3"/>',
  buoy: '<path d="M12 3v3M8.500 13 10 6h4l1.500 7M6 13h12l-1 4H7ZM2 20c2 0 2-1.500 4-1.500s2 1.500 4 1.500 2-1.500 4-1.500 2 1.500 4 1.500 2-1.500 4-1.500"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.500 6h.01M3.500 12h.01M3.500 18h.01"/>',
  map: '<path d="m9 4-6 2.500v13.500l6-2.500 6 2.500 6-2.500V4l-6 2.500ZM9 4v13.500M15 6.500V20"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  storm: '<circle cx="12" cy="12" r="3"/><path d="M12 5a7 7 0 0 1 7 7c0 3-1.500 5-3 6M12 19a7 7 0 0 1-7-7c0-3 1.500-5 3-6M16 18l4 1M8 6 4 5"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  external: '<path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"/>',
};

export function icon(name, size = 16) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;
}
