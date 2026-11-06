// A plain warning for wind that could spoil a session. It's shown next to the rating and
// never changes it. This coast faces roughly east, so wind from the east side blows onshore.

export function windWarning({ speedMph, directionDeg }, rules) {
  if (!Number.isFinite(speedMph)) return null;
  if (speedMph >= rules.strongMph) return 'Strong wind, may be rough';
  const onshore =
    Number.isFinite(directionDeg) &&
    directionDeg >= rules.onshoreFromDeg &&
    directionDeg <= rules.onshoreToDeg;
  return onshore && speedMph >= rules.onshoreMph ? 'Onshore wind, may be choppy' : null;
}
