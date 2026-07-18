"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MacroFields, type MacroValues } from "./macro-fields";
import { useCreateMeal, useLogFood } from "@/hooks/use-food";
import { cn } from "@/lib/cn";

const EMPTY: MacroValues = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };

/**
 * Custom food entry. Calories-only stays a 2-tap path ("Log" enables at
 * cal ≥ 1); macros are optional; "Save as meal" turns tonight's dinner into
 * tomorrow's quick-add.
 */
export function EntrySheet({
  open,
  onOpenChange,
  date,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
}) {
  const [values, setValues] = useState<MacroValues>(EMPTY);
  const [name, setName] = useState("");
  const [saveAsMeal, setSaveAsMeal] = useState(false);
  const [nameNudge, setNameNudge] = useState(false);
  const logFood = useLogFood(date);
  const createMeal = useCreateMeal();

  const reset = () => {
    setValues(EMPTY);
    setName("");
    setSaveAsMeal(false);
    setNameNudge(false);
  };

  const submit = () => {
    if (values.calories < 1) return;
    const trimmed = name.trim();
    if (saveAsMeal && !trimmed) {
      setNameNudge(true);
      return;
    }
    if (saveAsMeal) {
      createMeal.mutate(
        { name: trimmed, ...values },
        {
          onSuccess: (meal) =>
            logFood.mutate({ date, name: trimmed, ...values, mealId: meal.id }),
          onError: () => logFood.mutate({ date, name: trimmed, ...values }),
        },
      );
    } else {
      logFood.mutate({ date, name: trimmed || "Quick add", ...values });
    }
    onOpenChange(false);
    reset();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
      title="Add food"
    >
      <div className="pt-4 pb-2">
        <div className="px-4">
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameNudge(false);
            }}
            placeholder="Name (optional)"
            maxLength={80}
            className={cn(
              "type-body h-12 w-full rounded-md border bg-raised px-4 text-text-primary",
              "placeholder:text-text-tertiary focus:border-border-strong",
              "transition-colors duration-150",
              nameNudge ? "border-border-strong" : "border-border-subtle",
            )}
          />
        </div>
        <div className="mt-3">
          <MacroFields values={values} onChange={setValues} />
        </div>
        <button
          type="button"
          onClick={() => setSaveAsMeal((s) => !s)}
          className="mx-4 mt-3 flex h-12 w-[calc(100%-2rem)] items-center justify-between"
        >
          <span className="type-body text-text-secondary">
            Save as meal for quick-add
          </span>
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-md border transition-colors duration-150",
              saveAsMeal
                ? "border-border-strong bg-raised text-text-primary"
                : "border-border-default text-transparent",
            )}
          >
            <Check size={14} strokeWidth={2.5} />
          </span>
        </button>
        <div className="px-4">
          <Button
            className="mt-2 w-full"
            disabled={values.calories < 1}
            onClick={submit}
          >
            Log
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
