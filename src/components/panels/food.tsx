"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { Screen } from "@/components/shell/screen";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ProgressRing } from "@/components/ui/progress-ring";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { Sheet } from "@/components/ui/sheet";
import { NumberPad } from "@/components/ui/number-pad";
import { useMock } from "@/lib/mock";
import { formatFullDate } from "@/lib/dates";
import { formatInt } from "@/lib/format";
import { springs } from "@/lib/motion";

export function FoodPanel({ isActive }: { isActive: boolean }) {
  const mock = useMock();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [entry, setEntry] = useState("");

  const calories = mock.foodLogs.reduce((s, f) => s + f.calories, 0);
  const protein = mock.foodLogs.reduce((s, f) => s + f.proteinG, 0);
  const surplusHit = calories >= mock.calorieTarget;

  const handleKey = (k: string) => {
    setEntry((cur) => {
      if (k === "del") return cur.slice(0, -1);
      if (k === ".") return cur; // whole calories only
      if (cur.length >= 4) return cur;
      if (cur === "" && k === "0") return cur;
      return cur + k;
    });
  };

  const addCustom = () => {
    const v = parseInt(entry, 10);
    if (v > 0) {
      mock.logFood({ name: "Quick add", calories: v, proteinG: 0 });
      setSheetOpen(false);
      setEntry("");
    }
  };

  return (
    <Screen label={formatFullDate(mock.appDate)} title="Food">
      {/* hero ring */}
      <div className="flex flex-col items-center pt-2 pb-6">
        <ProgressRing
          value={calories / mock.calorieTarget}
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
                of {formatInt(mock.calorieTarget)}
              </motion.span>
            )}
          </AnimatePresence>
        </ProgressRing>
      </div>

      {/* protein */}
      <div className="mb-8">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="type-label text-text-tertiary">Protein</span>
          <span className="type-footnote tabular-nums text-text-secondary">
            <AnimatedNumber value={protein} /> / {mock.proteinTarget} g
          </span>
        </div>
        <ProgressBar value={protein / mock.proteinTarget} isActive={isActive} />
      </div>

      {/* quick add — saved meals, one tap to log */}
      <div className="mb-2 flex items-center justify-between">
        <span className="type-label text-text-tertiary">Quick add</span>
      </div>
      <Card className="divide-y divide-border-subtle p-0 px-3">
        {mock.meals.slice(0, 5).map((meal) => (
          <ListRow
            key={meal.id}
            title={meal.name}
            subtitle={`${meal.proteinG} g protein`}
            trailing={
              <span className="type-body tabular-nums text-text-secondary">
                +{formatInt(meal.calories)}
              </span>
            }
            onClick={() => mock.logFood(meal)}
          />
        ))}
      </Card>
      <Button
        variant="secondary"
        className="mt-3 w-full"
        onClick={() => setSheetOpen(true)}
      >
        <Plus size={18} strokeWidth={2} />
        Add custom
      </Button>

      {/* today's log */}
      {mock.foodLogs.length > 0 && (
        <>
          <div className="mt-8 mb-2">
            <span className="type-label text-text-tertiary">Logged today</span>
          </div>
          <Card className="divide-y divide-border-subtle p-0 px-3">
            <AnimatePresence initial={false} mode="popLayout">
              {mock.foodLogs.map((log) => (
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
                    subtitle={log.loggedAt}
                    trailing={
                      <span className="type-body tabular-nums text-text-secondary">
                        {formatInt(log.calories)}
                      </span>
                    }
                    onClick={() => mock.removeFood(log.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </Card>
          <p className="type-footnote mt-2 text-text-tertiary">
            Tap an entry to remove it.
          </p>
        </>
      )}

      <Sheet
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) setEntry("");
        }}
        title="Add calories"
      >
        <div className="px-4 pt-4 pb-2">
          <div className="type-label mb-4 text-center text-text-tertiary">
            Calories
          </div>
          <div className="mb-4 flex items-baseline justify-center gap-1.5">
            <span className="type-display">{entry || "0"}</span>
            <span className="type-footnote text-text-tertiary">cal</span>
          </div>
          <NumberPad onKey={handleKey} />
          <Button className="mt-4 w-full" onClick={addCustom}>
            Add
          </Button>
        </div>
      </Sheet>
    </Screen>
  );
}
