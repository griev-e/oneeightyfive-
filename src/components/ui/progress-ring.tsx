"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useSpring } from "motion/react";
import { easeIOS, springs } from "@/lib/motion";

/**
 * SVG ring that fills with a gentle spring. Entrance fires when the panel
 * first becomes active (not on mount — panels stay mounted); afterwards it
 * only retargets, never resets. At 100% a full accent ring fades in over the
 * spring arc (guaranteed clean closure) and the ring pulses once — the app's
 * biggest moment. The pulse is a tween (keyframes + springs don't mix) on a
 * wrapper that never remounts, so the number inside keeps gliding.
 */
export function ProgressRing({
  value,
  size = 156,
  strokeWidth = 11,
  isActive = true,
  children,
}: {
  /** 0..1+ — values past 1 render as a full ring */
  value: number;
  size?: number;
  strokeWidth?: number;
  isActive?: boolean;
  children?: React.ReactNode;
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

  // one-time pulse on the upward crossing only
  const [pulsing, setPulsing] = useState(false);
  const wasComplete = useRef(complete);
  useEffect(() => {
    if (complete && !wasComplete.current) setPulsing(true);
    wasComplete.current = complete;
  }, [complete]);

  const r = (size - strokeWidth) / 2;
  const c = size / 2;

  return (
    <motion.div
      animate={pulsing && !reduced ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      transition={{ duration: 0.35, ease: easeIOS }}
      onAnimationComplete={() => setPulsing(false)}
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="var(--color-border-default)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{ pathLength: progress }}
          animate={{
            stroke: complete
              ? "var(--color-accent)"
              : "var(--color-text-primary)",
          }}
          transition={{ duration: 0.2 }}
        />
        {/* seamless closed ring on completion — covers the settling spring */}
        <motion.circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={strokeWidth}
          initial={false}
          animate={{ opacity: complete ? 1 : 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </motion.div>
  );
}
