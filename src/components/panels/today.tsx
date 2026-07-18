"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight } from "lucide-react";
import { Screen } from "@/components/shell/screen";
import { useTabSwitch } from "@/components/shell/tab-shell";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { MacroGrid } from "@/components/ui/macro-grid";
import { Card, PressableCard } from "@/components/ui/card";
import { RecalibrationCard } from "@/components/today/recalibration-card";
import { Sparkline } from "@/components/charts/sparkline";
import { useFoodLogs } from "@/hooks/use-food";
import { useSets } from "@/hooks/use-workouts";
import { useWeighIns } from "@/hooks/use-weight";
import { useSettings } from "@/hooks/use-settings";
import { useProfile } from "@/hooks/use-profile";
import { useDaySummaries } from "@/hooks/use-day-summaries";
import { useAppDate } from "@/hooks/use-app-date";
import { computePace, rollingAverage } from "@/lib/stats";
import { computeStreak } from "@/lib/streaks";
import { formatFullDate } from "@/lib/dates";
import { formatInt, formatPace, formatWeight } from "@/lib/format";
import { springs } from "@/lib/motion";
import { cn } from "@/lib/cn";
import { useRouter } from "next/navigation";

export function TodayPanel({ isActive }: { isActive: boolean }) {
  const router = useRouter();
  const date = useAppDate();
  const switchTab = useTabSwitch();
  const settings = useSettings();
  const { data: profile } = useProfile();
  const { data: logs = [] } = useFoodLogs(date);
  const { data: sets = [] } = useSets(date);
  const { data: weighIns = [] } = useWeighIns();
  const summaries = useDaySummaries();

  const calories = logs.reduce((s, l) => s + l.calories, 0);
  const protein = logs.reduce((s, l) => s + l.proteinG, 0);
  const carbs = logs.reduce((s, l) => s + l.carbsG, 0);
  const fat = logs.reduce((s, l) => s + l.fatG, 0);
  const remaining = settings.calorieTarget - calories;
  const surplusHit = remaining <= 0;

  const streak = useMemo(
    () =>
      computeStreak(
        summaries.days,
        summaries.targets,
        date,
        calories,
        settings.calorieTarget,
      ),
    [summaries.days, summaries.targets, date, calories, settings.calorieTarget],
  );

  const latest = weighIns[weighIns.length - 1];
  const pace = useMemo(
    () => computePace(weighIns, settings.goalRateLbsPerWeek),
    [weighIns, settings.goalRateLbsPerWeek],
  );
  const spark = useMemo(
    () => rollingAverage(weighIns).slice(-21),
    [weighIns],
  );

  const needsSetup = profile !== undefined && profile.completedAt === null;

  return (
    <Screen label={formatFullDate(date)} title="Today">
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
                {formatInt(settings.calorieTarget)}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </button>

      {/* set up your plan — until the questionnaire has run */}
      {needsSetup && (
        <PressableCard
          className="mt-6 flex items-center justify-between"
          onClick={() => router.push("/setup")}
        >
          <span>
            <span className="type-headline block">Set up your plan</span>
            <span className="type-footnote mt-0.5 block text-text-secondary">
              A 2-minute questionnaire tailors your calories and macros.
            </span>
          </span>
          <ChevronRight
            size={18}
            strokeWidth={1.75}
            className="shrink-0 text-text-tertiary"
          />
        </PressableCard>
      )}

      {/* your real TDEE — the M4 recalibration nudge, cadence-gated */}
      <RecalibrationCard />

      {/* macros that matter */}
      <div className="mt-8">
        <MacroGrid
          protein={{ current: protein, target: settings.proteinTargetG }}
          carbs={{ current: carbs, target: settings.carbTargetG }}
          fat={{ current: fat, target: settings.fatTargetG }}
          isActive={isActive}
          onPress={() => switchTab("food")}
        />
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
              {sets.length > 0 ? (
                <>
                  <AnimatedNumber value={sets.length} />{" "}
                  {sets.length === 1 ? "set" : "sets"} logged
                </>
              ) : (
                "No session yet"
              )}
            </div>
          </PressableCard>

          <PressableCard onClick={() => switchTab("food")} className="p-5">
            <div className="type-label mb-1 text-text-tertiary">
              Day streak
            </div>
            <div className="flex items-baseline gap-1.5">
              <AnimatedNumber
                value={streak.count}
                className={cn("type-stat", streak.todayHit && "text-accent")}
              />
              <span className="type-footnote text-text-tertiary">
                {streak.count >= 366 ? "365+ days" : "days"}
              </span>
            </div>
          </PressableCard>
        </div>
      </div>

      {/* today's log, at a glance */}
      {logs.length > 0 && (
        <div className="mt-10">
          <div className="type-label mb-2 text-text-tertiary">
            Logged today
          </div>
          <div className="divide-y divide-border-subtle">
            {logs.slice(-3).map((log) => (
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

      {/* first-run guidance when the day is a blank slate */}
      {logs.length === 0 && !needsSetup && (
        <Card className="mt-10 py-6 text-center">
          <p className="type-body text-text-secondary">
            Nothing logged yet — the surplus starts with breakfast.
          </p>
        </Card>
      )}
    </Screen>
  );
}
