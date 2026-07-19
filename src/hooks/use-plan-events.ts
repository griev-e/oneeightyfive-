"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "./fetch-json";

export type PlanEvent = {
  id: string;
  date: string;
  action: "questionnaire" | "applied" | "dismissed";
  observedTdee: number | null;
  targetBefore: number | null;
  targetSuggested: number | null;
  createdAt: string;
};

/** Newest-first plan audit trail — powers the plan view's history list. */
export function usePlanEvents() {
  return useQuery({
    queryKey: ["plan-events"],
    queryFn: () => fetchJson<PlanEvent[]>("/api/plan-events"),
  });
}
