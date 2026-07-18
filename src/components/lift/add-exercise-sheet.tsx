"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCreateExercise } from "@/hooks/use-workouts";
import { cn } from "@/lib/cn";

/** Inline exercise creation; drill-in waits for the real id (no tmp-id races). */
export function AddExerciseSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const create = useCreateExercise();

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setName("");
      }}
      title="Add exercise"
    >
      <div className="px-4 pt-4 pb-2">
        <div className="type-label mb-3 text-text-tertiary">New exercise</div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Incline Bench Press"
          maxLength={60}
          className={cn(
            "type-body h-12 w-full rounded-md border border-border-subtle bg-raised px-4",
            "text-text-primary placeholder:text-text-tertiary",
            "focus:border-border-strong transition-colors duration-150",
          )}
        />
        <Button
          className="mt-4 w-full"
          disabled={name.trim().length === 0 || create.isPending}
          onClick={() =>
            create.mutate(name.trim(), {
              onSuccess: (exercise) => {
                onOpenChange(false);
                setName("");
                onCreated(exercise.id);
              },
            })
          }
        >
          Add
        </Button>
      </div>
    </Sheet>
  );
}
