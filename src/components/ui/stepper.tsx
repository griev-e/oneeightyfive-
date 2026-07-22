"use client";

import { m } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { press, springs } from "@/lib/motion";
import { cn } from "@/lib/cn";

/**
 * The gym stepper pair: a big tabular value over −/+ round buttons. Shared by
 * the set entry card and the set edit sheet — the two must stay identical.
 */
export function Stepper({
  value,
  unit,
  onDecrement,
  onIncrement,
  highlight,
}: {
  value: number;
  unit: string;
  onDecrement: () => void;
  onIncrement: () => void;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            "type-display tabular-nums transition-colors duration-150",
            highlight && "text-accent",
          )}
        >
          {value}
        </span>
        <span className="type-footnote text-text-tertiary">{unit}</span>
      </div>
      <div className="flex gap-2">
        <StepButton onClick={onDecrement} label={`Decrease ${unit}`}>
          <Minus size={18} strokeWidth={2} />
        </StepButton>
        <StepButton onClick={onIncrement} label={`Increase ${unit}`}>
          <Plus size={18} strokeWidth={2} />
        </StepButton>
      </div>
    </div>
  );
}

/** The "×" between weight and reps — height matches type-display's line
 * height so it centers on the stepper values, not the whole column. */
export function StepperSeparator() {
  return (
    <span className="type-title flex h-[2.375rem] items-center text-text-tertiary">
      ×
    </span>
  );
}

/** RPE row: 5–10 in half steps; null means "not recorded" (first tap seeds 8). */
export function RpeStepper({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between">
      <span className="type-footnote text-text-secondary">RPE</span>
      <span className="flex items-center gap-2">
        <StepButton
          onClick={() => onChange(value === null ? 8 : Math.max(value - 0.5, 5))}
          label="Decrease RPE"
        >
          <Minus size={18} strokeWidth={2} />
        </StepButton>
        <span className="type-headline w-12 text-center tabular-nums">
          {value ?? "—"}
        </span>
        <StepButton
          onClick={() => onChange(value === null ? 8 : Math.min(value + 0.5, 10))}
          label="Increase RPE"
        >
          <Plus size={18} strokeWidth={2} />
        </StepButton>
      </span>
    </div>
  );
}

export function StepButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <m.button
      type="button"
      aria-label={label}
      onClick={onClick}
      whileTap={{ scale: press.icon }}
      transition={springs.instant}
      className="flex size-11 items-center justify-center rounded-full border border-border-subtle bg-overlay text-text-secondary"
    >
      {children}
    </m.button>
  );
}
