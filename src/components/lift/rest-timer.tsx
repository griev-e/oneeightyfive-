"use client";

import { m } from "motion/react";
import { REST_TARGET_SECONDS, useRestTimer } from "@/hooks/use-rest-timer";
import { springs } from "@/lib/motion";
import { cn } from "@/lib/cn";

/**
 * The between-sets clock in the entry card header. Plain 1 Hz ticking text —
 * a clock is not a stat glide, so no AnimatedNumber. Mint at the rest target
 * is a legitimate "target hit" moment; before that it's quiet secondary text.
 */
export function RestTimer({
  exerciseId,
  targetSeconds = REST_TARGET_SECONDS,
}: {
  exerciseId: string;
  /** per-exercise override (exercises.rest_seconds); default 3:00 */
  targetSeconds?: number;
}) {
  const elapsed = useRestTimer(exerciseId);
  if (elapsed === null) return null;

  const rested = elapsed >= targetSeconds;
  const min = Math.floor(elapsed / 60);
  const s = String(elapsed % 60).padStart(2, "0");

  return (
    <m.span
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.snappy}
      className={cn(
        "type-footnote tabular-nums",
        rested ? "font-medium text-accent" : "text-text-secondary",
      )}
    >
      {rested ? "Rested" : "Rest"} {min}:{s}
    </m.span>
  );
}
