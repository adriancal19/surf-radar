// Labels a forecast day using how far ahead it is and how much the models disagree.
// The spread is null while there's only one model, so the label comes from lead time alone.

export const HIGH = 'High confidence';
export const MEDIUM = 'Medium confidence';
export const LOW = 'Low confidence, trend only';

export function confidenceLabel({ dayIndex, spreadFt }, rules) {
  const byLeadTime =
    dayIndex <= rules.highThroughDay ? HIGH : dayIndex <= rules.mediumThroughDay ? MEDIUM : LOW;

  if (spreadFt === null || spreadFt === undefined) return byLeadTime;
  if (spreadFt >= rules.bigDisagreementSpreadFt) return LOW;
  if (spreadFt > rules.agreeSpreadFt && byLeadTime === HIGH) return MEDIUM;
  return byLeadTime;
}
