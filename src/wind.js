// How the wind shapes the surf at one beach, judged against the way that beach faces.
// Offshore wind (from the land) grooms the faces; onshore wind (from the sea) roughs them up;
// cross-shore wind sits in between. Light wind counts as calm from any direction.
// The effect is added to the rating (rating.js), and with mostly wind chop a strong enough
// effect marks the day blown out.

import { angleBetween } from './surf.js';

// { kind, effect, warning, good } for one window's wind, or null without a wind speed.
//   kind     'light', 'offshore', 'cross-shore' or 'onshore'
//   effect   points added to the rating, from settings
//   warning  a short note when it hurts, like 'Onshore wind, may be choppy'
//   good     a short note when it helps, like 'Offshore wind, clean faces'
export function windInfo({ speedMph, directionDeg }, facingDeg, rules) {
  if (!Number.isFinite(speedMph)) return null;
  const { effects } = rules;
  if (speedMph < rules.lightMph) {
    return { kind: 'light', effect: effects.light, warning: null, good: 'Light wind, could be glassy' };
  }

  // Unknown direction: only the speed can be judged.
  const fromSea = Number.isFinite(directionDeg) ? angleBetween(directionDeg, facingDeg) : 90;
  const kind = fromSea <= rules.sideDeg ? 'onshore' : fromSea >= 180 - rules.sideDeg ? 'offshore' : 'cross-shore';
  const strong = speedMph >= rules.strongMph;
  const breezy = speedMph >= rules.breezyMph;

  if (kind === 'offshore') {
    return strong
      ? { kind, effect: effects.offshoreStrong, warning: 'Strong offshore wind, hard to paddle', good: null }
      : { kind, effect: effects.offshore, warning: null, good: 'Offshore wind, clean faces' };
  }
  if (kind === 'onshore') {
    if (strong) return { kind, effect: effects.onshoreStrong, warning: 'Strong onshore wind, rough', good: null };
    if (breezy) return { kind, effect: effects.onshoreBreezy, warning: 'Onshore wind, may be choppy', good: null };
    return { kind, effect: effects.onshore, warning: 'Light onshore wind, a bit bumpy', good: null };
  }
  if (strong) return { kind, effect: effects.crossStrong, warning: 'Strong wind, may be rough', good: null };
  if (breezy) return { kind, effect: effects.crossBreezy, warning: 'Cross-shore wind, may be bumpy', good: null };
  return { kind, effect: effects.cross, warning: null, good: null };
}
