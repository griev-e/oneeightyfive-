"use client";

import { useMemo, useState } from "react";
import { Screen } from "@/components/shell/screen";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { NumberPad } from "@/components/ui/number-pad";
import { LineChart, type ChartPoint } from "@/components/charts/line-chart";
import { useMock } from "@/lib/mock";
import { computePace, rollingAverage } from "@/lib/stats";
import { addDays, formatShortDate } from "@/lib/dates";
import { formatPace, formatWeight } from "@/lib/format";
import { cn } from "@/lib/cn";

const RANGES = [
  { id: "1w", label: "1W", days: 7 },
  { id: "1m", label: "1M", days: 30 },
  { id: "all", label: "All", days: Infinity },
] as const;

export function WeightPanel({ isActive }: { isActive: boolean }) {
  const mock = useMock();
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("1m");
  const [scrub, setScrub] = useState<ChartPoint | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [entry, setEntry] = useState<string | null>(null);

  const latest = mock.weighIns[mock.weighIns.length - 1];
  const pace = useMemo(
    () => computePace(mock.weighIns, mock.goalRate),
    [mock.weighIns, mock.goalRate],
  );

  const visible = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)!.days;
    if (!isFinite(days)) return mock.weighIns;
    const cutoff = addDays(mock.appDate, -days);
    return mock.weighIns.filter((w) => w.date >= cutoff);
  }, [mock.weighIns, mock.appDate, range]);

  const avg = useMemo(() => rollingAverage(visible), [visible]);

  const shown = scrub ?? latest;
  const toGoal = mock.goalWeight - (latest?.weightLbs ?? 0);

  const entryValue = entry ?? (latest ? formatWeight(latest.weightLbs) : "0");

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
      mock.logWeight(v);
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
            Gathering data — {pace.status === "gathering" ? pace.have : 0} of 5
            weigh-ins
          </span>
        )}
      </div>

      <Card className="mt-5 p-4">
        <LineChart
          data={visible}
          avg={avg}
          isActive={isActive}
          onScrub={setScrub}
        />
        <div className="mt-4">
          <Segmented
            options={RANGES.map(({ id, label }) => ({ id, label }))}
            value={range}
            onChange={setRange}
          />
        </div>
      </Card>

      <div className="type-footnote mt-3 tabular-nums text-text-tertiary">
        Goal {mock.goalWeight} lbs · {formatWeight(Math.max(toGoal, 0))} to go
      </div>

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
