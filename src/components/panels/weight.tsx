"use client";

import { useMemo, useState } from "react";
import { Screen } from "@/components/shell/screen";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { NumberPad } from "@/components/ui/number-pad";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, type ChartPoint } from "@/components/charts/line-chart";
import { WeighInSheet } from "@/components/weight/weigh-in-sheet";
import { useWeighIns, useLogWeight } from "@/hooks/use-weight";
import { useSettings } from "@/hooks/use-settings";
import { useProfile } from "@/hooks/use-profile";
import {
  computePace,
  projectionGuide,
  rollingAverage,
  type WeighIn,
} from "@/lib/stats";
import {
  effectiveTrainingMonths,
  planWeightLbs,
  projectionSeries,
} from "@/lib/plan";
import {
  addDays,
  getAppDate,
  formatMonthYear,
  formatShortDate,
} from "@/lib/dates";
import { formatPace, formatWeight } from "@/lib/format";
import { cn } from "@/lib/cn";

const RANGES = [
  { id: "1w", label: "1W", days: 7 },
  { id: "1m", label: "1M", days: 30 },
  { id: "all", label: "All", days: Infinity },
  { id: "goal", label: "Goal", days: Infinity },
] as const;

export function WeightPanel({ isActive }: { isActive: boolean }) {
  const { data: weighIns = [], isPending } = useWeighIns();
  const settings = useSettings();
  const { data: profile } = useProfile();
  const logWeight = useLogWeight();

  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("1m");
  const [scrub, setScrub] = useState<ChartPoint | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [entry, setEntry] = useState<string | null>(null);
  const [editing, setEditing] = useState<WeighIn | null>(null);

  const latest = weighIns[weighIns.length - 1];
  const empty = !isPending && weighIns.length === 0;
  const loading = isPending && weighIns.length === 0;

  const pace = useMemo(
    () => computePace(weighIns, settings.goalRateLbsPerWeek),
    [weighIns, settings.goalRateLbsPerWeek],
  );

  const visible = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)!.days;
    if (!isFinite(days)) return weighIns;
    const cutoff = addDays(getAppDate(), -days);
    return weighIns.filter((w) => w.date >= cutoff);
  }, [weighIns, range]);

  const avg = useMemo(() => rollingAverage(visible), [visible]);

  // the long-horizon taper curve to the goal — needs a finished questionnaire
  const canProject =
    profile?.completedAt != null &&
    profile.heightIn != null &&
    profile.bulkStyle != null &&
    profile.trainingMonths != null &&
    profile.trainingMonthsAsOf != null &&
    settings.goalWeightLbs !== null &&
    weighIns.length > 0;

  const projection = useMemo(() => {
    if (range !== "goal" || !canProject || !profile || !latest) return null;
    return projectionSeries(
      planWeightLbs(weighIns, latest.weightLbs),
      settings.goalWeightLbs!,
      effectiveTrainingMonths(
        profile.trainingMonths!,
        profile.trainingMonthsAsOf!,
        getAppDate(),
      ),
      profile.bulkStyle!,
      profile.heightIn!,
      settings.goalRateSource === "custom"
        ? settings.goalRateLbsPerWeek
        : null,
      latest.date,
    );
  }, [range, canProject, profile, weighIns, latest, settings]);

  // dashed guide: short-horizon pace line normally, the taper curve on Goal
  const guide = useMemo(() => {
    if (range === "goal") return projection ?? [];
    return projectionGuide(
      avg[avg.length - 1],
      settings.goalRateLbsPerWeek,
      28,
      settings.goalWeightLbs,
    );
  }, [range, projection, avg, settings.goalRateLbsPerWeek, settings.goalWeightLbs]);

  const projectedEnd =
    projection && projection.length > 1 && projection.length - 1 < 260
      ? projection[projection.length - 1]
      : null;

  const shown = scrub ?? latest;
  const toGoal =
    settings.goalWeightLbs !== null && latest
      ? settings.goalWeightLbs - latest.weightLbs
      : null;

  const recent = useMemo(
    () => [...weighIns].slice(-10).reverse(),
    [weighIns],
  );

  const entryValue = entry ?? (latest ? formatWeight(latest.weightLbs) : "");

  const handleKey = (k: string) => {
    setEntry((prev) => {
      // first keypress replaces the prefilled last weight
      const cur = prev ?? "";
      if (k === "del") return cur.length > 1 ? cur.slice(0, -1) : "";
      if (k === "." && (cur.includes(".") || cur === "")) return cur;
      if (cur.includes(".") && cur.split(".")[1].length >= 1) return cur;
      if (!cur.includes(".") && cur.replace(".", "").length >= 3 && k !== ".")
        return cur;
      return cur + k;
    });
  };

  const save = () => {
    const v = parseFloat(entryValue);
    if (v >= 50 && v <= 500) {
      logWeight.mutate({ date: getAppDate(), weightLbs: v });
      setSheetOpen(false);
      setEntry(null);
    }
  };

  return (
    <Screen
      label={scrub ? formatShortDate(scrub.date) : "Current"}
      title="Weight"
      footer={
        <Button className="w-full" onClick={() => setSheetOpen(true)}>
          Log weight
        </Button>
      }
    >
      {loading ? (
        <>
          <Skeleton className="h-15 w-52" />
          <Skeleton className="mt-4 h-8 w-40" />
          <Skeleton className="mt-5 h-72 w-full rounded-2xl" />
        </>
      ) : empty ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="type-hero text-text-tertiary">—</span>
            <span className="type-hero-unit text-text-tertiary">lbs</span>
          </div>
          <p className="type-body mt-3 text-text-secondary">
            No weigh-ins yet. Log the first one below — same time every
            morning works best.
          </p>
          <Card className="mt-6 flex h-44 items-center justify-center">
            <span className="type-footnote text-text-tertiary">
              Your trend appears here after a few weigh-ins
            </span>
          </Card>
        </>
      ) : (
        <>
          {/* hero — retargets while scrubbing the chart */}
          <div className="flex items-baseline gap-2">
            <AnimatedNumber
              value={shown?.weightLbs ?? 0}
              format={formatWeight}
              className="type-hero"
            />
            <span className="type-hero-unit text-text-secondary">lbs</span>
          </div>

          <div className="mt-3 flex h-8 items-center gap-2">
            {pace.status === "ready" ? (
              <span
                className={cn(
                  "type-footnote rounded-full px-3 py-1 font-medium tabular-nums",
                  pace.band === "on-pace"
                    ? "border border-accent-border bg-accent-tint text-accent"
                    : "border border-border-subtle bg-raised text-text-secondary",
                )}
              >
                {formatPace(pace.lbsPerWeek)} lb/wk ·{" "}
                {pace.band === "on-pace"
                  ? "On pace"
                  : pace.band === "behind"
                    ? "Behind — eat more"
                    : "Ahead of pace"}
              </span>
            ) : (
              <span className="type-footnote text-text-tertiary">
                Gathering data —{" "}
                {pace.status === "gathering" ? pace.have : 0} of 5 weigh-ins
              </span>
            )}
          </div>

          <Card className="mt-5 p-4">
            <LineChart
              data={visible}
              avg={avg}
              guide={guide}
              isActive={isActive}
              onScrub={setScrub}
            />
            <div className="mt-4">
              <Segmented
                options={RANGES.filter(
                  ({ id }) => id !== "goal" || canProject,
                ).map(({ id, label }) => ({ id, label }))}
                value={range}
                onChange={setRange}
              />
            </div>
          </Card>

          {range === "goal" && projectedEnd ? (
            <div className="type-footnote mt-3 tabular-nums text-text-tertiary">
              On pace to pass {formatWeight(settings.goalWeightLbs!)} lbs
              around {formatMonthYear(projectedEnd.date)}
            </div>
          ) : (
            toGoal !== null && (
              <div className="type-footnote mt-3 tabular-nums text-text-tertiary">
                Goal {formatWeight(settings.goalWeightLbs!)} lbs ·{" "}
                {formatWeight(Math.max(toGoal, 0))} to go
              </div>
            )
          )}

          {recent.length > 0 && (
            <section className="mt-8">
              <div className="type-label mb-2 text-text-tertiary">History</div>
              <Card className="divide-y divide-border-subtle p-0 px-3">
                {recent.map((w) => (
                  <ListRow
                    key={w.date}
                    title={formatShortDate(w.date)}
                    trailing={
                      <span className="type-body tabular-nums text-text-secondary">
                        {formatWeight(w.weightLbs)} lbs
                      </span>
                    }
                    onClick={() => setEditing(w)}
                  />
                ))}
              </Card>
            </section>
          )}
        </>
      )}

      <WeighInSheet weighIn={editing} onClose={() => setEditing(null)} />

      <Sheet
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) setEntry(null);
        }}
        title="Log weight"
      >
        <div className="px-4 pt-4 pb-2">
          <div className="type-label mb-4 text-center text-text-tertiary">
            Today&apos;s weight
          </div>
          <div className="mb-4 flex items-baseline justify-center gap-1.5">
            <span className="type-display">{entryValue || "0"}</span>
            <span className="type-footnote text-text-tertiary">lbs</span>
          </div>
          <NumberPad onKey={handleKey} />
          <Button className="mt-4 w-full" onClick={save}>
            Save
          </Button>
        </div>
      </Sheet>
    </Screen>
  );
}
