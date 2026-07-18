"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ListRow } from "@/components/ui/list-row";
import { ConfirmSwap } from "@/components/ui/confirm-swap";
import { MacroFields, type MacroValues } from "./macro-fields";
import {
  useArchiveMeal,
  useMeals,
  useUpdateMeal,
  type Meal,
} from "@/hooks/use-food";
import { formatInt } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Saved-meal manager: list ⇄ detail as a content crossfade inside ONE sheet
 * (sheets never stack). Archive keeps history intact — logs snapshot macros.
 */
export function MealsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: meals = [] } = useMeals();
  const [selected, setSelected] = useState<Meal | null>(null);
  const [values, setValues] = useState<MacroValues>({
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
  });
  const [name, setName] = useState("");
  const update = useUpdateMeal();
  const archive = useArchiveMeal();

  const openDetail = (meal: Meal) => {
    setSelected(meal);
    setName(meal.name);
    setValues({
      calories: meal.calories,
      proteinG: meal.proteinG,
      carbsG: meal.carbsG,
      fatG: meal.fatG,
    });
  };

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) setSelected(null);
  };

  return (
    <Sheet open={open} onOpenChange={close} title="Saved meals">
      <AnimatePresence mode="wait" initial={false}>
        {selected === null ? (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="px-4 pt-4 pb-2"
          >
            <div className="type-label mb-2 text-text-tertiary">
              Saved meals
            </div>
            {meals.length === 0 ? (
              <p className="type-body py-6 text-center text-text-tertiary">
                No saved meals yet — log a custom food and save it.
              </p>
            ) : (
              <div className="max-h-96 divide-y divide-border-subtle overflow-y-auto overscroll-contain">
                {meals.map((meal) => (
                  <ListRow
                    key={meal.id}
                    title={meal.name}
                    subtitle={`${meal.proteinG} g protein`}
                    trailing={
                      <span className="flex items-center gap-2">
                        <span className="type-body tabular-nums text-text-secondary">
                          {formatInt(meal.calories)}
                        </span>
                        <ChevronRight
                          size={18}
                          strokeWidth={1.75}
                          className="text-text-tertiary"
                        />
                      </span>
                    }
                    onClick={() => openDetail(meal)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="detail"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="pt-4 pb-2"
          >
            <div className="px-4">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                className={cn(
                  "type-body h-12 w-full rounded-md border border-border-subtle bg-raised px-4",
                  "text-text-primary focus:border-border-strong transition-colors duration-150",
                )}
              />
            </div>
            <div className="mt-3">
              <MacroFields values={values} onChange={setValues} />
            </div>
            <div className="mt-3 space-y-2 px-4">
              <Button
                className="w-full"
                disabled={values.calories < 1 || name.trim().length === 0}
                onClick={() => {
                  update.mutate({
                    id: selected.id,
                    name: name.trim(),
                    ...values,
                  });
                  setSelected(null);
                }}
              >
                Save
              </Button>
              <ConfirmSwap
                label="Remove from quick-add"
                confirmLabel="Remove"
                onConfirm={() => {
                  archive.mutate(selected.id);
                  setSelected(null);
                }}
              />
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setSelected(null)}
              >
                Back
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}
