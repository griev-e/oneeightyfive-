"use client";

/**
 * M1 only: a single coherent mock-state object behind the same shape the
 * real data layer will expose. Every number on every panel derives from
 * here, and panels mutate it — so the motion system can be judged honestly
 * (numbers glide on change, the ring retargets, streak flips at crossing).
 * Replaced by Supabase + TanStack Query in M2 without touching the panels'
 * render code.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { addDays, getAppDate } from "./dates";
import type { WeighIn } from "./stats";

export type FoodLog = {
  id: string;
  name: string;
  calories: number;
  proteinG: number;
  loggedAt: string; // "8:12 AM"
};

export type Meal = {
  id: string;
  name: string;
  calories: number;
  proteinG: number;
};

export type LoggedSet = {
  weightLbs: number;
  reps: number;
  /** vs last session's same set: none | overload | pr */
  flag: "none" | "overload" | "pr";
};

export type Exercise = {
  id: string;
  name: string;
  /** last session's sets — the ghosts to beat */
  lastSession: { weightLbs: number; reps: number }[];
  lastSessionDate: string;
  /** all-time bests for PR detection */
  maxWeight: number;
  maxE1rm: number;
  /** sets logged today (mock session) */
  today: LoggedSet[];
};

type MockState = {
  appDate: string;
  calorieTarget: number;
  proteinTarget: number;
  goalRate: number;
  goalWeight: number;
  streakBase: number; // consecutive hit days ending yesterday
  weighIns: WeighIn[];
  foodLogs: FoodLog[];
  meals: Meal[];
  exercises: Exercise[];
};

type MockActions = {
  logFood: (meal: Pick<Meal, "name" | "calories" | "proteinG">) => void;
  removeFood: (id: string) => void;
  logWeight: (weightLbs: number) => void;
  logSet: (exerciseId: string, weightLbs: number, reps: number) => void;
};

const MockContext = createContext<(MockState & MockActions) | null>(null);

/** Deterministic day-to-day noise — no Math.random (hydration-safe) */
const NOISE = [
  0.3, -0.2, 0.4, 0.0, -0.3, 0.5, 0.1, -0.4, 0.2, 0.6, -0.1, 0.3, -0.5, 0.2,
  0.4, -0.2, 0.1, 0.5, -0.3, 0.0, 0.4, -0.1, 0.2, -0.4, 0.6, 0.1, -0.2, 0.3,
  0.0, 0.4, -0.3, 0.2, 0.5, -0.1, 0.3,
];

function buildWeightSeries(appDate: string): WeighIn[] {
  const series: WeighIn[] = [];
  const days = 35;
  for (let i = days - 1; i >= 0; i--) {
    // ~+0.55 lb/week trend up to 125.8 today, with noise; a few skipped days
    if (i !== 0 && (i % 9 === 4 || i % 13 === 7)) continue;
    const trend = 125.8 - (0.55 / 7) * i;
    const noise = i === 0 ? 0 : NOISE[i % NOISE.length] * 0.45;
    series.push({
      date: addDays(appDate, -i),
      weightLbs: Math.round((trend + noise) * 10) / 10,
    });
  }
  return series;
}

