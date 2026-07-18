"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { NumberPad } from "@/components/ui/number-pad";
import { springs } from "@/lib/motion";
import { formatInt } from "@/lib/format";
import type { Plan } from "@/lib/plan";
import { formatShortDate } from "@/lib/dates";
import { cn } from "@/lib/cn";

/**
 * The computed plan, staged in (opacity/rise only — the hero renders its
 * final number statically; numbers animate on change, never on mount).
 * Every value shows its "why". Editing any target marks the plan custom.
 */

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { ...springs.gentle, delay },
});

export type TargetOverrides = {
  calorieTarget: number;
  proteinG: number;
  carbG: number;
  fatG: number;
};

const MACRO_ROWS = [
  { key: "proteinG", label: "Protein", color: "var(--color-protein)", tint: "var(--color-protein-tint)" },
  { key: "carbG", label: "Carbs", color: "var(--color-carbs)", tint: "var(--color-carbs-tint)" },
  { key: "fatG", label: "Fat", color: "var(--color-fat)", tint: "var(--color-fat-tint)" },
] as const;

export function PlanReveal({
  plan,
  saving,
  saved,
  onStart,
}: {
  plan: Plan;
  saving: boolean;
  saved: boolean;
  onStart: (overrides: TargetOverrides, customized: boolean) => void;
}) {
  const [values, setValues] = useState<TargetOverrides>({
    calorieTarget: plan.calorieTarget,
    proteinG: plan.proteinG,
    carbG: plan.carbG,
    fatG: plan.fatG,
  });
  const [adjusting, setAdjusting] = useState(false);
  const [editing, setEditing] = useState<keyof TargetOverrides | null>(null);
  const customized =
    values.calorieTarget !== plan.calorieTarget ||
    values.proteinG !== plan.proteinG ||
    values.carbG !== plan.carbG ||
    values.fatG !== plan.fatG;

  const projectionLine =
    plan.projection.kind === "at-goal"
      ? "You're at your goal — this plan holds maintenance."
      : plan.projection.kind === "open-ended"
        ? "The pace tapers as you advance — this is a long-horizon goal."
        : `On pace to pass your goal around ${formatShortDate(plan.projection.projectedDate)}, ${new Date(plan.projection.projectedDate).getFullYear()}.`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-screen pb-6 pt-6">
        <div className="mx-auto max-w-2xl">
          <motion.div {...rise(0)} className="type-label text-text-tertiary">
            Your plan
          </motion.div>

          <motion.div {...rise(0.1)} className="mt-2 flex items-baseline gap-2">
            <span className="type-hero">{formatInt(values.calorieTarget)}</span>
            <span className="type-hero-unit text-text-secondary">cal / day</span>
          </motion.div>

          <motion.p {...rise(0.3)} className="type-body mt-3 text-text-secondary">
            {plan.flags.atGoal
              ? projectionLine
              : `Built for +${plan.rateLbsPerWeek.toFixed(2)} lb/week. ${projectionLine}`}
          </motion.p>

          {plan.flags.flooredToCurrent && (
            <motion.p {...rise(0.38)} className="type-footnote mt-2 text-text-tertiary">
              The formula said {formatInt(plan.computedCalorieTarget)} — your
              current target stays until your trend runs ahead of pace.
            </motion.p>
          )}

          <div className="mt-8 space-y-5">
            {MACRO_ROWS.map((row, i) => (
              <motion.button
                key={row.key}
                {...rise(0.45 + i * 0.08)}
                type="button"
                disabled={!adjusting}
                onClick={() => setEditing(row.key)}
                className="block w-full text-left"
              >
                <div className="flex items-baseline justify-between">
                  <span className="type-label text-text-tertiary">
                    {row.label}
                    {adjusting && (
                      <span className="ml-2 text-text-tertiary/60">edit</span>
                    )}
                  </span>
                  <span className="type-stat">
                    {values[row.key]}
                    <span className="type-footnote ml-1 text-text-tertiary">g</span>
                  </span>
                </div>
                <div
                  className="mt-2 h-1 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: row.tint }}
                >
                  <motion.div
                    className="h-full origin-left rounded-full"
                    style={{ backgroundColor: row.color }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ ...springs.gentle, delay: 0.5 + i * 0.08 }}
                  />
                </div>
              </motion.button>
            ))}
          </div>

          <motion.div {...rise(0.8)} className="mt-8">
            <Card className="divide-y divide-border-subtle p-0 px-4">
              {(
                [
                  ["Base metabolism", `${formatInt(plan.bmr)} cal`, plan.explain.tdee],
                  ["Gain rate", `${plan.rateLbsPerWeek.toFixed(2)} lb/wk`, plan.explain.rate],
                  ["Calories", `${formatInt(values.calorieTarget)}`, plan.explain.calories],
                  ["Protein", `${values.proteinG} g`, plan.explain.protein],
                  ["Fat", `${values.fatG} g`, plan.explain.fat],
                  ["Carbs", `${values.carbG} g`, plan.explain.carbs],
                ] as const
              ).map(([label, value, why]) => (
                <div key={label} className="py-3">
                  <div className="flex items-baseline justify-between">
                    <span className="type-body text-text-primary">{label}</span>
                    <span className="type-body tabular-nums text-text-secondary">
                      {value}
                    </span>
                  </div>
                  <p className="type-footnote mt-0.5 text-text-tertiary">{why}</p>
                </div>
              ))}
              <div className="py-3">
                <p className="type-footnote text-text-tertiary">
                  Fiber guideline: ~{plan.fiberGuidelineG} g/day (not tracked —
                  just eat plants).
                </p>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>

      <motion.div
        {...rise(0.95)}
        className="px-screen pb-[max(env(safe-area-inset-bottom),24px)] pt-2"
      >
        <div className="mx-auto max-w-2xl space-y-2 lg:max-w-105">
          <Button
            className="w-full"
            disabled={saving || saved}
            onClick={() => onStart(values, customized)}
          >
            {saved ? (
              <span className="flex items-center gap-2">
                <Check size={20} strokeWidth={2.5} />
                Started
              </span>
            ) : customized ? (
              "Start custom plan"
            ) : (
              "Start plan"
            )}
          </Button>
          {!adjusting && !saved && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setAdjusting(true)}
            >
              Adjust manually
            </Button>
          )}
        </div>
      </motion.div>

      <EditTargetSheet
        field={editing}
        values={values}
        onClose={() => setEditing(null)}
        onSave={(field, v) => {
          setValues((prev) => ({ ...prev, [field]: v }));
          setEditing(null);
        }}
      />
    </div>
  );
}

