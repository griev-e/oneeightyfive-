/**
 * The recalibration cadence clock. The observed-TDEE math lives in lib/plan.ts
 * (estimateObservedTdee + buildPlan's observed blend); this file decides *when*
 * the "your real TDEE looks like X" card is allowed to surface, so the rule is
 * pure and testable rather than buried in the route handler.
 *
 * Two gates: the suggestion must move the target by a meaningful amount, and it
 * must not nag — any prior plan event (applied OR dismissed) starts a cooldown,
 * so accepting or waving off the card both quiet it for the same window.
 */

import { daysBetween } from "./dates";

/** kcal — below this the retarget is formula noise, not a real recalibration. */
export const RECALIBRATION_MIN_DELTA = 100;

/** Days a prior plan event silences the card (dismiss and apply both count). */
export const RECALIBRATION_COOLDOWN_DAYS = 14;

export function shouldSuggestRecalibration(args: {
  currentTarget: number;
  suggestedTarget: number;
  /** date of the most recent plan_event (applied/dismissed/questionnaire), or null */
  lastEventDate: string | null;
  today: string;
}): boolean {
  const delta = Math.abs(args.suggestedTarget - args.currentTarget);
  if (delta < RECALIBRATION_MIN_DELTA) return false;
  if (
    args.lastEventDate !== null &&
    daysBetween(args.lastEventDate, args.today) < RECALIBRATION_COOLDOWN_DAYS
  ) {
    return false;
  }
  return true;
}
