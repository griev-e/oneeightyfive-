"use client";

import { useMemo, useState } from "react";
import { LineChart, type ChartPoint } from "@/components/charts/line-chart";
import { Segmented } from "@/components/ui/segmented";
import { e1rmSeries, volumeSeries } from "@/lib/stats";
import type { ExerciseHistory } from "@/hooks/use-workouts";
import { addDays, formatShortDate } from "@/lib/dates";
import { formatInt } from "@/lib/format";

type Metric = "e1rm" | "volume";

/**
 * The progression chart the history API always had the data for: one point
 * per past session — top-set e1RM (or per-session volume) for weighted
 * lifts, top/total reps for bodyweight. Strictly before today (like the
 * ghost), so it never chases the session in progress. Scrubbing retargets
 * the stat, Weight-hero style.
 */
export function ExerciseTrend({
  history,
  isActive = true,
}: {
  history: ExerciseHistory;
  isActive?: boolean;
}) {
  const [metric, setMetric] = useState<Metric>("e1rm");
  // older cached history responses predate the volume fields
  const hasVolume = history.recent.some((s) => s.volumeLbs !== undefined);
  const series = useMemo(
    () =>
      metric === "volume" && hasVolume
        ? volumeSeries(history.recent)
        : e1rmSeries(history.recent),
    [history.recent, metric, hasVolume],
  );
  const [scrubbed, setScrubbed] = useState<ChartPoint | null>(null);
  if (series.length < 2) return null;

  const bodyweight = history.recent.every((s) => s.topWeight === 0);
  const showingVolume = metric === "volume" && hasVolume;
  const latest = series[series.length - 1];
  const shown = scrubbed ?? latest;

  // trend over the last ~month: latest vs the closest session ≥30 days back
  // (or the oldest charted one)
  const anchorDate = addDays(latest.date, -30);
  const anchor =
    [...series].reverse().find((p) => p.date <= anchorDate) ?? series[0];
  const delta = latest.weightLbs - anchor.weightLbs;

  const records = history.records;
  const unit = showingVolume
    ? bodyweight
      ? "total reps"
      : "lb volume"
    : bodyweight
      ? "top reps"
      : "e1RM";

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="type-label text-text-tertiary">Trend</div>
        {hasVolume && (
          <div className="w-40">
            <Segmented
              options={[
                { id: "e1rm", label: bodyweight ? "Best" : "e1RM" },
                { id: "volume", label: "Volume" },
              ]}
              value={metric}
              onChange={(id) => {
                setMetric(id);
                setScrubbed(null);
              }}
            />
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="type-stat">{formatInt(shown.weightLbs)}</span>
          <span className="type-footnote text-text-tertiary">{unit}</span>
        </div>
        <span className="type-footnote tabular-nums text-text-secondary">
          {scrubbed
            ? formatShortDate(scrubbed.date)
            : `${delta >= 0 ? "+" : "−"}${formatInt(Math.abs(delta))} vs ${formatShortDate(anchor.date)}`}
        </span>
      </div>
      <div className="mt-3">
        <LineChart
          label={showingVolume ? "Session volume trend" : "Top-set e1RM trend"}
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