const FIELD_META: Record<
  keyof TargetOverrides,
  { label: string; unit: string; min: number; max: number; digits: number }
> = {
  calorieTarget: { label: "Calories", unit: "cal", min: 1000, max: 10000, digits: 5 },
  proteinG: { label: "Protein", unit: "g", min: 30, max: 500, digits: 3 },
  carbG: { label: "Carbs", unit: "g", min: 50, max: 1200, digits: 4 },
  fatG: { label: "Fat", unit: "g", min: 20, max: 400, digits: 3 },
};

function EditTargetSheet({
  field,
  values,
  onClose,
  onSave,
}: {
  field: keyof TargetOverrides | null;
  values: TargetOverrides;
  onClose: () => void;
  onSave: (field: keyof TargetOverrides, value: number) => void;
}) {
  const [entry, setEntry] = useState<string | null>(null);
  if (!field) return null;
  const meta = FIELD_META[field];
  const shown = entry ?? String(values[field]);
  const parsed = parseInt(shown || "0", 10);
  const valid = parsed >= meta.min && parsed <= meta.max;

  return (
    <Sheet
      open={field !== null}
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
          <span className={cn("type-display", !valid && "text-text-tertiary")}>
            {shown || "0"}
          </span>
          <span className="type-footnote text-text-tertiary">{meta.unit}</span>
        </div>
        <NumberPad
          decimal={false}
          onKey={(k) => {
            setEntry((prev) => {
              const cur = prev ?? "";
              if (k === "del") return cur.slice(0, -1);
              if (cur.length >= meta.digits) return cur;
              return cur + k;
            });
          }}
        />
        <Button
          className="mt-4 w-full"
          disabled={!valid}
          onClick={() => {
            onSave(field, parsed);
            setEntry(null);
          }}
        >
          Save
        </Button>
      </div>
    </Sheet>
  );
}
