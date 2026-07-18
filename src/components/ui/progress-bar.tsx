"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion, useSpring } from "motion/react";
import { springs } from "@/lib/motion";

/**
 * Thin horizontal progress (protein). Springs on activation, then only
 * retargets. Accent when the target is met.
 */
export function ProgressBar({
  value,
  isActive = true,
}: {
  value: number;
  isActive?: boolean;
}) {
  const reduced = useReducedMotion();
  const clamped = Math.min(Math.max(value, 0), 1);
  const complete = value >= 1;

  const progress = useSpring(reduced ? clamped : 0, {
    stiffness: springs.gentle.stiffness,
    damping: springs.gentle.damping,
  });
  const started = useRef(false);
  useEffect(() => {
    if (!isActive && !started.current) return;
    started.current = true;
    progress.set(clamped);
  }, [isActive, clamped, progress]);

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-default">
      <motion.div
        className="h-full origin-left rounded-full"
        style={{ scaleX: progress }}
        animate={{
          backgroundColor: complete
            ? "var(--color-accent)"
            : "var(--color-text-primary)",
        }}
        transition={{ duration: 0.2 }}
      />
    </div>
  );
}
