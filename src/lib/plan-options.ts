import type { Appetite, BulkStyle, NeatTier, Plan } from "@/lib/plan";
import { formatShortDate } from "@/lib/dates";

/**
 * The questionnaire's option lists, shared verbatim by the /setup steps and
 * the PlanView editors — one source of truth for values AND copy, so an
 * answer picked in setup always displays with the same words in the plan.
 */

export const NEAT_OPTIONS = [
  { value: "sitting", label: "Mostly sitting", helper: "Desk days, under 5k steps" },
  { value: "light", label: "On my feet a few hours", helper: "5–8k steps" },
  { value: "active", label: "On my feet most of the day", helper: "8–12k steps" },
  { value: "demanding", label: "Physical work", helper: "12k+ steps, lifting on the job" },
] as const satisfies readonly { value: NeatTier; label: string; helper?: string }[];

export const BODYFAT_OPTIONS = [
  { value: 9, label: "Very lean", helper: "Visible abs, vascular" },
  { value: 12.5, label: "Lean", helper: "Some ab definition" },
  { value: 16.5, label: "Athletic", helper: "Flat stomach, no abs showing" },
  { value: 21.5, label: "Average", helper: "A little softness" },
  { value: 28, label: "Above average", helper: "Carrying extra" },
  { value: null, label: "Not sure", helper: "Skip the blend — formula only" },
] as const;

export const BULK_OPTIONS = [
  { value: "lean", label: "Lean", helper: "Slower, minimal fat — abs stay" },
  { value: "standard", label: "Standard", helper: "The evidence-based default" },
  { value: "aggressive", label: "Aggressive", helper: "Faster scale weight, more fat comes with it" },
] as const satisfies readonly { value: BulkStyle; label: string; helper?: string }[];

export const APPETITE_OPTIONS = [
  { value: "easy", label: "Easy", helper: "I could always eat more" },
  { value: "manageable", label: "Manageable", helper: "Takes some effort" },
  { value: "struggle", label: "A struggle", helper: "Forcing meals down is the hard part" },
] as const satisfies readonly { value: Appetite; label: string; helper?: string }[];

export const LIFT_DAYS = [2, 3, 4, 5, 6] as const;

export const LIFT_DAYS_OPTIONS = LIFT_DAYS.map((n) => ({
  value: n as number,
  label: `${n} days a week`,
}));

export const SESSION_OPTIONS = [
  { value: 45, label: "About 45 minutes" },
  { value: 60, label: "About an hour" },
  { value: 75, label: "75 minutes" },
  { value: 90, label: "90 minutes or more" },
];

export const CARDIO_OPTIONS = [
  { value: 0, label: "None" },
  { value: 60, label: "About an hour" },
  { value: 120, label: "About two hours" },
  { value: 180, label: "Three hours or more" },
];

export function optionLabel<V>(
  options: readonly { value: V; label: string }[],
  value: V,
): string {
  return options.find((o) => o.value === value)?.label ?? String(value);
}

/** The one-line projection summary under the plan (reveal + PlanView). */
export function projectionLine(projection: Plan["projection"]): string {
  return projection.kind === "at-goal"
    ? "You're at your goal — this plan holds maintenance."
    : projection.kind === "open-ended"
      ? "The pace tapers as you advance — this is a long-horizon goal."
      : `On pace to pass your goal around ${formatShortDate(projection.projectedDate)}, ${new Date(projection.projectedDate).getFullYear()}.`;
}
