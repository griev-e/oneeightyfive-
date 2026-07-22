"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ConfirmSwap } from "@/components/ui/confirm-swap";
import { RpeStepper, Stepper, StepperSeparator } from "@/components/ui/stepper";
import { useToast } from "@/components/ui/toast";
import {
  useDeleteSet,
  useLogSet,
  useUpdateSet,
  type WorkoutSet,
} from "@/hooks/use-workouts";
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
          <StepperSeparator />
          <Stepper
            value={reps}
            unit="reps"
            onDecrement={() => setReps((r) => Math.max(r - 1, 1))}
            onIncrement={() => setReps((r) => Math.min(r + 1, 100))}
          />
        </div>
        <div className="mt-5">
          <RpeStepper value={rpe} onChange={setRpe} />
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
