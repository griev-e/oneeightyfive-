"use client";

import { useEffect, useState } from "react";
import {
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { numberSpring } from "@/lib/motion";
import { cn } from "@/lib/cn";
import { formatInt } from "@/lib/format";

/**
 * Renders statically on mount; glides only when the value CHANGES
 * (Robinhood animates on change, never on load). The spring retargets
 * mid-flight, so rapid logging reads as one continuous motion.
 */
export function AnimatedNumber({
  value,
  format = formatInt,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(value);
  const spring = useSpring(mv, numberSpring);
  const [display, setDisplay] = useState(() => format(value));

  useEffect(() => {
    mv.set(value);
  }, [mv, value]);

  useMotionValueEvent(spring, "change", (v) => setDisplay(format(v)));

  return (
    <span className={cn("tabular-nums", className)}>
      {reduced ? format(value) : display}
    </span>
  );
}
