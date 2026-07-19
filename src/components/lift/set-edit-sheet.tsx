"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ConfirmSwap } from "@/components/ui/confirm-swap";
import { useToast } from "@/components/ui/toast";
import {
  useDeleteSet,
  useLogSet,
  useUpdateSet,
  type WorkoutSet,
} from "@/hooks/use-workouts";
import { springs, press } from "@/lib/motion";
import { cn } from "@/lib/cn";

/** Tap a completed set → adjust or delete. Flags re-derive on their own. */
export function SetEditSheet({
  set,
  onClose,
  date,
}: {
  set: WorkoutSet | null;
  onClose: () => void;
  date: string;
}) {
  if (!set) return null;
  // key by id: fresh state per set, initialized from props — no sync effect
  return <SetEditBody key={set.id} set={set} onClose={onClose} date={date} />;
}

function SetEditBody({
  set,
  onClose,
  date,
}: {
  set: WorkoutSet;
  onClose: () => void;
  date: string;
}) {
  const [weight, setWeight] = useState(set.weightLbs);
  const [reps, setReps] = useState(set.reps);
  const [rpe, setRpe] = useState<number | null>(set.rpe);
  const [note, setNote] = useState(set.note ?? "");
  const update = useUpdateSet(date, set.exerciseId);
  const del = useDeleteSet(date, set.exerciseId);
  const relog = useLogSet(date);
  const toast = useToast();

  const remove = () => {
    const snapshot = set;
    del.mutate(snapshot.id);
    onClose();
    // undo re-logs the set; it gets a fresh server-assigned number at the
    // end of the session — set numbers keep gaps by design
    toast.show("Deleted set", {
      label: "Undo",
      onPress: () =>
        relog.mutate({
          exerciseId: snapshot.exerciseId,
          weightLbs: snapshot.weightLbs,
          reps: snapshot.reps,
          rpe: snapshot.rpe,
          note: snapshot.note,
        }),
    });
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="Edit set">
      <div className="px-4 pt-4 pb-2">
        <div className="type-label mb-4 text-center text-text-tertiary">
          Edit set
        </div>
        <div className="flex items-start justify-center gap-6">
          <Stepper
            value={weight}
            unit="lbs"
            onDecrement={() => setWeight((w) => Math.max(w - 5, 0))}
            onIncrement={() => setWeight((w) => Math.min(w + 5, 1500))}
          />
          <span className="type-title flex h-[2.375rem] items-center text-text-tertiary">
            ×
          </span>
          <Stepper
            value={reps}
            unit="reps"
            onDecrement={() => setReps((r) => Math.max(r - 1, 1))}
            onIncrement={() => setReps((r) => Math.min(r + 1, 100))}
          />
        </div>
        <div className="mt-5 flex min-h-11 items-center justify-between">
          <span className="type-footnote text-text-secondary">RPE</span>
          <span className="flex items-center gap-2">
            <StepButton
              onClick={() =>
                setRpe((r) => (r === null ? 8 : Math.max(r - 0.5, 5)))
              }
              label="Decrease RPE"
            >
              <Minus size={18} strokeWidth={2} />
            </StepButton>
            <span className="type-headline w-12 text-center tabular-nums">
              {rpe ?? "—"}
            </span>
            <StepButton
              onClick={() =>
                setRpe((r) => (r === null ? 8 : Math.min(r + 0.5, 10)))
              }
              label="Increase RPE"
            >
              <Plus size={18} strokeWidth={2} />
            </StepButton>
          </span>
        </div>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note — grip, tempo, pain…"
          maxLength={200}
          enterKeyHint="done"
          className={cn(
            "type-body mt-3 h-12 w-full rounded-md border border-border-subtle bg-overlay px-4",
            "text-text-primary placeholder:text-text-tertiary",
            "transition-colors duration-150 focus:border-border-strong",
          )}
        />
        <div className="mt-5 space-y-2">
          <Button
            className="w-full"
            onClick={() => {
              update.mutate({
                id: set.id,
                weightLbs: weight,
                reps,
                rpe,
                note: note.trim() === "" ? null : note.trim(),
              });
              onClose();
            }}
          >
            Save
          </Button>
          <ConfirmSwap
            label="Delete set"
            confirmLabel="Delete"
            onConfirm={remove}
          />
        </div>
      </div>
    </Sheet>
  );
}

function Stepper({
  value,
  unit,
  onDecrement,
  onIncrement,
}: {
  value: number;
  unit: string;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-baseline gap-1">
        <span className={cn("type-display tabular-nums")}>{value}</span>
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
