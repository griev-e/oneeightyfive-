import type { Transition } from "motion/react";

/**
 * The only place transitions are defined. Components never set inline
 * stiffness/damping — they import a preset and say which one they mean.
 */
export const springs = {
  /** ~120ms — press feedback, toggles, scrub dot pops */
  instant: { type: "spring", stiffness: 700, damping: 40, mass: 0.6 },
  /** ~180ms — checkmark pop, small element moves */
  snappy: { type: "spring", stiffness: 500, damping: 35, mass: 0.8 },
  /** ~250ms — lists, cards, layout shifts. The workhorse. */
  default: { type: "spring", stiffness: 350, damping: 32, mass: 0.9 },
  /** ~450ms, whisper of overshoot — ring fill, chart reveals, celebrations */
  gentle: { type: "spring", stiffness: 170, damping: 24, mass: 1 },
  /** critically damped slides — sheets, pushed detail views */
  sheet: { type: "spring", stiffness: 380, damping: 38, mass: 1 },
} satisfies Record<string, Transition>;

/** useSpring config for number glides (~700ms decelerating, retargets mid-flight) */
export const numberSpring = { stiffness: 90, damping: 24 };

/** Tween fallback for enter-only fades; matches iOS system curves */
export const easeIOS = [0.32, 0.72, 0, 1] as const;

/** Press scale values — always paired with touch-action: manipulation */
export const press = {
  button: 0.97,
  icon: 0.92,
  row: 0.98,
} as const;

/** Shared variants */
export const fadeRise = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
} as const;
