"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import type { WeighIn } from "@/lib/stats";

/**
 * All data flows through /api/* (PIN-gated, server-side Supabase). A 401
 * means the unlock cookie expired or PIN_LOCK rotated — bounce to /lock.
 */
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 401) {
    window.location.replace("/lock");
    throw new Error("locked");
  }
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

export function useWeighIns() {
  return useQuery({
    queryKey: ["weigh-ins"],
    queryFn: () => fetchJson<WeighIn[]>("/api/weight"),
  });
}

/** Canonical optimistic mutation: cache moves at tap time, rolls back quietly. */
export function useLogWeight() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (w: WeighIn) =>
      fetchJson<WeighIn>("/api/weight", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(w),
      }),
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
