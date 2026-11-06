// The geometry for the little coast map. It's a drawing, not a survey: the coast is simplified
// and stretched sideways so it fits a phone, and close neighbors get nudged apart to stay tappable.

export const MAP_WIDTH = 360;
const TOP_LAT = 28.75;
const PX_PER_DEGREE_LAT = 190;
const PX_PER_DEGREE_LON = 130;
const WEST_LON = -80.62;
const COAST_X = 118;
const MIN_PIN_GAP = 20;

export const toX = (lon) => COAST_X + (lon - WEST_LON) * PX_PER_DEGREE_LON;
export const toY = (lat) => (TOP_LAT - lat) * PX_PER_DEGREE_LAT;

// Simplified Florida coast, north to south, as [lat, lon].
const COAST = [
  [28.8, -80.72],
  [28.6, -80.58],
  [28.46, -80.52],
  [28.32, -80.605],
  [28.07, -80.56],
  [27.86, -80.445],
  [27.65, -80.355],
  [27.47, -80.29],
  [27.2, -80.16],
  [26.95, -80.07],
  [26.7, -80.035],
  [26.46, -80.06],
  [26.24, -80.085],
  [26.01, -80.115],
  [25.78, -80.128],
  [25.6, -80.2],
  [25.45, -80.34],
];

export const MAP_HEIGHT = toY(COAST[COAST.length - 1][0]);

// A smooth outline of the land, closed along the map's left edge.
export function landPath() {
  const points = COAST.map(([lat, lon]) => [toX(lon), Math.max(0, toY(lat))]);
  let path = `M0 0 L${points[0][0].toFixed(1)} 0 L${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    path += ` Q${x0.toFixed(1)} ${((y0 + y1) / 2).toFixed(1)} ${((x0 + x1) / 2).toFixed(1)} ${((y0 + y1) / 2).toFixed(1)}`;
    path += ` T${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return `${path} L0 ${MAP_HEIGHT.toFixed(1)} Z`;
}

// Where each spot's pin goes. Spots must be given north to south. Pins too close to the one
// above are pushed down just enough to keep them from overlapping.
export function layoutPins(spots) {
  let lastY = -Infinity;
  return spots.map((spot) => {
    const y = Math.max(toY(spot.beach.lat), lastY + MIN_PIN_GAP);
    lastY = y;
    return { spot, x: toX(spot.beach.lon), y };
  });
}
