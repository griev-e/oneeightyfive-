"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { Screen } from "@/components/shell/screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { CheckDraw } from "@/components/ui/check-draw";
import { PRBadge } from "@/components/ui/pr-badge";
import { useMock, type Exercise } from "@/lib/mock";
import { daysBetween } from "@/lib/dates";
import { springs, press } from "@/lib/motion";
import { cn } from "@/lib/cn";

export function LiftPanel() {
  const mock = useMock();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = mock.exercises.find((e) => e.id === selectedId) ?? null;

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

  return (
    <div className="relative h-full lg:grid lg:grid-cols-[340px_1fr]">
      <div className="h-full lg:border-r lg:border-border-subtle">
        <Screen label="This week: 2 of 3 sessions" title="Lift">
          <Card className="divide-y divide-border-subtle p-0 px-3">
            {mock.exercises.map((ex) => {
              const top = ex.lastSession[0];
              const ago = daysBetween(ex.lastSessionDate, mock.appDate);
              return (
                <ListRow
                  key={ex.id}
                  title={ex.name}
                  subtitle={
                    top
                      ? `Last: ${top.weightLbs > 0 ? `${top.weightLbs} × ${top.reps}` : `${top.reps} reps`} · ${ago}d ago`
                      : "No history"
                  }
                  trailing={
                    <span className="flex items-center gap-2">
                      {ex.today.length > 0 && (
                        <span className="type-footnote tabular-nums text-accent">
                          {ex.today.length}{" "}
                          {ex.today.length === 1 ? "set" : "sets"}
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
          </Card>
          <p className="type-footnote mt-3 text-text-tertiary">
            Beat the ghost — last session&apos;s numbers are the game.
          </p>
        </Screen>
      </div>

      {/* iPad: persistent detail column placeholder */}
      <div className="hidden h-full items-center justify-center lg:flex">
        {!selected && (
          <span className="type-body text-text-tertiary">
            Choose an exercise
          </span>
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
              onBack={() => window.history.back()}
              onLogSet={(w, r) => mock.logSet(selected.id, w, r)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExerciseDetail({
  exercise,
  onBack,
  onLogSet,
}: {
  exercise: Exercise;
  onBack: () => void;
  onLogSet: (weightLbs: number, reps: number) => void;
}) {
  const setIndex = exercise.today.length;
  const ghost =
    exercise.lastSession[setIndex] ??
    exercise.lastSession[exercise.lastSession.length - 1];

  const [weight, setWeight] = useState(ghost?.weightLbs ?? 45);
  const [reps, setReps] = useState(ghost?.reps ?? 8);

  const bodyweight = exercise.lastSession.every((s) => s.weightLbs === 0);

  return (
    <div className="h-full overflow-y-auto overscroll-contain px-screen pb-tab-clearance">
      <header className="mx-auto max-w-2xl pt-[calc(env(safe-area-inset-top)+12px)]">
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
          {ghost
            ? `Last session: ${
                bodyweight
                  ? exercise.lastSession.map((s) => s.reps).join(" · ")
                  : exercise.lastSession
                      .map((s) => `${s.weightLbs}×${s.reps}`)
                      .join(" · ")
              }`
            : "First session — set the baseline"}
        </p>
      </header>

      <div className="mx-auto mt-6 max-w-2xl">
        {/* completed sets */}
        {exercise.today.length > 0 && (
          <Card className="mb-4 divide-y divide-border-subtle p-0 px-4">
            <AnimatePresence initial={false}>
              {exercise.today.map((set, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={springs.default}
                  className="flex min-h-14 items-center justify-between py-2"
                >
                  <span className="type-label text-text-tertiary">
                    Set {i + 1}
                  </span>
                  <span className="flex items-center gap-3">
                    {set.flag === "pr" && <PRBadge />}
                    {set.flag === "overload" && (
                      <span className="type-footnote font-medium text-accent">
                        ▲
                      </span>
                    )}
                    <span className="type-headline tabular-nums">
                      {set.weightLbs > 0
                        ? `${set.weightLbs} × ${set.reps}`
                        : `${set.reps} reps`}
                    </span>
                    <CheckDraw checked variant={set.flag === "pr" ? "pr" : "default"} size={26} />
                  </span>
                </motion.div>
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
              highlight={!!ghost && weight > ghost.weightLbs}
            />
            {/* aligned to the numeral row (display line-height), not the column */}
            <span className="type-title flex h-[2.375rem] items-center text-text-tertiary">
              ×
            </span>
            <Stepper
              value={reps}
              unit="reps"
              onDecrement={() => setReps((r) => Math.max(r - 1, 1))}
              onIncrement={() => setReps((r) => Math.min(r + 1, 100))}
              highlight={
                !!ghost && weight === ghost.weightLbs && reps > ghost.reps
              }
            />
          </div>

          <Button
            className="mt-5 w-full"
            onClick={() => onLogSet(weight, reps)}
          >
            Complete set
          </Button>
        </Card>
      </div>
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
