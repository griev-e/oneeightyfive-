"use client";

import { m } from "motion/react";
import { springs } from "@/lib/motion";
import { cn } from "@/lib/cn";

/**
 * Checkmark that draws in (pathLength) over a circle that springs up to
 * scale — fires 30ms after the tap-scale release. PR variant goes gold.
 */
export function CheckDraw({
  checked,
  variant = "default",
  size = 28,
}: {
  checked: boolean;
  variant?: "default" | "pr";
  size?: number;
}) {
  const fill =
    variant === "pr" ? "var(--color-pr)" : "var(--color-accent)";
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full",
        !checked && "border-[1.5px] border-border-strong",
      )}
      style={{ width: size, height: size }}
    >
      <m.span
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: fill }}
        initial={false}
        animate={{ scale: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
        transition={springs.snappy}
      />
      <m.svg
        viewBox="0 0 24 24"
        fill="none"
        className="relative"
        style={{ width: size * 0.55, height: size * 0.55 }}
      >
        <m.path
          d="M4.5 12.5l5 5 10-11"
          stroke="var(--color-canvas)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ ...springs.snappy, delay: checked ? 0.03 : 0 }}
        />
      </m.svg>
    </span>
  );
}
