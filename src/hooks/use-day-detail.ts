"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "./fetch-json";
import type { FoodLog } from "./use-food";
import type { WorkoutSet } from "./use-workouts";

/**
 * Read-only feeds for the history day drill-in. Keys deliberately match the
 * live hooks (['food-logs', date] / ['sets', date]) so opening today — or a
 * day viewed before — is served warm from the cache.
 */
export function useDayFoodLogs(date: string | null) {
  return useQuery({
    queryKey: ["food-logs", date],
    queryFn: () => fetchJson<FoodLog[]>(`/api/food-logs?date=${date}`),
    enabled: date !== null,
  });
}

export function useDaySets(date: string | null) {
  return useQuery({
    queryKey: ["sets", date],
    queryFn: () => fetchJson<WorkoutSet[]>(`/api/sets?date=${date}`),
    enabled: date !== null,
  });
}
