"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ConfirmSwap } from "@/components/ui/confirm-swap";
import { NumberPad } from "@/components/ui/number-pad";
import { useDeleteWeighIn, useLogWeight } from "@/hooks/use-weight";
import { useToast } from "@/components/ui/toast";
import { formatFullDate, formatShortDate } from "@/lib/dates";
import { formatWeight } from "@/lib/format";
import { applyWeightKey } from "@/lib/numeric-entry";
import type { WeighIn } from "@/lib/stats";

/** Tap a history row → correct or delete that day. Delete gets an Undo. */
export function WeighInSheet({
  weighIn,
  onClose,
}: {
  weighIn: WeighIn | null;
  onClose: () => void;
}) {
  if (!weighIn) return null;
  // key by date: fresh state per entry, initialized from props — no sync effect
  return <WeighInBody key={weighIn.date} weighIn={weighIn} onClose={onClose} />;
}

function WeighInBody({
  weighIn,
  onClose,
}: {
  weighIn: WeighIn;
  onClose: () => void;
}) {
  const [entry, setEntry] = useState<string | null>(null);
  const logWeight = useLogWeight();
  const del = useDeleteWeighIn();
  const toast = useToast();

  const entryValue = entry ?? formatWeight(weighIn.weightLbs);

  const handleKey = (k: string) => {
    // first keypress replaces the prefilled weight
    setEntry((prev) => applyWeightKey(prev ?? "", k));
  };

  const save = () => {
    const v = parseFloat(entryValue);
    if (v >= 50 && v <= 500) {
      // the weight API is an upsert by date — an edit is just a re-PUT
      logWeight.mutate({ date: weighIn.date, weightLbs: v });
      onClose();
    }
  };

  const remove = () => {
    const snapshot = weighIn;
    del.mutate(snapshot.date);
    onClose();
    toast.show(`Deleted ${formatShortDate(snapshot.date)} weigh-in`, {
      label: "Undo",
      onPress: () => logWeight.mutate(snapshot),
    });
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title="Edit weigh-in">
      <div className="px-4 pt-4 pb-2">
        <div className="type-label mb-4 text-center text-text-tertiary">
          {formatFullDate(weighIn.date)}
        </div>
        <div className="mb-4 flex items-baseline justify-center gap-1.5">
          <span className="type-display">{entryValue || "0"}</span>
          <span className="type-footnote text-text-tertiary">lbs</span>
        </div>
        <NumberPad onKey={handleKey} />
        <div className="mt-4 space-y-2">
          <Button className="w-full" onClick={save}>
            Save
          </Button>
          <ConfirmSwap
            label="Delete weigh-in"
            confirmLabel="Delete"
            onConfirm={remove}
          />
        </div>
      </div>
    </Sheet>
  );
}
