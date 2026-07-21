"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, jsonBody } from "./fetch-json";
import type { Plan, PlanInputs } from "@/lib/plan";
import type { Settings } from "./use-settings";

export type Profile = {
  name: string;
  sex: "male" | "female";
  birthDate: string | null;
  heightIn: number | null;
  bodyFatPct: number | null;
  neatTier: "sitting" | "light" | "active" | "demanding" | null;
  liftDaysPerWeek: number | null;
  sessionMin: number | null;
  cardioMinPerWeek: number | null;
  trainingMonths: number | null;
  trainingMonthsAsOf: string | null;
  appetite: "easy" | "manageable" | "struggle" | null;
  bulkStyle: "lean" | "standard" | "aggressive" | null;
  completedAt: string | null;
};

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchJson<Profile>("/api/profile"),
    // questionnaire answers change only through this client's own saves
    staleTime: 60 * 60_000,
  });
}

export type SavePlanPayload = {
  effectiveDate: string;
  answers: Omit<PlanInputs, "trainingMonthsAsOf" | "rateOverride"> & {
    rateOverride: number | null;
  };
  overrides?: {
    calorieTarget?: number;
    proteinG?: number;
    carbG?: number;
    fatG?: number;
  };
};

/** Deliberately NOT optimistic — committing to a plan is a confirm step. */
export function useSavePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SavePlanPayload) =>
      fetchJson<{ profile: Profile; settings: Settings; plan: Plan }>(
        "/api/profile",
        { method: "PUT", ...jsonBody(payload) },
      ),
    onSuccess: ({ profile, settings }) => {
      qc.setQueryData(["profile"], profile);
      qc.setQueryData(["settings"], settings);
      void qc.invalidateQueries({ queryKey: ["day-summaries"] });
      void qc.invalidateQueries({ queryKey: ["weigh-ins"] });
      void qc.invalidateQueries({ queryKey: ["plan-events"] });
    },
  });
}
