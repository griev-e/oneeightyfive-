"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { LineChart, type ChartPoint } from "@/components/charts/line-chart";
import { useDaySummaries } from "@/hooks/use-day-summaries";
import { useSettings } from "@/hooks/use-settings";
import { useAppDate } from "@/hooks/use-app-date";
import { nutritionSeries, type MacroKey } from "@/lib/history";
import { formatShortDate } from "@/lib/dates";
import { formatInt } from "@/lib/format";

const MODES: readonly {
  id: MacroKey;
  label: string;
  unit: string;
  /** identity hue for macros — never a status color */
  color?: string;
}[] = [
  { id: "calories", label: "Calories", unit: "cal" },
  { id: "protein", label: "Protein", unit: "g", color: "var(--color-protein)" },
  { id: "carbs", label: "Carbs", unit: "g", color: "var(--color-carbs)" },
  { id: "fat", label: "Fat", unit: "g", color: "var(--color-fat)" },
];

/**
 * The last 30 closed days of intake vs the target that ruled each one —
 * dots per day, 7-day mean line, dashed target path. Today is excluded
 * (closed-days doctrine); missing days are gaps, never zeros.
 */
export function NutritionHistory({ isActive }: { isActive: boolean }) {
  const today = useAppDate();
  const settings = useSettings();
  const summaries = useDaySummaries();

  const [mode, setMode] = useState<MacroKey>("calories");
  const [scrubbed, setScrubbed] = useState<ChartPoint | null>(null);

  const series = useMemo(
    () =>
      nutritionSeries(summaries.days, summaries.targets, mode, today, {
        calories: settings.calorieTarget,
        protein: settings.proteinTargetG,
        carbs: settings.carbTargetG,
        fat: settings.fatTargetG,
      }),
    [summaries.days, summaries.targets, mode, today, settings],
  );

  if (series.data.length === 0) return null;
  const meta = MODES.find((m) => m.id === mode)!;
  const latestAvg = series.avg[series.avg.length - 1];

  return (
    <section className="mt-10">
      <div className="type-label mb-2 text-text-tertiary">Last 30 days</div>
      <Card className="p-4">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="type-stat">
              {formatInt((scrubbed ?? latestAvg).weightLbs)}
            </span>
            <span className="type-footnote text-text-tertiary">{meta.unit}</span>
          </div>
          <span className="type-footnote tabular-nums text-text-secondary">
            {scrubbed ? formatShortDate(scrubbed.date) : "7-day average"}
          </span>
        </div>
        <div className="mt-3">
          <LineChart
            data={series.data}
            avg={series.avg}
            guide={series.guide}
            color={meta.color}
            height={160}
            isActive={isActive}
            onScrub={setScrubbed}
          />
        </div>
        <div className="mt-4">
          <Segmented
            options={MODES.map(({ id, label }) => ({ id, label }))}
            value={mode}
            onChange={(m) => {
              setMode(m);
              setScrubbed(null);
            }}
          />
        </div>
      </Card>
    </section>
  );
}
