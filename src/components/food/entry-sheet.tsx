"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronLeft, Search } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ListRow } from "@/components/ui/list-row";
import { NumberPad } from "@/components/ui/number-pad";
import { MacroFields, type MacroValues } from "./macro-fields";
import {
  BarcodeCapture,
  DescriptionCapture,
  FoodInputActions,
  ImageCapture,
  type CaptureMode,
} from "./food-capture";
import {
  useCreateMeal,
  useFoodSuggestions,
  useLogFood,
  useLogFoods,
  useMeals,
} from "@/hooks/use-food";
import { useCatalogSearch } from "@/hooks/use-food-capture";
import { cn } from "@/lib/cn";
import {
  foodKey,
  scaleFood,
  type FoodSuggestion,
} from "@/lib/food-suggestions";
import type { AnalyzedFood } from "@/lib/food-ai";
import type { CatalogFood } from "@/lib/food-catalog";
import { formatInt } from "@/lib/format";
import { springs } from "@/lib/motion";

const EMPTY: MacroValues = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
const PORTIONS = [
  { value: 0.5, label: "½×" },
  { value: 1, label: "1×" },
  { value: 1.5, label: "1½×" },
  { value: 2, label: "2×" },
] as const;

type FoodChoice = FoodSuggestion & {
  servingLabel?: string;
  detail?: string;
};

type SheetView = "browse" | "custom" | CaptureMode;

function useDebouncedValue(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [delay, value]);
  return debounced;
}

function catalogChoice(food: CatalogFood): FoodChoice {
  return {
    key: `catalog:${food.id}`,
    name: food.brand ? `${food.name} · ${food.brand}` : food.name,
    calories: food.calories,
    proteinG: food.proteinG,
    carbsG: food.carbsG,
    fatG: food.fatG,
    mealId: null,
    lastUsedDate: "",
    servingLabel: food.servingLabel,
    detail:
      food.source === "usda"
        ? "USDA FoodData Central"
        : "Open Food Facts",
  };
}

function analysisChoice(food: AnalyzedFood): FoodChoice {
  return {
    key: `estimate:${crypto.randomUUID()}`,
    name: food.name,
    calories: food.calories,
    proteinG: food.proteinG,
    carbsG: food.carbsG,
    fatG: food.fatG,
    mealId: null,
    lastUsedDate: "",
    servingLabel: food.servingLabel,
    detail: `${food.confidence} confidence${food.notes ? ` · ${food.notes}` : ""}`,
  };
}

