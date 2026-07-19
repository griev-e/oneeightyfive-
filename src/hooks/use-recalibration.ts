"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, jsonBody } from "./fetch-json";
import { useToast } from "@/components/ui/toast";
import { useAppDate } from "./use-app-date";
import type { Settings } from "./use-settings";

export type Recalibration =
  | { status: "none" }
  | {
      status: "ready";
      observedTdee: number;
      confidence: number;
      currentTarget: number;
      suggestedTarget: number;
      suggestedProteinG: number;
      suggestedCarbG: number;
      suggestedFatG: number;
      direction: "up" | "down";
    };

const NONE: Recalibration = { status: "none" };

/** The recalibration suggestion, if the cadence clock allows one right now. */
export function useRecalibration() {
  const today = useAppDate();
  return useQuery({
    queryKey: ["recalibration", today],
    queryFn: () =>
      fetchJson<Recalibration>(`/api/recalibration?today=${today}`),
    staleTime: 60 * 60_000,
  });
}

/** Commit the observed-blend plan — server recomputes, so no body is needed. */
export function useApplyRecalibration() {
  const qc = useQueryClient();
  const today = useAppDate();
  const toast = useToast();
  return useMutation({
    mutationFn: () =>
      fetchJson<{ settings: Settings }>("/api/recalibration", {
        method: "POST",
        ...jsonBody({ date: today }),
      }),
    onSuccess: ({ settings }) => {
      qc.setQueryData(["settings"], settings);
      qc.setQueryData(["recalibration", today], NONE);
      void qc.invalidateQueries({ queryKey: ["recalibration"] });
      void qc.invalidateQueries({ queryKey: ["day-summaries"] });
      void qc.invalidateQueries({ queryKey: ["plan-events"] });
    },
    onError: () => toast.show("Couldn't apply — try again"),
  });
}

/** Wave off the card — a dismissal restarts the cadence clock server-side. */
export function useDismissRecalibration() {
  const qc = useQueryClient();
  const today = useAppDate();
  const toast = useToast();
  return useMutation({
    mutationFn: () => {
      const rec = qc.getQueryData<Recalibration>(["recalibration", today]);
      const payload =
        rec && rec.status === "ready"
          ? {
              date: today,
              action: "dismissed",
              observedTdee: rec.observedTdee,
              targetBefore: rec.currentTarget,
              targetSuggested: rec.suggestedTarget,
            }
          : { date: today, action: "dismissed" };
      return fetchJson<{ ok: true }>("/api/plan-events", {
        method: "POST",
        ...jsonBody(payload),
      });
    },
    onMutate: () => {
      const prev = qc.getQueryData<Recalibration>(["recalibration", today]);
      qc.setQueryData(["recalibration", today], NONE);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(["recalibration", today], ctx?.prev);
      toast.show("Couldn't dismiss — try again");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["recalibration"] });
      void qc.invalidateQueries({ queryKey: ["plan-events"] });
    },
  });
}
