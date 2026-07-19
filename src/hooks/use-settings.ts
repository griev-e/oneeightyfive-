"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, jsonBody } from "./fetch-json";
import { useToast } from "@/components/ui/toast";
import { getAppDate } from "@/lib/dates";

export type Settings = {
  calorieTarget: number;
  proteinTargetG: number;
  carbTargetG: number;
  fatTargetG: number;
  goalRateLbsPerWeek: number;
  goalWeightLbs: number | null;
  goalRateSource: "recommended" | "custom";
};

export const DEFAULT_SETTINGS: Settings = {
  calorieTarget: 2700,
  proteinTargetG: 135,
  carbTargetG: 360,
  fatTargetG: 80,
  goalRateLbsPerWeek: 0.5,
  goalWeightLbs: 185,
  goalRateSource: "recommended",
};

/** Seeded defaults render immediately; the server row replaces them. */
export function useSettings(): Settings {
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: () => fetchJson<Settings>("/api/settings"),
    placeholderData: DEFAULT_SETTINGS,
  });
  return data ?? DEFAULT_SETTINGS;
}

/** Manual target edits — same atomic path as the questionnaire (history included). */
export function useUpdateSettings() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (next: Partial<Settings>) => {
      const current = qc.getQueryData<Settings>(["settings"]) ?? DEFAULT_SETTINGS;
      const merged = { ...current, ...next };
      return fetchJson<Settings>("/api/settings", {
        method: "PUT",
        ...jsonBody({ effectiveDate: getAppDate(), ...merged }),
      });
    },
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ["settings"] });
      const prev = qc.getQueryData<Settings>(["settings"]);
      qc.setQueryData<Settings>(["settings"], (old) => ({
        ...(old ?? DEFAULT_SETTINGS),
        ...next,
      }));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(["settings"], ctx?.prev);
      toast.show("Couldn't save — try again");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["settings"] });
      void qc.invalidateQueries({ queryKey: ["day-summaries"] });
      void qc.invalidateQueries({ queryKey: ["plan-events"] });
    },
  });
}
