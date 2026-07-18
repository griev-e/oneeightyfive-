"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Screen } from "@/components/shell/screen";
import { useTabSwitch } from "@/components/shell/tab-shell";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PressableCard } from "@/components/ui/card";
import { Sparkline } from "@/components/charts/sparkline";
import { useMock } from "@/lib/mock";
import { computePace, rollingAverage } from "@/lib/stats";
import { formatFullDate } from "@/lib/dates";
import { formatInt, formatPace, formatWeight } from "@/lib/format";
import { springs } from "@/lib/motion";
import { cn } from "@/lib/cn";

export function TodayPanel({ isActive }: { isActive: boolean }) {
  const mock = useMock();
  const switchTab = useTabSwitch();

  const calories = mock.foodLogs.reduce((s, f) => s + f.calories, 0);
  const protein = mock.foodLogs.reduce((s, f) => s + f.proteinG, 0);
  const remaining = mock.calorieTarget - calories;
  const surplusHit = remaining <= 0;
  const streak = surplusHit ? mock.streakBase + 1 : mock.streakBase;

  const latest = mock.weighIns[mock.weighIns.length - 1];
  const pace = useMemo(
    () => computePace(mock.weighIns, mock.goalRate),
    [mock.weighIns, mock.goalRate],
  );
  const spark = useMemo(
    () => rollingAverage(mock.weighIns).slice(-21),
    [mock.weighIns],
  );

  const setsToday = mock.exercises.reduce((s, e) => s + e.today.length, 0);

  return (
    <Screen label={formatFullDate(mock.appDate)} title="Today">
      {/* hero: today's calories */}
      <button
        type="button"
        className="mt-2 block text-left"
        onClick={() => switchTab("food")}
      >
        <div className="flex items-baseline gap-2">
          <AnimatedNumber value={calories} className="type-hero" />
          <span className="type-hero-unit text-text-secondary">cal</span>
        </div>
        <div className="mt-2 flex h-7 items-center">
          <AnimatePresence mode="wait" initial={false}>
            {surplusHit ? (
              <motion.span
                key="hit"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={springs.snappy}
                className="type-footnote rounded-full border border-accent-border bg-accent-tint px-3 py-1 font-medium text-accent"
              >
                Surplus hit
              </motion.span>
            ) : (
              <motion.span
                key="togo"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="type-body text-text-secondary"
              >
                {formatInt(remaining)} to go · target{" "}
                {formatInt(mock.calorieTarget)}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </button>

      {/* protein */}
      <div className="mt-8">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="type-label text-text-tertiary">Protein</span>
          <span className="type-footnote tabular-nums text-text-secondary">
            <AnimatedNumber value={protein} /> / {mock.proteinTarget} g
          </span>
        </div>
        <ProgressBar value={protein / mock.proteinTarget} isActive={isActive} />
      </div>

      {/* cards */}
      <div className="mt-10 grid grid-cols-2 gap-3">
        <PressableCard onClick={() => switchTab("weight")} className="p-5">
          <div className="type-label mb-2 text-text-tertiary">Weight</div>
          <div className="flex items-baseline gap-1">
            <span className="type-stat">
              {latest ? formatWeight(latest.weightLbs) : "—"}
            </span>
            <span className="type-footnote text-text-tertiary">lbs</span>
          </div>
          <div className="mt-3">
            <Sparkline
              data={spark}
              accent={pace.status === "ready" && pace.band === "on-pace"}
            />
          </div>
          <div
            className={cn(
              "type-footnote mt-2 tabular-nums",
              pace.status === "ready" && pace.band === "on-pace"
                ? "text-accent"
                : "text-text-secondary",
            )}
          >
            {pace.status === "ready"
              ? `${formatPace(pace.lbsPerWeek)} lb/wk`
              : "Gathering data"}
          </div>
        </PressableCard>

        <div className="grid grid-rows-2 gap-3">
          <PressableCard onClick={() => switchTab("lift")} className="p-5">
            <div className="type-label mb-1 text-text-tertiary">Lift</div>
            <div className="type-headline">
              {setsToday > 0 ? (
                <>
                  <AnimatedNumber value={setsToday} />{" "}
                  {setsToday === 1 ? "set" : "sets"} logged
                </>
              ) : (
                "No session yet"
              )}
            </div>
            <div className="type-footnote mt-0.5 text-text-tertiary">
              This week: 2 of 3
            </div>
          </PressableCard>

          <PressableCard onClick={() => switchTab("food")} className="p-5">
            <div className="type-label mb-1 text-text-tertiary">
              Day streak
            </div>
            <div className="flex items-baseline gap-1.5">
              <AnimatedNumber
                value={streak}
                className={cn(
                  "type-stat",
                  surplusHit && "text-accent",
                )}
              />
              <span className="type-footnote text-text-tertiary">days</span>
            </div>
          </PressableCard>
        </div>
      </div>

      {/* today's log, at a glance */}
      {mock.foodLogs.length > 0 && (
        <div className="mt-10">
          <div className="type-label mb-2 text-text-tertiary">
            Logged today
          </div>
          <div className="divide-y divide-border-subtle">
            {mock.foodLogs.slice(-3).map((log) => (
              <button
                key={log.id}
                type="button"
                onClick={() => switchTab("food")}
                className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left"
              >
                <span className="type-body truncate text-text-secondary">
                  {log.name}
                </span>
                <span className="type-footnote shrink-0 tabular-nums text-text-tertiary">
                  {formatInt(log.calories)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Screen>
  );
}
