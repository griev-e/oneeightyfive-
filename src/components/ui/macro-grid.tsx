"use client";

import { useEffect, useRef } from "react";
import { m, useReducedMotion, useSpring } from "motion/react";
import { CheckDraw } from "./check-draw";
import { AnimatedNumber } from "./animated-number";
import { springs, press } from "@/lib/motion";
import { cn } from "@/lib/cn";

/**
 * The three macros that matter, each in its identity color. Colors never
 * flip at 100% — mint owns "hit", so protein and fat celebrate with a small
 * mint check in a pre-reserved slot. Carbs is the flexible fuel lever and
 * deliberately never checks.
 */

export type MacroDatum = { current: number; target: number };

const MACROS = [
  { key: "protein", label: "Protein", color: "var(--color-protein)", tint: "var(--color-protein-tint)", checks: true },
  { key: "carbs", label: "Carbs", color: "var(--color-carbs)", tint: "var(--color-carbs-tint)", checks: false },
  { key: "fat", label: "Fat", color: "var(--color-fat)", tint: "var(--color-fat-tint)", checks: true },
] as const;

function MacroBar({
  value,
  color,
  tint,
  isActive,
}: {
  value: number;
  color: string;
  tint: string;
  isActive: boolean;
}) {
  const reduced = useReducedMotion();
  const clamped = Math.min(Math.max(value, 0), 1);
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
    <div
      className="h-1 w-full overflow-hidden rounded-full"
      style={{ backgroundColor: tint }}
    >
      <m.div
        className="h-full origin-left rounded-full"
        style={{ scaleX: progress, backgroundColor: color }}
      />
    </div>
  );
}

export function MacroGrid({
  protein,
  carbs,
  fat,
  isActive,
  onPress,
}: {
  protein: MacroDatum;
  carbs: MacroDatum;
  fat: MacroDatum;
  isActive: boolean;
  onPress?: () => void;
}) {
  const data = { protein, carbs, fat };
  const grid = (
    <div className="grid grid-cols-3 gap-4">
      {MACROS.map((m) => {
        const d = data[m.key];
        const hit = m.checks && d.target > 0 && d.current >= d.target;
        return (
          <div key={m.key}>
            <div className="flex h-3.5 items-center justify-between">
              <span className="type-label text-text-tertiary">{m.label}</span>
              <span className="h-3.5 w-3.5">
                {hit && <CheckDraw checked size={14} />}
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <AnimatedNumber value={d.current} className="type-headline" />
              <span className="type-footnote tabular-nums text-text-tertiary">
                / {d.target} g
              </span>
            </div>
            <div className="mt-2">
              <MacroBar
                value={d.target > 0 ? d.current / d.target : 0}
                color={m.color}
                tint={m.tint}
                isActive={isActive}
              />
            </div>
          </div>
        );
      })}
    </div>
  );

  if (!onPress) return grid;
  return (
    <m.button
      type="button"
      onClick={onPress}
      whileTap={{ scale: press.row }}
      transition={springs.instant}
      className={cn("block w-full text-left")}
    >
      {grid}
    </m.button>
  );
}
