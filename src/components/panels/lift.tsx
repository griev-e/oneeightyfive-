"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { ChevronLeft, ChevronRight, Minus, Plus, Search } from "lucide-react";
import { Screen } from "@/components/shell/screen";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { CheckDraw } from "@/components/ui/check-draw";
import { PRBadge } from "@/components/ui/pr-badge";
import { ConfirmSwap } from "@/components/ui/confirm-swap";
import { RpeStepper, StepButton, Stepper, StepperSeparator } from "@/components/ui/stepper";
import { SetEditSheet } from "@/components/lift/set-edit-sheet";
import { ExerciseTrend } from "@/components/lift/exercise-trend";
import { RestTimer } from "@/components/lift/rest-timer";
import { VolumeBars } from "@/components/charts/volume-bars";
import {
  useArchiveExercise,
  useCreateExercise,
  useExercises,
  useExerciseHistory,
  useLogSet,
  useRestoreExercise,
  useSets,
  useUpdateExercise,
  type Exercise,
  type WorkoutSet,
} from "@/hooks/use-workouts";
import { useDaySummaries } from "@/hooks/use-day-summaries";
import { useProfile } from "@/hooks/use-profile";
import { useAppDate } from "@/hooks/use-app-date";
import { REST_TARGET_SECONDS, restTimer } from "@/hooks/use-rest-timer";
import { useToast } from "@/components/ui/toast";
import {
  classifySet,
  e1rm,
  sessionVolume,
  suggestProgression,
  weeklyVolume,
  type SetFlag,
} from "@/lib/stats";
import { startOfWeek, formatShortDate } from "@/lib/dates";
import { formatInt } from "@/lib/format";
import { springs, press } from "@/lib/motion";
import { cn } from "@/lib/cn";

