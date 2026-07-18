"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { daysBetween } from "@/lib/dates";
import { easeIOS, springs } from "@/lib/motion";
import type { WeighIn } from "@/lib/stats";

export type ChartPoint = WeighIn;

/**
 * Custom SVG weight chart: raw daily dots + prominent 7-day-average line.
 * Enters with a left→right clip reveal on first activation; scrubbing
 * tracks the finger 1:1 (no spring on x — lag reads as broken) while
 * vertical page scroll stays live via touch-action: pan-y.
 */
export function LineChart({
  data,
  avg,
  height = 220,
  isActive = true,
  onScrub,
}: {
  data: ChartPoint[];
  avg: ChartPoint[];
  height?: number;
  isActive?: boolean;
  onScrub?: (point: ChartPoint | null) => void;
}) {
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // reveal once, when the panel first becomes active
  const [revealed, setRevealed] = useState(isActive);
  if (isActive && !revealed) setRevealed(true);

  const PAD = { top: 12, bottom: 12, left: 8, right: 8 };

  const { xFor, yFor, linePath } = useMemo(() => {
    if (data.length === 0 || width === 0) {
      return { xFor: () => 0, yFor: () => 0, linePath: "" };
    }
    const first = data[0].date;
    const span = Math.max(daysBetween(first, data[data.length - 1].date), 1);
    const values = [...data, ...avg].map((p) => p.weightLbs);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 1);
    const innerW = width - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;
    const xFor = (p: ChartPoint) =>
      PAD.left + (daysBetween(first, p.date) / span) * innerW;
    const yFor = (p: ChartPoint) =>
      PAD.top + (1 - (p.weightLbs - min) / range) * innerH;
    const linePath = avg
      .map((p, i) => `${i === 0 ? "M" : "L"}${xFor(p)},${yFor(p)}`)
      .join(" ");
    return { xFor, yFor, linePath };
  }, [data, avg, width, height, PAD.left, PAD.right, PAD.top, PAD.bottom]);

  const handlePointer = (e: React.PointerEvent) => {
    if (data.length === 0 || width === 0) return;
    const rect = containerRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let best = 0;
    let bestDist = Infinity;
    data.forEach((p, i) => {
      const d = Math.abs(xFor(p) - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setScrubIndex(best);
    onScrub?.(data[best]);
  };

  const endScrub = () => {
    setScrubIndex(null);
    onScrub?.(null);
  };

  const scrubbed = scrubIndex !== null ? data[scrubIndex] : null;

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none"
      style={{ height, touchAction: "pan-y" }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        handlePointer(e);
      }}
      onPointerMove={(e) => {
        if (scrubIndex !== null) handlePointer(e);
      }}
      onPointerUp={endScrub}
      onPointerCancel={endScrub}
    >
      <motion.div
        initial={false}
        animate={{
          clipPath:
            revealed || reduced ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)",
        }}
        transition={
          reduced ? { duration: 0 } : { duration: 0.45, ease: easeIOS }
        }
        className="absolute inset-0"
      >
        {width > 0 && data.length > 0 && (
          <svg width={width} height={height}>
            {data.map((p) => (
              <circle
                key={p.date}
                cx={xFor(p)}
                cy={yFor(p)}
                r={2.5}
                fill="var(--color-text-tertiary)"
              />
            ))}
            {avg.length > 1 && (
              <path
                d={linePath}
                fill="none"
                stroke="var(--color-text-primary)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {avg.length > 0 && !scrubbed && (
              <circle
                cx={xFor(avg[avg.length - 1])}
                cy={yFor(avg[avg.length - 1])}
                r={4}
                fill="var(--color-text-primary)"
              />
            )}
          </svg>
        )}
      </motion.div>

      {scrubbed && (
        <>
          <div
            className="absolute top-0 bottom-0 w-px bg-border-strong"
            style={{ left: xFor(scrubbed) }}
          />
          <motion.div
            key={scrubbed.date}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={springs.instant}
            className="absolute size-2 rounded-full bg-text-primary"
            style={{
              left: xFor(scrubbed) - 4,
              top: yFor(scrubbed) - 4,
            }}
          />
        </>
      )}
    </div>
  );
}
