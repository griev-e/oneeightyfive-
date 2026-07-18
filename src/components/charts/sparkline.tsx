"use client";

import { useMemo } from "react";
import { daysBetween } from "@/lib/dates";
import type { WeighIn } from "@/lib/stats";

/**
 * Inline trend glance. Neutral by default — the stroke only earns accent
 * when the pace is on target (accent means "target hit", nothing else).
 */
export function Sparkline({
  data,
  width = 120,
  height = 40,
  accent = false,
}: {
  data: WeighIn[];
  width?: number;
  height?: number;
  accent?: boolean;
}) {
  const path = useMemo(() => {
    if (data.length < 2) return "";
    const first = data[0].date;
    const span = Math.max(daysBetween(first, data[data.length - 1].date), 1);
    const values = data.map((p) => p.weightLbs);
    const min = Math.min(...values);
    const range = Math.max(Math.max(...values) - min, 0.5);
    return data
      .map((p, i) => {
        const x = 2 + (daysBetween(first, p.date) / span) * (width - 4);
        const y = 3 + (1 - (p.weightLbs - min) / range) * (height - 6);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [data, width, height]);

  if (!path) return null;
  const stroke = accent ? "var(--color-accent)" : "var(--color-text-secondary)";
  const last = data[data.length - 1];
  const first = data[0].date;
  const span = Math.max(daysBetween(first, last.date), 1);
  const values = data.map((p) => p.weightLbs);
  const min = Math.min(...values);
  const range = Math.max(Math.max(...values) - min, 0.5);
  const lx = 2 + (daysBetween(first, last.date) / span) * (width - 4);
  const ly = 3 + (1 - (last.weightLbs - min) / range) * (height - 6);

  return (
    <svg width={width} height={height} aria-hidden>
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lx} cy={ly} r={2.5} fill={stroke} />
    </svg>
  );
}
