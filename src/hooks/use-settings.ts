"use client";

import { useQuery } from "@tanstack/react-query";

export type Settings = {
  calorieTarget: number;
  proteinTargetG: number;
  goalRateLbsPerWeek: number;
  goalWeightLbs: number | null;
};

const DEFAULTS: Settings = {
  calorieTarget: 2700,
  proteinTargetG: 135,
  goalRateLbsPerWeek: 0.5,
  goalWeightLbs: 185,
};

/** Seeded defaults render immediately; the server row replaces them. */
export function useSettings(): Settings {
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<Settings> => {
      const res = await fetch("/api/settings");
      if (res.status === 401) {
        window.location.replace("/lock");
        throw new Error("locked");
      }
      if (!res.ok) throw new Error(`settings → ${res.status}`);
      return res.json();
    },
    placeholderData: DEFAULTS,
  });
  return data ?? DEFAULTS;
}
