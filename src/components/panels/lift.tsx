"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Minus, Plus, Search } from "lucide-react";
import { Screen } from "@/components/shell/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { CheckDraw } from "@/components/ui/check-draw";
import { PRBadge } from "@/components/ui/pr-badge";
import { ConfirmSwap } from "@/components/ui/confirm-swap";
import { SetEditSheet } from "@/components/lift/set-edit-sheet";
import { ExerciseTrend } from "@/components/lift/exercise-trend";
import {
  useArchiveExercise,
  useCreateExercise,
  useExercises,
  useExerciseHistory,
  useLogSet,
  useSets,
  type Exercise,
  type WorkoutSet,
} from "@/hooks/use-workouts";
import { useDaySummaries } from "@/hooks/use-day-summaries";
import { useProfile } from "@/hooks/use-profile";
import { useAppDate } from "@/hooks/use-app-date";
import { classifySet, sessionVolume, type SetFlag } from "@/lib/stats";
import { startOfWeek, formatShortDate } from "@/lib/dates";
import { formatInt } from "@/lib/format";
import { springs, press } from "@/lib/motion";
import { cn } from "@/lib/cn";

export function LiftPanel() {
  const date = useAppDate();
  const { data: exercises = [], isPending } = useExercises();
  const { data: sets = [] } = useSets(date);
  const { trainingDates } = useDaySummaries();
  const { data: profile } = useProfile();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const createExercise = useCreateExercise();
  const selected = exercises.find((e) => e.id === selectedId) ?? null;

  // the drill-in lives in history so the iOS edge back-swipe dismisses it
  const openExercise = (id: string) => {
    setSelectedId(id);
    window.history.pushState({ lift: id }, "", window.location.pathname);
  };
  useEffect(() => {
    const onPop = () => setSelectedId(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const setsByExercise = useMemo(() => {
    const m = new Map<string, WorkoutSet[]>();
    for (const s of sets) {
      m.set(s.exerciseId, [...(m.get(s.exerciseId) ?? []), s]);
    }
    return m;
  }, [sets]);

  const weekCount = useMemo(() => {
    const monday = startOfWeek(date);
    const dates = new Set(trainingDates.filter((d) => d >= monday));
    if (sets.length > 0) dates.add(date);
    return dates.size;
  }, [trainingDates, date, sets.length]);
  const weekGoal = profile?.liftDaysPerWeek ?? null;

  const todayVolume = useMemo(() => sessionVolume(sets), [sets]);

  const q = query.trim();
  const ql = q.toLowerCase();
  const filtered = useMemo(
    () => (ql ? exercises.filter((e) => e.name.toLowerCase().includes(ql)) : exercises),
    [exercises, ql],
  );
  const exactMatch = exercises.some((e) => e.name.toLowerCase() === ql);
  const createFromQuery = () => {
    if (q.length === 0 || createExercise.isPending) return;
    createExercise.mutate(q, {
      onSuccess: (exercise) => {
        setQuery("");
        openExercise(exercise.id);
      },
    });
  };

  return (
    <div className="relative h-full lg:grid lg:grid-cols-[340px_1fr]">
      <div className="h-full lg:border-r lg:border-border-subtle">
        <Screen
          label={
            weekGoal
              ? `This week: ${weekCount} of ${weekGoal} sessions`
              : `This week: ${weekCount} ${weekCount === 1 ? "session" : "sessions"}`
          }
          title="Lift"
          trailing={
            sets.length > 0 ? (
              <span className="type-footnote tabular-nums rounded-full border border-border-subtle bg-raised px-3 py-1 text-text-secondary">
                {todayVolume > 0
                  ? `${formatInt(todayVolume)} lb`
                  : `${sets.length} ${sets.length === 1 ? "set" : "sets"}`}
              </span>
            ) : undefined
          }
        >
          {isPending && exercises.length === 0 ? (
            <Card className="h-64 animate-none" />
          ) : (
            <>
              <div className="relative mb-3">
                <Search
                  size={17}
                  strokeWidth={1.75}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && q.length > 0 && !exactMatch) {
                      createFromQuery();
                    }
                  }}
                  placeholder="Search or add an exercise"
                  maxLength={60}
                  enterKeyHint="done"
                  className={cn(
                    "type-body h-12 w-full rounded-md border border-border-subtle bg-raised pl-10 pr-4",
                    "text-text-primary placeholder:text-text-tertiary",
                    "transition-colors duration-150 focus:border-border-strong",
                  )}
                />
              </div>
              <Card className="divide-y divide-border-subtle p-0 px-3">
                {filtered.map((ex) => {
                  const todayCount = setsByExercise.get(ex.id)?.length ?? 0;
                  return (
                    <ListRow
                      key={ex.id}
                      title={ex.name}
                      subtitle={undefined}
                      trailing={
                        <span className="flex items-center gap-2">
                          {todayCount > 0 && (
                            <span className="type-footnote tabular-nums text-accent">
                              {todayCount} {todayCount === 1 ? "set" : "sets"}
                            </span>
                          )}
                          <ChevronRight
                            size={18}
                            strokeWidth={1.75}
                            className="text-text-tertiary"
                          />
                        </span>
                      }
                      onClick={() => openExercise(ex.id)}
                      className={cn(
                        selectedId === ex.id && "lg:rounded-xl lg:bg-overlay",
                      )}
                    />
                  );
                })}
                {q.length > 0 && !exactMatch && (
                  <ListRow
                    title={`Create “${q}”`}
                    trailing={
                      <Plus
                        size={18}
                        strokeWidth={1.75}
                        className="text-text-tertiary"
                      />
                    }
                    onClick={createFromQuery}
                    className="text-text-secondary"
                  />
                )}
                {filtered.length === 0 && q.length === 0 && (
                  <div className="type-footnote py-6 text-center text-text-tertiary">
                    Add your first exercise to start logging.
                  </div>
                )}
              </Card>
            </>
          )}
          <p className="type-footnote mt-3 text-text-tertiary">
            Beat the ghost — last session&apos;s numbers are the game.
          </p>
        </Screen>
      </div>

      {/* iPad: persistent detail column — today's exercise trend until a pick */}
      <div className="hidden h-full lg:block">
        {!selected && (
          <IdlePane
            exercise={
              exercises.find((e) => setsByExercise.has(e.id)) ?? null
            }
            date={date}
          />
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            key={selected.id}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={springs.sheet}
            className="absolute inset-0 z-10 bg-canvas lg:left-[340px]"
          >
            <ExerciseDetail
              exercise={selected}
              date={date}
              todaySets={setsByExercise.get(selected.id) ?? []}
              onBack={() => window.history.back()}
              onArchived={() => window.history.back()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** The wide-layout resting state: the trend of whatever was trained today. */
function IdlePane({
  exercise,
  date,
}: {
  exercise: Exercise | null;
  date: string;
}) {
  const { data: history } = useExerciseHistory(exercise?.id ?? null, date);
  if (!exercise || !history || history.recent.length < 2) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="type-body text-text-tertiary">Choose an exercise</span>
      </div>
    );
  }
  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain px-screen pb-tab-clearance">
      <div className="mx-auto max-w-2xl pt-[calc(env(safe-area-inset-top)+20px)]">
        <h2 className="type-title mt-1">{exercise.name}</h2>
        <ExerciseTrend history={history} />
      </div>
    </div>
  );
}

function ExerciseDetail({
  exercise,
  date,
  todaySets,
  onBack,
  onArchived,
}: {
  exercise: Exercise;
  date: string;
  todaySets: WorkoutSet[];
  onBack: () => void;
  onArchived: () => void;
}) {
  const { data: history } = useExerciseHistory(exercise.id, date);
  const logSet = useLogSet(date);
  const archive = useArchiveExercise();
  const [editing, setEditing] = useState<WorkoutSet | null>(null);

  const lastSets = useMemo(
    () => history?.lastSession?.sets ?? [],
    [history],
  );
  const records = history?.records ?? null;
  const exerciseVolume = useMemo(() => sessionVolume(todaySets), [todaySets]);
  const setIndex = todaySets.length;
  const ghost = lastSets[setIndex] ?? lastSets[lastSets.length - 1] ?? null;
  const prior = todaySets[todaySets.length - 1] ?? null;

  const [weight, setWeight] = useState(
    ghost?.weightLbs ?? prior?.weightLbs ?? 45,
  );
  const [reps, setReps] = useState(ghost?.reps ?? prior?.reps ?? 8);
  // ghost arrives async with history — seed the steppers once, adjusting
  // state during render (the sanctioned prop-change pattern)
  const [seededSession, setSeededSession] = useState<string | null>(null);
  const sessionKey = history ? (history.lastSession?.date ?? "none") : null;
  if (
    sessionKey !== null &&
    seededSession !== sessionKey &&
    todaySets.length === 0 &&
    ghost
  ) {
    setSeededSession(sessionKey);
    setWeight(ghost.weightLbs);
    setReps(ghost.reps);
  }

  const flags: SetFlag[] = useMemo(() => {
    return todaySets.map((s, i) =>
      classifySet(
        { weightLbs: s.weightLbs, reps: s.reps },
        records,
        todaySets.slice(0, i).map((p) => ({ weightLbs: p.weightLbs, reps: p.reps })),
        lastSets[i] ?? lastSets[lastSets.length - 1] ?? null,
      ),
    );
  }, [todaySets, records, lastSets]);

  const bodyweight =
    lastSets.length > 0
      ? lastSets.every((s) => s.weightLbs === 0)
      : weight === 0;

  const nextGhost = ghost;
  const beatingGhost =
    nextGhost !== null &&
    records !== null &&
    (weight > 0 || nextGhost.weightLbs > 0
      ? weight * (1 + Math.min(reps, 12) / 30) >
        nextGhost.weightLbs * (1 + Math.min(nextGhost.reps, 12) / 30)
      : reps > nextGhost.reps);

  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain px-screen pb-tab-clearance">
      <header className="mx-auto max-w-2xl pt-[calc(env(safe-area-inset-top)+20px)]">
        <motion.button
          type="button"
          onClick={onBack}
          whileTap={{ scale: press.row }}
          transition={springs.instant}
          className="-ml-2 flex h-11 items-center gap-0.5 pr-3 text-text-secondary lg:hidden"
        >
          <ChevronLeft size={22} strokeWidth={1.75} />
          <span className="type-body">Lift</span>
        </motion.button>
        <h1 className="type-title mt-1">{exercise.name}</h1>
        <p className="type-footnote mt-1 text-text-tertiary">
          {history === undefined
            ? " "
            : history.lastSession
              ? `Last session (${formatShortDate(history.lastSession.date)}): ${
                  bodyweight
                    ? lastSets.map((s) => s.reps).join(" · ")
                    : lastSets.map((s) => `${s.weightLbs}×${s.reps}`).join(" · ")
                }`
              : "First session — set the baseline"}
        </p>
        {todaySets.length > 0 && (
          <span className="type-footnote tabular-nums mt-3 inline-flex items-center rounded-full border border-border-subtle bg-raised px-3 py-1 text-text-secondary">
            {exerciseVolume > 0
              ? `${formatInt(exerciseVolume)} lb this session`
              : `${todaySets.length} ${todaySets.length === 1 ? "set" : "sets"} this session`}
          </span>
        )}
      </header>

      <div className="mx-auto mt-6 max-w-2xl">
        {/* completed sets */}
        {todaySets.length > 0 && (
          <Card className="mb-4 divide-y divide-border-subtle p-0 px-4">
            <AnimatePresence initial={false}>
              {todaySets.map((set, i) => (
                <motion.button
                  key={set.id}
                  type="button"
                  onClick={() => setEditing(set)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={springs.default}
                  className="flex min-h-14 w-full items-center justify-between py-2 text-left"
                >
                  <span className="type-label text-text-tertiary">
                    Set {i + 1}
                  </span>
                  <span className="flex items-center gap-3">
                    {flags[i] === "pr" && <PRBadge />}
                    {flags[i] === "overload" && (
                      <span className="type-footnote font-medium text-accent">
                        ▲
                      </span>
                    )}
                    <span className="type-headline tabular-nums">
                      {set.weightLbs > 0
                        ? `${set.weightLbs} × ${set.reps}`
                        : `${set.reps} reps`}
                    </span>
                    <CheckDraw
                      checked
                      variant={flags[i] === "pr" ? "pr" : "default"}
                      size={26}
                    />
                  </span>
                </motion.button>
              ))}
            </AnimatePresence>
          </Card>
        )}

        {/* next set entry */}
        <Card className="p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <span className="type-label text-text-tertiary">
              Set {setIndex + 1}
            </span>
            {ghost && (
              <span className="type-footnote tabular-nums text-text-tertiary">
                Ghost:{" "}
                {ghost.weightLbs > 0
                  ? `${ghost.weightLbs} × ${ghost.reps}`
                  : `${ghost.reps} reps`}
              </span>
            )}
          </div>

          <div className="flex items-start justify-center gap-6">
            <Stepper
              value={weight}
              unit="lbs"
              onDecrement={() => setWeight((w) => Math.max(w - 5, 0))}
              onIncrement={() => setWeight((w) => Math.min(w + 5, 1500))}
              highlight={beatingGhost && weight !== nextGhost?.weightLbs}
            />
            <span className="type-title flex h-[2.375rem] items-center text-text-tertiary">
              ×
            </span>
            <Stepper
              value={reps}
              unit="reps"
              onDecrement={() => setReps((r) => Math.max(r - 1, 1))}
              onIncrement={() => setReps((r) => Math.min(r + 1, 100))}
              highlight={beatingGhost && weight === nextGhost?.weightLbs}
            />
          </div>

          <Button
            className="mt-5 w-full"
            onClick={() =>
              logSet.mutate({ exerciseId: exercise.id, weightLbs: weight, reps })
            }
          >
            Complete set
          </Button>
        </Card>

        {history !== undefined && <ExerciseTrend history={history} />}

        <div className="mt-6">
          <ConfirmSwap
            label="Archive exercise"
            confirmLabel="Archive"
            onConfirm={() => {
              archive.mutate(exercise.id);
              onArchived();
            }}
          />
        </div>
      </div>

      <SetEditSheet set={editing} onClose={() => setEditing(null)} date={date} />
    </div>
  );
}

function Stepper({
  value,
  unit,
  onDecrement,
  onIncrement,
  highlight,
}: {
  value: number;
  unit: string;
  onDecrement: () => void;
  onIncrement: () => void;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            "type-display tabular-nums transition-colors duration-150",
            highlight && "text-accent",
          )}
        >
          {value}
        </span>
        <span className="type-footnote text-text-tertiary">{unit}</span>
      </div>
      <div className="flex gap-2">
        <StepButton onClick={onDecrement} label={`Decrease ${unit}`}>
          <Minus size={18} strokeWidth={2} />
        </StepButton>
        <StepButton onClick={onIncrement} label={`Increase ${unit}`}>
          <Plus size={18} strokeWidth={2} />
        </StepButton>
      </div>
    </div>
  );
}

function StepButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      whileTap={{ scale: press.icon }}
      transition={springs.instant}
      className="flex size-11 items-center justify-center rounded-full border border-border-subtle bg-overlay text-text-secondary"
    >
      {children}
    </motion.button>
  );
}
