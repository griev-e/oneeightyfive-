"use client";

import { Sheet } from "@/components/ui/sheet";
import { MacroGrid } from "@/components/ui/macro-grid";
import { useDayFoodLogs, useDaySets } from "@/hooks/use-day-detail";
import { useDaySummaries } from "@/hooks/use-day-summaries";
import { useExercises } from "@/hooks/use-workouts";
import { useSettings } from "@/hooks/use-settings";
import { targetRowFor } from "@/lib/streaks";
import { formatFullDate } from "@/lib/dates";
import { formatInt } from "@/lib/format";
import type { WorkoutSet } from "@/hooks/use-workouts";

/**
 * Read-only drill-in for a past day: intake vs the target that ruled THAT
 * day (target_history via targetRowFor — raising targets never rewrites
 * history), the food log, and the session if it was a training day.
 */
export function DayDetailSheet({
  date,
  onClose,
}: {
  date: string | null;
  onClose: () => void;
}) {
  if (!date) return null;
  // key by date: fresh state per day, no sync effects
  return <DayDetailBody key={date} date={date} onClose={onClose} />;
}

function DayDetailBody({
  date,
  onClose,
}: {
  date: string;
  onClose: () => void;
}) {
  const settings = useSettings();
  const summaries = useDaySummaries();
  const { data: logs } = useDayFoodLogs(date);
  const { data: sets } = useDaySets(date);
  const { data: exercises = [] } = useExercises();

  // the summary row answers instantly from cache; the detail lists fill in
  const summary = summaries.days.find((d) => d.date === date);
  const calories =
    logs?.reduce((s, l) => s + l.calories, 0) ?? summary?.calories ?? 0;
  const protein =
    logs?.reduce((s, l) => s + l.proteinG, 0) ?? summary?.proteinG ?? 0;
  const carbs = logs?.reduce((s, l) => s + l.carbsG, 0) ?? summary?.carbsG ?? 0;
  const fat = logs?.reduce((s, l) => s + l.fatG, 0) ?? summary?.fatG ?? 0;

  const target = targetRowFor(date, summaries.targets);
  const calorieTarget = target?.calorieTarget ?? settings.calorieTarget;
  const hit = calories >= calorieTarget;

  const byExercise = groupSets(sets ?? []);
  const nameFor = (id: string) =>
    exercises.find((e) => e.id === id)?.name ?? "Archived exercise";

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={formatFullDate(date)}>
      <div className="max-h-[75vh] overflow-y-auto overscroll-contain px-4 pt-4 pb-2">
        <div className="type-label text-text-tertiary">
          {formatFullDate(date)}
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="type-display">{formatInt(calories)}</span>
            <span className="type-footnote text-text-tertiary">cal</span>
          </div>
          <span
            className={
              hit ? "type-footnote font-medium text-accent" : "type-footnote text-text-secondary"
            }
          >
            {hit ? "Surplus hit" : `of ${formatInt(calorieTarget)}`}
          </span>
        </div>

        <div className="mt-6">
          <MacroGrid
            protein={{
              current: protein,
              target: target?.proteinTargetG ?? settings.proteinTargetG,
            }}
            carbs={{
              current: carbs,
              target: target?.carbTargetG ?? settings.carbTargetG,
            }}
            fat={{
              current: fat,
              target: target?.fatTargetG ?? settings.fatTargetG,
            }}
            isActive
          />
        </div>

        {logs !== undefined && logs.length === 0 && byExercise.length === 0 && (
          <p className="type-body mt-8 pb-6 text-center text-text-secondary">
            Nothing logged this day.
          </p>
        )}

        {logs !== undefined && logs.length > 0 && (
          <>
            <div className="type-label mt-8 mb-1 text-text-tertiary">Logged</div>
            <div className="divide-y divide-border-subtle">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex min-h-12 items-center justify-between gap-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="type-body block truncate">{log.name}</span>
                    <span className="type-footnote block text-text-tertiary">
                      {fmtTime(log.loggedAt)}
                    </span>
                  </span>
                  <span className="type-body shrink-0 tabular-nums text-text-secondary">
                    {formatInt(log.calories)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {byExercise.length > 0 && (
          <>
            <div className="type-label mt-8 mb-1 text-text-tertiary">
              Training
            </div>
            <div className="divide-y divide-border-subtle">
              {byExercise.map(({ exerciseId, sets: exerciseSets }) => (
                <div key={exerciseId} className="min-h-12 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="type-body min-w-0 truncate">
                      {nameFor(exerciseId)}
                    </span>
                    <span className="type-footnote shrink-0 tabular-nums text-text-tertiary">
                      {exerciseSets.length}{" "}
                      {exerciseSets.length === 1 ? "set" : "sets"}
                    </span>
                  </div>
                  <div className="type-footnote mt-0.5 tabular-nums text-text-tertiary">
                    {exerciseSets
                      .map((s) =>
                        s.weightLbs > 0
                          ? `${formatInt(s.weightLbs)}×${s.reps}`
                          : `×${s.reps}`,
                      )
                      .join(" · ")}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="h-4" />
      </div>
    </Sheet>
  );
}

/** Sets grouped per exercise in first-appearance order (API orders by set number). */
function groupSets(sets: WorkoutSet[]) {
  const out: { exerciseId: string; sets: WorkoutSet[] }[] = [];
  for (const s of sets) {
    const group = out.find((g) => g.exerciseId === s.exerciseId);
    if (group) group.sets.push(s);
    else out.push({ exerciseId: s.exerciseId, sets: [s] });
  }
  return out;
}
