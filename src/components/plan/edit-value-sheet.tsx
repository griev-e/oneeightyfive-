"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { NumberPad } from "@/components/ui/number-pad";
import { cn } from "@/lib/cn";

export type ValueFieldMeta = {
  label: string;
  unit: string;
  min: number;
  max: number;
  /** max entry length in characters (including a decimal point) */
  digits: number;
  decimal?: boolean;
};

/** Shared ranges for the four macro targets — one source for reveal + plan view. */
export const TARGET_META = {
  calories: { label: "Calories", unit: "cal", min: 1000, max: 10000, digits: 5 },
  protein: { label: "Protein", unit: "g", min: 30, max: 500, digits: 3 },
  carbs: { label: "Carbs", unit: "g", min: 50, max: 1200, digits: 4 },
  fat: { label: "Fat", unit: "g", min: 20, max: 400, digits: 3 },
} satisfies Record<string, ValueFieldMeta>;

/**
 * Number-pad entry for a single numeric value — the one edit surface shared
 * by the plan reveal's target tweaks and the plan view's settings rows.
 */
export function EditValueSheet({
  meta,
  value,
  onClose,
  onSave,
}: {
  /** null = closed */
  meta: ValueFieldMeta | null;
  value: number;
  onClose: () => void;
  onSave: (value: number) => void;
}) {
  const [entry, setEntry] = useState<string | null>(null);
  if (!meta) return null;
  const shown = entry ?? String(value);
  const parsed = meta.decimal ? parseFloat(shown || "0") : parseInt(shown || "0", 10);
  const valid = Number.isFinite(parsed) && parsed >= meta.min && parsed <= meta.max;

  return (
    <Sheet
      open={meta !== null}
      onOpenChange={(o) => {
        if (!o) {
          setEntry(null);
          onClose();
        }
      }}
      title={`Edit ${meta.label}`}
    >
      <div className="px-4 pt-4 pb-2">
        <div className="type-label mb-4 text-center text-text-tertiary">
          {meta.label}
        </div>
        <div className="mb-4 flex items-baseline justify-center gap-1.5">
          <span className={cn("type-display tabular-nums", !valid && "text-text-tertiary")}>
            {shown || "0"}
          </span>
          <span className="type-footnote text-text-tertiary">{meta.unit}</span>
        </div>
        <NumberPad
          decimal={meta.decimal ?? false}
          onKey={(k) => {
            setEntry((prev) => {
              const cur = prev ?? "";
              if (k === "del") return cur.slice(0, -1);
              if (k === "." && (!meta.decimal || cur.includes(".") || cur === ""))
                return cur;
              if (cur.length >= meta.digits) return cur;
              if (cur.includes(".") && cur.split(".")[1].length >= 2 && k !== ".")
                return cur;
              return cur + k;
            });
          }}
        />
        <Button
          className="mt-4 w-full"
          disabled={!valid}
          onClick={() => {
            onSave(parsed);
            setEntry(null);
          }}
        >
          Save
        </Button>
      </div>
    </Sheet>
  );
}