function initialState(appDate: string): MockState {
  return {
    appDate,
    calorieTarget: 2700,
    proteinTarget: 135,
    goalRate: 0.5,
    goalWeight: 185,
    streakBase: 6,
    weighIns: buildWeightSeries(appDate),
    foodLogs: [
      {
        id: "f1",
        name: "Overnight oats + PB",
        calories: 720,
        proteinG: 38,
        loggedAt: "8:12 AM",
      },
      {
        id: "f2",
        name: "Chipotle double chicken bowl",
        calories: 1050,
        proteinG: 62,
        loggedAt: "1:05 PM",
      },
    ],
    meals: [
      { id: "m1", name: "Mass shake", calories: 642, proteinG: 32 },
      { id: "m2", name: "Chipotle double chicken bowl", calories: 1050, proteinG: 62 },
      { id: "m3", name: "Overnight oats + PB", calories: 720, proteinG: 38 },
      { id: "m4", name: "Chicken rice bowl", calories: 780, proteinG: 52 },
      { id: "m5", name: "PB&J + whole milk", calories: 610, proteinG: 24 },
      { id: "m6", name: "Greek yogurt + granola", calories: 420, proteinG: 28 },
    ],
    exercises: [
      {
        id: "e1",
        name: "Barbell Bench Press",
        lastSession: [
          { weightLbs: 95, reps: 8 },
          { weightLbs: 95, reps: 8 },
          { weightLbs: 95, reps: 7 },
        ],
        lastSessionDate: addDays(appDate, -2),
        maxWeight: 95,
        maxE1rm: 120.3,
        today: [],
      },
      {
        id: "e2",
        name: "Barbell Back Squat",
        lastSession: [
          { weightLbs: 115, reps: 6 },
          { weightLbs: 115, reps: 6 },
          { weightLbs: 115, reps: 6 },
        ],
        lastSessionDate: addDays(appDate, -3),
        maxWeight: 115,
        maxE1rm: 138,
        today: [],
      },
      {
        id: "e3",
        name: "Overhead Press",
        lastSession: [
          { weightLbs: 65, reps: 8 },
          { weightLbs: 65, reps: 7 },
          { weightLbs: 65, reps: 6 },
        ],
        lastSessionDate: addDays(appDate, -2),
        maxWeight: 65,
        maxE1rm: 82.3,
        today: [],
      },
      {
        id: "e4",
        name: "Barbell Row",
        lastSession: [
          { weightLbs: 85, reps: 10 },
          { weightLbs: 85, reps: 9 },
          { weightLbs: 85, reps: 8 },
        ],
        lastSessionDate: addDays(appDate, -3),
        maxWeight: 85,
        maxE1rm: 113.3,
        today: [],
      },
      {
        id: "e5",
        name: "Pull-Up",
        lastSession: [
          { weightLbs: 0, reps: 5 },
          { weightLbs: 0, reps: 4 },
          { weightLbs: 0, reps: 3 },
        ],
        lastSessionDate: addDays(appDate, -4),
        maxWeight: 0,
        maxE1rm: 0,
        today: [],
      },
    ],
  };
}

let mockId = 0;

export function MockProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(() => initialState(getAppDate()));

  const logFood = useCallback<MockActions["logFood"]>((meal) => {
    setState((s) => ({
      ...s,
      foodLogs: [
        ...s.foodLogs,
        {
          id: `mock-${++mockId}`,
          name: meal.name,
          calories: meal.calories,
          proteinG: meal.proteinG,
          loggedAt: new Date().toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          }),
        },
      ],
    }));
  }, []);

  const removeFood = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      foodLogs: s.foodLogs.filter((f) => f.id !== id),
    }));
  }, []);

  const logWeight = useCallback((weightLbs: number) => {
    setState((s) => {
      const rest = s.weighIns.filter((w) => w.date !== s.appDate);
      return {
        ...s,
        weighIns: [...rest, { date: s.appDate, weightLbs }].sort((a, b) =>
          a.date < b.date ? -1 : 1,
        ),
      };
    });
  }, []);

  const logSet = useCallback(
    (exerciseId: string, weightLbs: number, reps: number) => {
      setState((s) => ({
        ...s,
        exercises: s.exercises.map((ex) => {
          if (ex.id !== exerciseId) return ex;
          const e1 = weightLbs * (1 + Math.min(reps, 12) / 30);
          const isPr =
            weightLbs > ex.maxWeight || (weightLbs > 0 && e1 > ex.maxE1rm);
          const ghost =
            ex.lastSession[ex.today.length] ??
            ex.lastSession[ex.lastSession.length - 1];
          const isOverload =
            !isPr &&
            !!ghost &&
            (weightLbs > ghost.weightLbs ||
              (weightLbs === ghost.weightLbs && reps > ghost.reps));
          return {
            ...ex,
            maxWeight: Math.max(ex.maxWeight, weightLbs),
            maxE1rm: Math.max(ex.maxE1rm, e1),
            today: [
              ...ex.today,
              {
                weightLbs,
                reps,
                flag: isPr ? "pr" : isOverload ? "overload" : "none",
              },
            ],
          };
        }),
      }));
    },
    [],
  );

  const value = useMemo(
    () => ({ ...state, logFood, removeFood, logWeight, logSet }),
    [state, logFood, removeFood, logWeight, logSet],
  );

  return <MockContext.Provider value={value}>{children}</MockContext.Provider>;
}

export function useMock() {
  const ctx = useContext(MockContext);
  if (!ctx) throw new Error("useMock outside MockProvider");
  return ctx;
}
