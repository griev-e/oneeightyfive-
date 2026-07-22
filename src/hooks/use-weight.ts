"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, jsonBody } from "./fetch-json";
import { useToast } from "@/components/ui/toast";
import type { WeighIn } from "@/lib/stats";

export function useWeighIns() {
  return useQuery({
    queryKey: ["weigh-ins"],
    queryFn: () => fetchJson<WeighIn[]>("/api/weight"),
    // weigh-ins only change through this client's own writes — a half-hour
    // staleTime keeps app-foreground refetches off the biggest list
    staleTime: 30 * 60_000,
  });
}

/** Canonical optimistic mutation: cache moves at tap time, rolls back quietly.
 *  Keyed so an offline weigh-in queues and replays (lib/mutation-defaults). */
export function useLogWeight() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationKey: ["log-weight"],
    mutationFn: (w: WeighIn) =>
      fetchJson<WeighIn>("/api/weight", { method: "PUT", ...jsonBody(w) }),
    onMutate: async (w) => {
      await qc.cancelQueries({ queryKey: ["weigh-ins"] });
      const prev = qc.getQueryData<WeighIn[]>(["weigh-ins"]);
      qc.setQueryData<WeighIn[]>(["weigh-ins"], (old = []) =>
        [...old.filter((p) => p.date !== w.date), w].sort((a, b) =>
          a.date < b.date ? -1 : 1,
        ),
      );
      return { prev };
    },
    onError: (_err, _w, ctx) => {
      qc.setQueryData(["weigh-ins"], ctx?.prev);
      toast.show("Couldn't save — try again");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["weigh-ins"] });
    },
  });
}

/** Unkeyed on purpose — deletes fail-and-rollback offline, never queue. */
export function useDeleteWeighIn() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (date: string) =>
      fetchJson<{ ok: true }>(`/api/weight/${date}`, { method: "DELETE" }),
    onMutate: async (date) => {
      await qc.cancelQueries({ queryKey: ["weigh-ins"] });
      const prev = qc.getQueryData<WeighIn[]>(["weigh-ins"]);
      qc.setQueryData<WeighIn[]>(["weigh-ins"], (old = []) =>
        old.filter((p) => p.date !== date),
      );
      return { prev };
    },
    onError: (_err, _date, ctx) => {
      qc.setQueryData(["weigh-ins"], ctx?.prev);
      toast.show("Couldn't delete — try again");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["weigh-ins"] });
    },
  });
}
