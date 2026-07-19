"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { Screen } from "@/components/shell/screen";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ProgressRing } from "@/components/ui/progress-ring";
import { MacroGrid } from "@/components/ui/macro-grid";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { EntrySheet } from "@/components/food/entry-sheet";
import { MealsSheet } from "@/components/food/meals-sheet";
import { LogDetailSheet } from "@/components/food/log-detail-sheet";
import { NutritionHistory } from "@/components/food/nutrition-history";
import {
  useFoodLogs,
  useFoodSuggestions,
  useLogFood,
  useMeals,
  type FoodLog,
} from "@/hooks/use-food";
import { useSettings } from "@/hooks/use-settings";
import { useAppDate } from "@/hooks/use-app-date";
import { formatFullDate } from "@/lib/dates";
import { formatInt } from "@/lib/format";
import { springs } from "@/lib/motion";

export function FoodPanel({ isActive }: { isActive: boolean }) {
  const date = useAppDate();
  const settings = useSettings();
  const { data: logs = [] } = useFoodLogs(date);
  const { data: meals = [] } = useMeals();
  const { data: predictionData } = useFoodSuggestions(date);
  const logFood = useLogFood(date);

  const [entryOpen, setEntryOpen] = useState(false);
  const [mealsOpen, setMealsOpen] = useState(false);
  const [detail, setDetail] = useState<FoodLog | null>(null);

  const calories = logs.reduce((s, l) => s + l.calories, 0);
  const protein = logs.reduce((s, l) => s + l.proteinG, 0);
  const carbs = logs.reduce((s, l) => s + l.carbsG, 0);
  const fat = logs.reduce((s, l) => s + l.fatG, 0);
  const surplusHit = calories >= settings.calorieTarget;
  const suggestions = (predictionData?.suggestions ?? []).map((suggestion) => {
    const saved = suggestion.mealId
      ? meals.find((meal) => meal.id === suggestion.mealId)
      : null;
    return saved
      ? {
          ...suggestion,
          name: saved.name,
          calories: saved.calories,
          proteinG: saved.proteinG,
          carbsG: saved.carbsG,
          fatG: saved.fatG,
        }
      : suggestion;
  });
  const quickAdds =
    suggestions.length
      ? suggestions.slice(0, 5)
      : meals.slice(0, 5);

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <Screen label={formatFullDate(date)} title="Food">
      {/* hero ring */}
      <div className="flex flex-col items-center pt-2 pb-6">
        <ProgressRing
          value={settings.calorieTarget > 0 ? calories / settings.calorieTarget : 0}
          size={196}
          strokeWidth={12}
          isActive={isActive}
        >
          <AnimatedNumber value={calories} className="type-display" />
          <AnimatePresence mode="wait" initial={false}>
            {surplusHit ? (
              <motion.span
                key="hit"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={springs.snappy}
                className="type-label mt-1 text-accent"
              >
                Surplus hit
              </motion.span>
            ) : (
              <motion.span
                key="target"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="type-label mt-1 text-text-tertiary"
              >
                of {formatInt(settings.calorieTarget)}
              </motion.span>
            )}
          </AnimatePresence>
        </ProgressRing>
      </div>

      {/* macros that matter */}
      <div className="mb-8">
        <MacroGrid
          protein={{ current: protein, target: settings.proteinTargetG }}
          carbs={{ current: carbs, target: settings.carbTargetG }}
          fat={{ current: fat, target: settings.fatTargetG }}
          isActive={isActive}
        />
      </div>

      {/* personal predictions remain a one-tap log */}
      <div className="mb-2 flex items-center justify-between">
        <span className="type-label text-text-tertiary">Suggested now</span>
        {meals.length > 0 && (
          <Button
            variant="ghost"
            className="-mr-2 h-8 px-2"
            onClick={() => setMealsOpen(true)}
          >
            Meals
          </Button>
        )}
      </div>
      {quickAdds.length === 0 ? (
        <Card className="py-6 text-center">
          <p className="type-body text-text-secondary">
            Your usual foods will appear here automatically.
          </p>
          <p className="type-footnote mt-1 text-text-tertiary">
            Log something once to get started.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-border-subtle p-0 px-3">
          {quickAdds.map((food) => (
            <ListRow
              key={"key" in food ? food.key : food.id}
              title={food.name}
              subtitle={`${food.proteinG} g protein`}
              trailing={
                <span className="type-body tabular-nums text-text-secondary">
                  +{formatInt(food.calories)}
                </span>
              }
              onClick={() =>
                logFood.mutate({
                  date,
                  name: food.name,
                  calories: food.calories,
                  proteinG: food.proteinG,
                  carbsG: food.carbsG,
                  fatG: food.fatG,
                  mealId: "key" in food ? food.mealId : food.id,
                })
              }
            />
          ))}
        </Card>
      )}
      <Button
        variant="secondary"
        className="mt-3 w-full"
        onClick={() => setEntryOpen(true)}
      >
        <Plus size={18} strokeWidth={2} />
        Find or add food
      </Button>

      {/* today's log */}
      {logs.length > 0 && (
        <>
          <div className="mt-8 mb-2">
            <span className="type-label text-text-tertiary">Logged today</span>
          </div>
          <Card className="divide-y divide-border-subtle p-0 px-3">
            <AnimatePresence initial={false} mode="popLayout">
              {logs.map((log) => (
                <motion.div
                  key={log.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={springs.default}
                >
                  <ListRow
                    title={log.name}
                    subtitle={fmtTime(log.loggedAt)}
                    trailing={
                      <span className="type-body tabular-nums text-text-secondary">
                        {formatInt(log.calories)}
                      </span>
                    }
                    onClick={() => setDetail(log)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </Card>
        </>
      )}

      <NutritionHistory isActive={isActive} />

      <EntrySheet open={entryOpen} onOpenChange={setEntryOpen} date={date} />
      <MealsSheet open={mealsOpen} onOpenChange={setMealsOpen} />
      <LogDetailSheet log={detail} onClose={() => setDetail(null)} date={date} />
    </Screen>
  );
}
