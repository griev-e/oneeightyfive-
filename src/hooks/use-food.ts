"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, jsonBody } from "./fetch-json";
import { useToast } from "@/components/ui/toast";
import type {
  FoodHistoryItem,
  FoodSuggestion,
} from "@/lib/food-suggestions";

export type FoodLog = {
  id: string;
  date: string;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  mealId: string | null;
  loggedAt: string;
};

export type FoodLogInput = {
  date: string;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  mealId?: string | null;
  /** undo passes the original timestamp so the row keeps its place */
  loggedAt?: string;
};

export function useFoodLogs(date: string) {
  return useQuery({
    queryKey: ["food-logs", date],
    queryFn: () => fetchJson<FoodLog[]>(`/api/food-logs?date=${date}`),
  });
}

export type FoodSuggestionsResponse = {
  suggestions: FoodSuggestion[];
  yesterday: FoodHistoryItem[];
};

export function useFoodSuggestions(date: string) {
  return useQuery({
    queryKey: ["food-suggestions", date],
    queryFn: () => {
      const now = new Date();
      const params = new URLSearchParams({
        date,
        hour: String(now.getHours()),
        timezoneOffsetMinutes: String(now.getTimezoneOffset()),
      });
      return fetchJson<FoodSuggestionsResponse>(
        `/api/food-suggestions?${params}`,
      );
    },
  });
}

export function useLogFood(date: string) {
  const qc = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    // keyed for the offline queue — a paused log persists and replays later,
    // so the variables must carry everything (date, loggedAt) themselves
    mutationKey: ["log-food"],
    mutationFn: (input: FoodLogInput) =>
      fetchJson<FoodLog>("/api/food-logs", { method: "POST", ...jsonBody(input) }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["food-logs", date] });
      const tmpId = `tmp-${crypto.randomUUID()}`;
      const optimistic: FoodLog = {
        id: tmpId,
        date,
        name: input.name,
        calories: input.calories,
        proteinG: input.proteinG,
        carbsG: input.carbsG,
        fatG: input.fatG,
        mealId: input.mealId ?? null,
        loggedAt: input.loggedAt ?? new Date().toISOString(),
      };
      qc.setQueryData<FoodLog[]>(["food-logs", date], (old = []) =>
        [...old, optimistic].sort((a, b) =>
          a.loggedAt < b.loggedAt ? -1 : 1,
        ),
      );
      // ranking bump without a resort — the tapped row must not move
      if (input.mealId) {
        qc.setQueryData<Meal[]>(["meals"], (old = []) =>
          old.map((m) =>
            m.id === input.mealId ? { ...m, useCount: m.useCount + 1 } : m,
          ),
        );
      }
      return { tmpId };
    },
    onSuccess: (saved, _input, ctx) => {
      qc.setQueryData<FoodLog[]>(["food-logs", date], (old = []) =>
        old.map((l) => (l.id === ctx.tmpId ? saved : l)),
      );
    },
    onError: (_e, _input, ctx) => {
      // remove only the failed row — concurrent quick-adds stay intact
      qc.setQueryData<FoodLog[]>(["food-logs", date], (old = []) =>
        old.filter((l) => l.id !== ctx?.tmpId),
      );
      toast.show("Couldn't save — try again");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["food-logs", date] });
      void qc.invalidateQueries({ queryKey: ["day-summaries"] });
      // deliberately NOT ['meals'] — the quick-add rail must not resort mid-use
    },
  });

  // stamp loggedAt into the VARIABLES (not just the optimistic row) so a
  // queued log replayed after a relaunch keeps its tap-time timestamp
  const stamp = (input: FoodLogInput): FoodLogInput => ({
    loggedAt: new Date().toISOString(),
    ...input,
  });
  return {
    ...mutation,
    mutate: (input: FoodLogInput, options?: Parameters<typeof mutation.mutate>[1]) =>
      mutation.mutate(stamp(input), options),
    mutateAsync: (
      input: FoodLogInput,
      options?: Parameters<typeof mutation.mutateAsync>[1],
    ) => mutation.mutateAsync(stamp(input), options),
  };
}

type BatchFoodInput = Omit<FoodLogInput, "date" | "loggedAt">;

