"use client";

import { useMemo, useState } from "react";
import { LineChart, type ChartPoint } from "@/components/charts/line-chart";
import { e1rmSeries } from "@/lib/stats";
import type { ExerciseHistory } from "@/hooks/use-workouts";
import { addDays, formatShortDate } from "@/lib/dates";
import { formatInt } from "@/lib/format";

/**
 * The progression chart the history API always had the data for: one point
 * per past session — top-set e1RM for weighted lifts, top reps for
 * bodyweight. Strictly before today (like the ghost), so it never chases
 * the session in progress. Scrubbing retargets the stat, Weight-hero style.
 */
export function ExerciseTrend({
  history,
  isActive = true,
}: {
  history: ExerciseHistory;
  isActive?: boolean;
}) {
  const series = useMemo(() => e1rmSeries(history.recent), [history.recent]);
  const [scrubbed, setScrubbed] = useState<ChartPoint | null>(null);
  if (series.length < 2) return null;

  const bodyweight = history.recent.every((s) => s.topWeight === 0);
  const latest = series[series.length - 1];
  const shown = scrubbed ?? latest;

  // trend over the last ~month: latest vs the closest session ≥30 days back
  // (or the oldest charted one)
  const anchorDate = addDays(latest.date, -30);
  const anchor =
    [...series].reverse().find((p) => p.date <= anchorDate) ?? series[0];
  const delta = latest.weightLbs - anchor.weightLbs;

  const records = history.records;

  return (
    <div className="mt-6">
      <div className="type-label mb-2 text-text-tertiary">Trend</div>
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="type-stat">{formatInt(shown.weightLbs)}</span>
          <span className="type-footnote text-text-tertiary">
            {bodyweight ? "top reps" : "e1RM"}
          </span>
        </div>
        <span className="type-footnote tabular-nums text-text-secondary">
          {scrubbed
            ? formatShortDate(scrubbed.date)
            : `${delta >= 0 ? "+" : "−"}${formatInt(Math.abs(delta))} vs ${formatShortDate(anchor.date)}`}
        </span>
      </div>
      <div className="mt-3">
        <LineChart
          data={series}
          avg={series}
          height={160}
          isActive={isActive}
          onScrub={setScrubbed}
        />
      </div>
      {records !== null && (
        <p className="type-footnote mt-2 tabular-nums text-text-tertiary">
          {bodyweight
            ? `All-time: ${records.maxRepsAtBodyweight} reps`
            : `All-time: ${formatInt(records.maxWeightLbs)} lb top set · ${formatInt(records.maxE1rm)} e1RM`}
        </p>
      )}
    </div>
  );
}
