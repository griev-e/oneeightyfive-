"use client";

import { useState } from "react";
import { m } from "motion/react";
import { NumberPad } from "@/components/ui/number-pad";
import { press, springs } from "@/lib/motion";
import { cn } from "@/lib/cn";

/**
 * The four-field entry strip: Cal / P / C / F chips (the macro palette's
 * sanctioned entry surface) over one shared number pad. Integers only.
 * Prefilled values are replaced by the first keypress on a field — the
 * fast-correction pattern the weight sheet established.
 */

export type MacroValues = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

const FIELDS = [
  { key: "calories", label: "Cal", max: 4, activeText: "text-text-primary", activeBorder: "border-border-strong" },
  { key: "proteinG", label: "Protein", max: 3, activeText: "text-protein", activeBorder: "border-protein-border" },
  { key: "carbsG", label: "Carbs", max: 3, activeText: "text-carbs", activeBorder: "border-carbs-border" },
  { key: "fatG", label: "Fat", max: 3, activeText: "text-fat", activeBorder: "border-fat-border" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

export function MacroFields({
  values,
  onChange,
}: {
  values: MacroValues;
  onChange: (next: MacroValues) => void;
}) {
  const [active, setActive] = useState<FieldKey>("calories");
  const [touched, setTouched] = useState<Set<FieldKey>>(new Set());

  const handleKey = (k: string) => {
    const field = FIELDS.find((f) => f.key === active)!;
    const fresh = !touched.has(active);
    const cur = fresh ? "" : String(values[active] || "");
    let next: string;
    if (k === "del") next = cur.slice(0, -1);
    else if (cur.length >= field.max) next = cur;
    else next = cur + k;
    setTouched((t) => new Set(t).add(active));
    onChange({ ...values, [active]: next === "" ? 0 : parseInt(next, 10) });
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 px-4">
        {FIELDS.map((f) => {
          const isActive = f.key === active;
          const v = values[f.key];
          return (
            <m.button
              key={f.key}
              type="button"
              aria-pressed={isActive}
              whileTap={{ scale: press.button }}
              transition={springs.instant}
              onClick={() => {
                setActive(f.key);
                setTouched((t) => {
                  const n = new Set(t);
                  n.delete(f.key); // first keypress replaces the shown value
                  return n;
                });
              }}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-0.5 rounded-md border bg-raised",
                "transition-colors duration-150",
                isActive ? f.activeBorder : "border-border-subtle",
              )}
            >
              <span
                className={cn(
                  "type-label",
                  isActive ? f.activeText : "text-text-tertiary",
                )}
              >
                {f.label}
              </span>
              <span
                className={cn(
                  "type-headline tabular-nums",
                  v === 0 && "text-text-tertiary",
                )}
              >
                {v}
              </span>
            </m.button>
          );
        })}
      </div>
      <div className="mt-3">
        <NumberPad onKey={handleKey} decimal={false} />
      </div>
    </div>
  );
}
