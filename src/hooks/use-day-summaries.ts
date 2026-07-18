"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "./fetch-json";
import { addDays } from "@/lib/dates";
import type { TargetRow } from "@/lib/streaks";
import { useAppDate } from "./use-app-date";

export type DaySummaries = {
  days: { date: string; calories: number; proteinG: number; entryCount: number }[];
  targets: TargetRow[];
  trainingDates: string[];
};

const EMPTY: DaySummaries = { days: [], targets: [], trainingDates: [] };

/** History for streaks + the training-week chip. Today's live numbers come
 *  from ['food-logs', today] — this feed is closed days only. */
export function useDaySummaries(): DaySummaries {
  const today = useAppDate();
  const { data } = useQuery({
    queryKey: ["day-summaries"],
    queryFn: () =>
      fetchJson<DaySummaries>(
        `/api/day-summaries?from=${addDays(today, -366)}`,
      ),
  });
  return data ?? EMPTY;
}