export function useLogFoods(date: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (items: BatchFoodInput[]) =>
      fetchJson<FoodLog[]>("/api/food-logs/batch", {
        method: "POST",
        ...jsonBody({ date, items }),
      }),
    onMutate: async (items) => {
      await qc.cancelQueries({ queryKey: ["food-logs", date] });
      const startedAt = Date.now();
      const optimistic = items.map<FoodLog>((item, index) => ({
        id: `tmp-${crypto.randomUUID()}`,
        date,
        name: item.name,
        calories: item.calories,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
        mealId: item.mealId ?? null,
        loggedAt: new Date(startedAt + index).toISOString(),
      }));
      qc.setQueryData<FoodLog[]>(["food-logs", date], (old = []) =>
        [...old, ...optimistic].sort((a, b) =>
          a.loggedAt < b.loggedAt ? -1 : 1,
        ),
      );
      return { tmpIds: optimistic.map((item) => item.id) };
    },
    onSuccess: (saved, _items, ctx) => {
      const tmpIds = new Set(ctx.tmpIds);
      qc.setQueryData<FoodLog[]>(["food-logs", date], (old = []) =>
        [...old.filter((item) => !tmpIds.has(item.id)), ...saved].sort((a, b) =>
          a.loggedAt < b.loggedAt ? -1 : 1,
        ),
      );
    },
    onError: (_error, _items, ctx) => {
      const tmpIds = new Set(ctx?.tmpIds ?? []);
      qc.setQueryData<FoodLog[]>(["food-logs", date], (old = []) =>
        old.filter((item) => !tmpIds.has(item.id)),
      );
      toast.show("Couldn't copy yesterday — try again");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["food-logs", date] });
      void qc.invalidateQueries({ queryKey: ["day-summaries"] });
    },
  });
}

export function useUpdateFoodLog(date: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<FoodLogInput>) =>
      fetchJson<{ ok: true }>(`/api/food-logs/${id}`, {
        method: "PATCH",
        ...jsonBody(patch),
      }),
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: ["food-logs", date] });
      const prev = qc.getQueryData<FoodLog[]>(["food-logs", date]);
      qc.setQueryData<FoodLog[]>(["food-logs", date], (old = []) =>
        old.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(["food-logs", date], ctx?.prev);
      toast.show("Couldn't save — try again");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["food-logs", date] });
      void qc.invalidateQueries({ queryKey: ["day-summaries"] });
    },
  });
}

export function useDeleteFoodLog(date: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ ok: true }>(`/api/food-logs/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["food-logs", date] });
      const prev = qc.getQueryData<FoodLog[]>(["food-logs", date]);
      qc.setQueryData<FoodLog[]>(["food-logs", date], (old = []) =>
        old.filter((l) => l.id !== id),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(["food-logs", date], ctx?.prev);
      toast.show("Couldn't delete — try again");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["food-logs", date] });
      void qc.invalidateQueries({ queryKey: ["day-summaries"] });
    },
  });
}

// ---- meals (saved staples) ----

export type Meal = {
  id: string;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  useCount: number;
  lastUsedAt: string | null;
};

export function useMeals() {
  return useQuery({
    queryKey: ["meals"],
    queryFn: () => fetchJson<Meal[]>("/api/meals"),
  });
}

export function useCreateMeal() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (input: Pick<Meal, "name" | "calories" | "proteinG" | "carbsG" | "fatG">) =>
      fetchJson<Meal>("/api/meals", { method: "POST", ...jsonBody(input) }),
    onSuccess: (meal) => {
      qc.setQueryData<Meal[]>(["meals"], (old = []) => [...old, meal]);
    },
    onError: () => toast.show("Couldn't save meal — try again"),
  });
}

export function useUpdateMeal() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & Partial<Meal>) =>
      fetchJson<{ ok: true }>(`/api/meals/${id}`, {
        method: "PATCH",
        ...jsonBody(patch),
      }),
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: ["meals"] });
      const prev = qc.getQueryData<Meal[]>(["meals"]);
      qc.setQueryData<Meal[]>(["meals"], (old = []) =>
        old.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(["meals"], ctx?.prev);
      toast.show("Couldn't save — try again");
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["meals"] }),
  });
}

export function useArchiveMeal() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ ok: true }>(`/api/meals/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["meals"] });
      const prev = qc.getQueryData<Meal[]>(["meals"]);
      qc.setQueryData<Meal[]>(["meals"], (old = []) =>
        old.filter((m) => m.id !== id),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(["meals"], ctx?.prev);
      toast.show("Couldn't remove — try again");
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ["meals"] }),
  });
}