/**
 * One add surface: personal predictions and history first, portions second,
 * manual entry last. It learns entirely from the user's own log, so repeated
 * foods become zero-entry choices without an external nutrition database.
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
  const [view, setView] = useState<SheetView>("browse");
  const [selected, setSelected] = useState<FoodChoice | null>(null);
  const [portion, setPortion] = useState(1);
  // Amount entry for foods whose only known basis is 100 g (no serving in
  // any database) — ½×–2× of 100 g can't reach a 473 ml bottle.
  const [grams, setGrams] = useState(100);
  const [gramsTouched, setGramsTouched] = useState(false);
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<MacroValues>(EMPTY);
  const [name, setName] = useState("");
  const [saveAsMeal, setSaveAsMeal] = useState(false);
  const [nameNudge, setNameNudge] = useState(false);
  const { data: predictionData } = useFoodSuggestions(date);
  const { data: meals = [] } = useMeals();
  const catalogQuery = useDebouncedValue(
    query.trim().toLocaleLowerCase("en-US"),
    350,
  );
  const { data: catalogData, isFetching: catalogLoading } =
    useCatalogSearch(catalogQuery);
  const logFood = useLogFood(date);
  const copyDay = useLogFoods(date);
  const createMeal = useCreateMeal();

  const choose = (choice: FoodChoice) => {
    setSelected(choice);
    setPortion(1);
    setGrams(100);
    setGramsTouched(false);
  };

  const reset = () => {
    setView("browse");
    setSelected(null);
    setPortion(1);
    setGrams(100);
    setGramsTouched(false);
    setQuery("");
    setValues(EMPTY);
    setName("");
    setSaveAsMeal(false);
    setNameNudge(false);
  };

  const choices = useMemo(() => {
    const unique = new Map<string, FoodChoice>();
    for (const suggestion of predictionData?.suggestions ?? []) {
      unique.set(suggestion.key, suggestion);
    }
    for (const meal of meals) {
      const key = foodKey({ name: meal.name, mealId: meal.id });
      // An edited saved meal is newer truth than its historical log snapshot.
      unique.set(key, {
        key,
        name: meal.name,
        calories: meal.calories,
        proteinG: meal.proteinG,
        carbsG: meal.carbsG,
        fatG: meal.fatG,
        mealId: meal.id,
        lastUsedDate: "",
      });
    }
    return [...unique.values()];
  }, [meals, predictionData?.suggestions]);

  const filteredChoices = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("en-US");
    if (!normalized) return choices;
    const local = choices.filter((choice) =>
      choice.name.toLocaleLowerCase("en-US").includes(normalized),
    );
    const remote =
      catalogQuery === normalized
        ? (catalogData?.foods ?? []).map(catalogChoice)
        : [];
    const unique = new Map<string, FoodChoice>();
    for (const choice of [...local, ...remote]) unique.set(choice.key, choice);
    return [...unique.values()];
  }, [catalogData?.foods, catalogQuery, choices, query]);

  const yesterday = predictionData?.yesterday ?? [];
  const yesterdayCalories = yesterday.reduce(
    (sum, item) => sum + item.calories,
    0,
  );

  const close = () => {
    onOpenChange(false);
    reset();
  };

  const per100 = selected?.servingLabel === "100 g";
  const scale = per100 ? grams / 100 : portion;

  const handleGramsKey = (key: string) => {
    const current = gramsTouched ? String(grams || "") : "";
    let next: string;
    if (key === "del") next = current.slice(0, -1);
    else if (current.length >= 4) next = current;
    else next = current + key;
    setGramsTouched(true);
    setGrams(next === "" ? 0 : parseInt(next, 10));
  };

  const submitCustom = () => {
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
    close();
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
      <AnimatePresence mode="wait" initial={false}>
        {selected ? (
          <motion.div
            key="portion"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={springs.default}
            className="px-4 pt-3 pb-2"
          >
            <button
              type="button"
              aria-label="Back to foods"
              className="mb-1 flex size-11 items-center justify-center rounded-md text-text-secondary"
              onClick={() => {
                setSelected(null);
                setPortion(1);
                setGrams(100);
                setGramsTouched(false);
              }}
            >
              <ChevronLeft size={20} strokeWidth={1.75} />
            </button>
            <div className="type-title">{selected.name}</div>
            <div className="type-footnote mt-1 text-text-tertiary">
              {per100
                ? "No serving on record — enter the amount you had"
                : selected.servingLabel
                  ? `Nutrition per ${selected.servingLabel}`
                  : "Choose how much you had"}
            </div>
            {selected.detail && (
              <div className="type-footnote mt-2 text-text-secondary">
                {selected.detail}
              </div>
            )}

            {per100 ? (
              <div className="mt-5">
                <div className="flex h-14 items-center justify-between rounded-md border border-border-strong bg-raised px-4">
                  <span className="type-label text-text-tertiary">
                    Amount · g or ml
                  </span>
                  <span
                    className={cn(
                      "type-headline tabular-nums",
                      grams === 0 && "text-text-tertiary",
                    )}
                  >
                    {grams}
                  </span>
                </div>
                <div className="mt-3 -mx-4">
                  <NumberPad onKey={handleGramsKey} decimal={false} />
                </div>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-4 gap-2">
                {PORTIONS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={portion === item.value}
                    onClick={() => setPortion(item.value)}
                    className={cn(
                      "type-body h-11 rounded-md border bg-raised tabular-nums",
                      portion === item.value
                        ? "border-border-strong text-text-primary"
                        : "border-border-subtle text-text-secondary",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            <MacroPreview food={scaleFood(selected, scale)} />

            <Button
              className="mt-5 w-full"
              disabled={per100 && grams < 1}
              onClick={() => {
                const food = scaleFood(selected, scale);
                logFood.mutate({
                  date,
                  name: food.name,
                  calories: food.calories,
                  proteinG: food.proteinG,
                  carbsG: food.carbsG,
                  fatG: food.fatG,
                  mealId: food.mealId,
                });
                close();
              }}
            >
              Log {formatInt(scaleFood(selected, scale).calories)} cal
            </Button>
            <Button
              variant="ghost"
              className="mt-1 w-full"
              onClick={() => {
                const food = scaleFood(selected, scale);
                setName(food.name);
                setValues({
                  calories: food.calories,
                  proteinG: food.proteinG,
                  carbsG: food.carbsG,
                  fatG: food.fatG,
                });
                setSelected(null);
                setView("custom");
              }}
            >
              Edit macros
            </Button>
          </motion.div>
        ) : view !== "browse" && view !== "custom" ? (
          <motion.div
            key={view}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={springs.default}
            className="px-4 pt-3 pb-2"
          >
            <button
              type="button"
              aria-label="Back to add food"
              className="mb-1 flex size-11 items-center justify-center rounded-md text-text-secondary"
              onClick={() => setView("browse")}
            >
              <ChevronLeft size={20} strokeWidth={1.75} />
            </button>
            <div className="type-title mb-4">
              {view === "barcode"
                ? "Scan barcode"
                : view === "label"
                  ? "Scan nutrition label"
                  : view === "meal-photo"
                    ? "Estimate meal photo"
                    : "Describe your food"}
            </div>
            {view === "barcode" ? (
              <BarcodeCapture onFood={(food) => choose(catalogChoice(food))} />
            ) : view === "description" ? (
              <DescriptionCapture
                onFood={(food) => choose(analysisChoice(food))}
              />
            ) : (
              <ImageCapture
                mode={view}
                onFood={(food) => choose(analysisChoice(food))}
              />
            )}
          </motion.div>
        ) : view === "custom" ? (
          <motion.div
            key="custom"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={springs.default}
            className="pt-3 pb-2"
          >
            <div className="px-4">
              <button
                type="button"
                aria-label="Back to foods"
                className="mb-1 flex size-11 items-center justify-center rounded-md text-text-secondary"
                onClick={() => setView("browse")}
              >
                <ChevronLeft size={20} strokeWidth={1.75} />
              </button>
              <div className="type-title mb-4">Enter manually</div>
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
              onClick={() => setSaveAsMeal((saved) => !saved)}
              className="mx-4 mt-3 flex h-12 w-[calc(100%-2rem)] items-center justify-between"
            >
              <span className="type-body text-text-secondary">
                Save for quick-add
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
                onClick={submitCustom}
              >
                Log
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="browse"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={springs.default}
            className="px-4 pt-4 pb-2"
          >
            <div className="type-title">Add food</div>
            <div className="type-footnote mt-1 text-text-tertiary">
              Your usual foods, ready to log
            </div>

            <label className="mt-4 flex h-12 items-center gap-3 rounded-md border border-border-subtle bg-raised px-4 focus-within:border-border-strong">
              <Search
                size={18}
                strokeWidth={1.75}
                className="shrink-0 text-text-tertiary"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search foods and brands"
                className="type-body min-w-0 flex-1 bg-transparent text-text-primary placeholder:text-text-tertiary"
              />
            </label>

            {query.length === 0 && (
              <FoodInputActions onSelect={(mode) => setView(mode)} />
            )}

            {query.length === 0 && yesterday.length > 0 && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-raised p-3">
                <div className="min-w-0">
                  <div className="type-body text-text-primary">Yesterday</div>
                  <div className="type-footnote mt-0.5 truncate text-text-tertiary">
                    {yesterday.length} {yesterday.length === 1 ? "entry" : "entries"} ·{" "}
                    {formatInt(yesterdayCalories)} cal
                  </div>
                </div>
                <Button
                  variant="secondary"
                  className="h-11 shrink-0 px-4 type-body"
                  disabled={copyDay.isPending}
                  onClick={() => {
                    copyDay.mutate(yesterday);
                    close();
                  }}
                >
                  Copy all
                </Button>
              </div>
            )}

            <div className="type-label mt-5 mb-2 text-text-tertiary">
              {query
                ? catalogLoading
                  ? "Searching"
                  : "Results"
                : "Suggested"}
            </div>
            {filteredChoices.length > 0 ? (
              <>
                <div className="max-h-72 divide-y divide-border-subtle overflow-y-auto overscroll-contain">
                  {filteredChoices.map((choice) => (
                    <ListRow
                      key={choice.key}
                      title={choice.name}
                      subtitle={
                        choice.servingLabel
                          ? `${choice.servingLabel} · ${choice.proteinG} g protein`
                          : `${choice.proteinG} g protein`
                      }
                      trailing={
                        <span className="type-body tabular-nums text-text-secondary">
                          {formatInt(choice.calories)}
                        </span>
                      }
                      onClick={() => choose(choice)}
                    />
                  ))}
                </div>
                {query && (catalogData?.foods.length ?? 0) > 0 && (
                  <p className="type-footnote mt-2 text-text-tertiary">
                    Nutrition data from Open Food Facts and USDA FoodData Central
                  </p>
                )}
              </>
            ) : (
              <p className="type-body py-6 text-center text-text-tertiary">
                {query ? "No matching foods yet" : "Your suggestions will learn as you log"}
              </p>
            )}

            <Button
              variant="secondary"
              className="mt-3 w-full"
              onClick={() => setView("custom")}
            >
              Enter manually
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}

function MacroPreview({ food }: { food: MacroValues }) {
  const values = [
    { label: "Cal", value: food.calories, color: "text-text-primary" },
    { label: "Protein", value: food.proteinG, color: "text-protein" },
    { label: "Carbs", value: food.carbsG, color: "text-carbs" },
    { label: "Fat", value: food.fatG, color: "text-fat" },
  ];

  return (
    <div className="mt-5 grid grid-cols-4 gap-2">
      {values.map((item) => (
        <div
          key={item.label}
          className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-md border border-border-subtle bg-raised"
        >
          <span className={cn("type-label", item.color)}>{item.label}</span>
          <span className="type-headline tabular-nums text-text-primary">
            {formatInt(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
