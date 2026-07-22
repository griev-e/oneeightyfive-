"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NumberPad } from "@/components/ui/number-pad";
import { useLogWeight, useWeighIns } from "@/hooks/use-weight";
import { getAppDate } from "@/lib/dates";
import { applyWeightKey } from "@/lib/numeric-entry";
import { formatWeight } from "@/lib/format";

/**
 * Today's weigh-in entry — prefilled with the last weight so the common
 * case is two taps. Shared between the Weight panel footer and the Today
 * quick-log.
 */
export function LogWeightSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: weighIns = [] } = useWeighIns();
  const logWeight = useLogWeight();
  const [entry, setEntry] = useState<string | null>(null);

  const latest = weighIns[weighIns.length - 1];
  const entryValue = entry ?? (latest ? formatWeight(latest.weightLbs) : "");

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) setEntry(null);
  };

  const handleKey = (k: string) => {
    // first keypress replaces the prefilled last weight
    setEntry((prev) => applyWeightKey(prev ?? "", k));
  };

  const save = () => {
    const v = parseFloat(entryValue);
    if (v >= 50 && v <= 500) {
      logWeight.mutate({ date: getAppDate(), weightLbs: v });
      close(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={close} title="Log weight">
      <div className="px-4 pt-4 pb-2">
        <div className="type-label mb-4 text-center text-text-tertiary">
          Today&apos;s weight
        </div>
        <div className="mb-4 flex items-baseline justify-center gap-1.5">
          <span className="type-display">{entryValue || "0"}</span>
          <span className="type-footnote text-text-tertiary">lbs</span>
        </div>
        <NumberPad onKey={handleKey} />
        <Button className="mt-4 w-full" onClick={save}>
          Save
        </Button>
      </div>
    </Sheet>
  );
}
