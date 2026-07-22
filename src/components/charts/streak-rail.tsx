"use client";

import { useEffect, useRef, useState } from "react";
import { m, useReducedMotion } from "motion/react";
import type { StreakPoint } from "@/lib/streaks";
import { springs } from "@/lib/motion";
import { cn } from "@/lib/cn";

/**
 * The streak sparkline: one slim bar per day over the trailing window. Height
 * reads how close intake came to that day's target; mint means the surplus was
 * hit (accent = "target hit", nothing else), a muted bar is a logged miss, a
 * faint nub is a day with nothing logged. Bars grow in once, the first time the
 * panel becomes active (charts reveal on activation, never on mount), and go
 * static under reduced motion.
 */
export function StreakRail({
  series,
  isActive,
}: {
  series: StreakPoint[];
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

  return (
    <div className="flex h-11 items-end gap-[3px]" aria-hidden>
      {series.map((p, i) => {
        const frac = p.target > 0 ? Math.min(p.calories / p.target, 1) : 0;
        const heightPct = p.logged ? 18 + frac * 82 : 12;
        return (
          <m.div
            key={p.date}
            className={cn(
              "min-w-0 flex-1 origin-bottom rounded-[3px]",
              p.hit
                ? "bg-accent"
                : p.logged
                  ? "bg-border-strong"
                  : "bg-border-subtle",
            )}
            style={{ height: `${heightPct}%` }}
            initial={false}
            animate={{ scaleY: show ? 1 : 0.0001, opacity: show ? 1 : 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : { ...springs.gentle, delay: Math.min(i * 0.012, 0.35) }
            }
          />
        );
      })}
    </div>
  );
}
