"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { WeekVolume } from "@/lib/stats";
import { springs } from "@/lib/motion";
import { cn } from "@/lib/cn";

/**
 * Weekly tonnage bars, one per trailing week. Volume has no target, so no
 * bar is ever mint — the current week just reads brighter than the past
 * ones, and an untrained week is a faint nub. Bars grow in once, the first
 * time the panel becomes active, and go static under reduced motion.
 */
export function VolumeBars({
  weeks,
  isActive,
}: {
  weeks: WeekVolume[];
  isActive: boolean;
}) {
  const reduced = useReducedMotion();
  const [revealed, setRevealed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!isActive || started.current) return;
    started.current = true;
    setRevealed(true);
  }, [isActive]);

  const show = reduced || revealed;
  const max = Math.max(...weeks.map((w) => w.volumeLbs), 1);

  return (
    <div className="flex h-16 items-end gap-1.5" aria-hidden>
      {weeks.map((w, i) => {
        const frac = w.volumeLbs / max;
        const heightPct = w.volumeLbs > 0 ? 15 + frac * 85 : 8;
        const isCurrent = i === weeks.length - 1;
        return (
          <motion.div
            key={w.weekStart}
            className={cn(
              "min-w-0 flex-1 origin-bottom rounded-[3px]",
              w.volumeLbs === 0
                ? "bg-border-subtle"
                : isCurrent
                  ? "bg-text-secondary"
                  : "bg-border-strong",
            )}
            style={{ height: `${heightPct}%` }}
            initial={false}
            animate={{ scaleY: show ? 1 : 0.0001, opacity: show ? 1 : 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : { ...springs.gentle, delay: Math.min(i * 0.03, 0.35) }
            }
          />
        );
      })}
    </div>
  );
}