export function LiftPanel({ isActive }: { isActive: boolean }) {
  const date = useAppDate();
  const { data: exercises = [], isPending } = useExercises();
  const { data: sets = [] } = useSets(date);
  const { trainingDates, liftDays } = useDaySummaries();
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

  const volumeWeeks = useMemo(
    () => weeklyVolume(liftDays, sets, date),
    [liftDays, sets, date],
  );
  const trainedRecently = volumeWeeks.some((w) => w.volumeLbs > 0);
  const thisWeek = volumeWeeks[volumeWeeks.length - 1];
  const lastWeek = volumeWeeks[volumeWeeks.length - 2];

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
                            // logged activity, not a hit target — mint stays
                            // reserved for PR/overload/surplus moments
                            <span className="type-footnote tabular-nums text-text-secondary">
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
          {trainedRecently && (
            <section className="mt-8">
              <div className="type-label mb-2 text-text-tertiary">
                Weekly volume
              </div>
              <Card className="p-4">
                <div className="flex items-baseline gap-1.5">
                  <AnimatedNumber
                    value={thisWeek.volumeLbs}
                    format={formatInt}
                    className="type-stat"
                  />
                  <span className="type-footnote text-text-tertiary">
                    lb this week
                  </span>
                </div>
                <div className="mt-3">
                  <VolumeBars weeks={volumeWeeks} isActive={isActive} />
                </div>
                {lastWeek.volumeLbs > 0 && (
                  <div className="type-footnote mt-2 tabular-nums text-text-secondary">
                    vs {formatInt(lastWeek.volumeLbs)} lb last week
                  </div>
                )}
              </Card>
            </section>
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
          <m.div
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
          </m.div>
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
  const restore = useRestoreExercise();
  const updateExercise = useUpdateExercise();
  const toast = useToast();
  const [editing, setEditing] = useState<WorkoutSet | null>(null);
  const [effortOpen, setEffortOpen] = useState(false);
  const [rpe, setRpe] = useState<number | null>(null);
  const [note, setNote] = useState("");

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

  const beatingGhost =
    ghost !== null &&
    records !== null &&
    (weight > 0 || ghost.weightLbs > 0
      ? e1rm(weight, reps) > e1rm(ghost.weightLbs, ghost.reps)
      : reps > ghost.reps);

  // the progression nudge: the smallest jump that beats the ghost, adopted
  // with one tap — never auto-logged, never forced on a rough day
  const target = ghost !== null && records !== null ? suggestProgression(ghost) : null;
  const onTarget =
    target !== null && weight === target.weightLbs && reps === target.reps;
  const e1rmDelta =
    ghost !== null && (weight > 0 || ghost.weightLbs > 0)
      ? e1rm(weight, reps) - e1rm(ghost.weightLbs, ghost.reps)
      : null;
  const restTarget = exercise.restSeconds ?? REST_TARGET_SECONDS;

  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain px-screen pb-tab-clearance">
      <header className="mx-auto max-w-2xl pt-[calc(env(safe-area-inset-top)+20px)]">
        <m.button
          type="button"
          onClick={onBack}
          whileTap={{ scale: press.row }}
          transition={springs.instant}
          className="-ml-2 flex h-11 items-center gap-0.5 pr-3 text-text-secondary lg:hidden"
        >
          <ChevronLeft size={22} strokeWidth={1.75} />
          <span className="type-body">Lift</span>
        </m.button>
        <h1 className="type-title mt-1">{exercise.name}</h1>
        <p className="type-footnote mt-1 text-text-tertiary">
          {history === undefined
            ? " "
            : history.lastSession
              ? `Last session (${formatShortDate(history.lastSession.date)}): ${
                  bodyweight
                    ? lastSets
                        .map((s) => `${s.reps}${s.rpe != null ? ` @${s.rpe}` : ""}`)
                        .join(" · ")
                    : lastSets
                        .map(
                          (s) =>
                            `${s.weightLbs}×${s.reps}${s.rpe != null ? ` @${s.rpe}` : ""}`,
                        )
                        .join(" · ")
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
                <m.button
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
                      {set.rpe != null && (
                        <span className="type-footnote text-text-tertiary">
                          {" "}
                          @ {set.rpe}
                        </span>
                      )}
                    </span>
                    <CheckDraw
                      checked
                      variant={flags[i] === "pr" ? "pr" : "default"}
                      size={26}
                    />
                  </span>
                </m.button>
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
            <span className="flex items-baseline gap-3">
              <RestTimer
                exerciseId={exercise.id}
                targetSeconds={restTarget}
              />
              {ghost && (
                <span className="type-footnote tabular-nums text-text-tertiary">
                  Ghost:{" "}
                  {ghost.weightLbs > 0
                    ? `${ghost.weightLbs} × ${ghost.reps}`
                    : `${ghost.reps} reps`}
                  {ghost.rpe != null && ` @${ghost.rpe}`}
                </span>
              )}
            </span>
          </div>

          <div className="flex items-start justify-center gap-6">
            <Stepper
              value={weight}
              unit="lbs"
              onDecrement={() => setWeight((w) => Math.max(w - 5, 0))}
              onIncrement={() => setWeight((w) => Math.min(w + 5, 1500))}
              highlight={beatingGhost && weight !== ghost?.weightLbs}
            />
            <StepperSeparator />
            <Stepper
              value={reps}
              unit="reps"
              onDecrement={() => setReps((r) => Math.max(r - 1, 1))}
              onIncrement={() => setReps((r) => Math.min(r + 1, 100))}
              highlight={beatingGhost && weight === ghost?.weightLbs}
            />
          </div>

          {target && (
            <div className="mt-4 flex h-11 items-center justify-center">
              {beatingGhost ? (
                // already past the ghost — say by how much, plainly
                <span className="type-footnote tabular-nums text-text-secondary">
                  {e1rmDelta !== null
                    ? `+${e1rmDelta.toFixed(1)} e1RM vs last session`
                    : `+${reps - (ghost?.reps ?? 0)} ${reps - (ghost?.reps ?? 0) === 1 ? "rep" : "reps"} vs last session`}
                </span>
              ) : onTarget ? null : (
                <m.button
                  type="button"
                  whileTap={{ scale: press.button }}
                  transition={springs.instant}
                  onClick={() => {
                    setWeight(target.weightLbs);
                    setReps(target.reps);
                  }}
                  className="type-footnote tabular-nums flex h-11 items-center rounded-full border border-border-subtle bg-overlay px-4 text-text-secondary"
                >
                  Target&nbsp;
                  {target.weightLbs > 0
                    ? `${target.weightLbs} × ${target.reps}`
                    : `${target.reps} reps`}
                  &nbsp;— beats the ghost
                </m.button>
              )}
            </div>
          )}

          {effortOpen ? (
            <div className="mt-5 space-y-3">
              <RpeStepper value={rpe} onChange={setRpe} />
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note — grip, tempo, pain…"
                maxLength={200}
                enterKeyHint="done"
                className={cn(
                  "type-body h-12 w-full rounded-md border border-border-subtle bg-overlay px-4",
                  "text-text-primary placeholder:text-text-tertiary",
                  "transition-colors duration-150 focus:border-border-strong",
                )}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEffortOpen(true)}
              className="type-footnote mt-5 flex min-h-11 items-center text-text-tertiary"
            >
              Add effort · note
            </button>
          )}

          <Button
            className="mt-5 w-full"
            onClick={() => {
              logSet.mutate({
                exerciseId: exercise.id,
                weightLbs: weight,
                reps,
                rpe,
                note: note.trim() === "" ? null : note.trim(),
              });
              restTimer.start(exercise.id);
              setRpe(null);
              setNote("");
            }}
          >
            Complete set
          </Button>
        </Card>

        {history !== undefined && <ExerciseTrend history={history} />}

        {/* per-exercise rest target — compounds and isolations don't share a clock */}
        <div className="mt-6 flex min-h-11 items-center justify-between">
          <span className="type-footnote text-text-secondary">Rest target</span>
          <span className="flex items-center gap-2">
            <StepButton
              onClick={() =>
                updateExercise.mutate({
                  id: exercise.id,
                  restSeconds: Math.max(restTarget - 30, 30),
                })
              }
              label="Decrease rest target"
            >
              <Minus size={18} strokeWidth={2} />
            </StepButton>
            <span className="type-headline w-14 text-center tabular-nums">
              {Math.floor(restTarget / 60)}:{String(restTarget % 60).padStart(2, "0")}
            </span>
            <StepButton
              onClick={() =>
                updateExercise.mutate({
                  id: exercise.id,
                  restSeconds: Math.min(restTarget + 30, 600),
                })
              }
              label="Increase rest target"
            >
              <Plus size={18} strokeWidth={2} />
            </StepButton>
          </span>
        </div>

        <div className="mt-6">
          <ConfirmSwap
            label="Archive exercise"
            confirmLabel="Archive"
            onConfirm={() => {
              const { id, name } = exercise;
              archive.mutate(id);
              toast.show(`Archived ${name}`, {
                label: "Undo",
                onPress: () => restore.mutate(id),
              });
              onArchived();
            }}
          />
        </div>
      </div>

      <SetEditSheet set={editing} onClose={() => setEditing(null)} date={date} />
    </div>
  );
}

