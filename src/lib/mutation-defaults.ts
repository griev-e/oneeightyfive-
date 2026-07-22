"use client";

import type { Mutation, QueryClient } from "@tanstack/react-query";
import type { PersistedClient } from "@tanstack/react-query-persist-client";
import { fetchJson, jsonBody } from "@/hooks/fetch-json";
import type { WeighIn } from "@/lib/stats";

/**
 * The offline write queue. The three gym-critical creates carry a mutationKey
 * so that, when fired offline, TanStack pauses them (networkMode "online"),
 * the paused mutation persists to IndexedDB, and a later launch replays it
 * through the closure-free defaults below. Variables must fully self-describe
 * the write (date, loggedAt, …) — a replay has no component context.
 *
 * Deliberately queued: weight PUT (idempotent upsert by date), food-log POST
 * (timestamp carried in variables), set POST (set numbers are server-assigned
 * and keep gaps, so replays can't collide). Edits/deletes/meals keep the
 * fail-and-rollback behavior — replaying a stale edit is worse than losing it.
 */

export const QUEUED_MUTATION_KEYS = ["log-weight", "log-food", "log-set"] as const;

export function isQueuedMutationKey(key: unknown): boolean {
  return (
    Array.isArray(key) &&
    typeof key[0] === "string" &&
    (QUEUED_MUTATION_KEYS as readonly string[]).includes(key[0])
  );
}

/** Persist only paused, replayable mutations — never one we can't resume. */
export function shouldPersistMutation(
  mutation: Mutation<unknown, Error, unknown, unknown>,
): boolean {
  return mutation.state.isPaused && isQueuedMutationKey(mutation.options.mutationKey);
}

/**
 * A CACHE_BUSTER bump wipes the persisted query cache — but the same blob
 * holds the paused offline write queue. Shipping a bump while unsynced gym
 * writes are queued must not delete them: strip the (stale-shaped) queries,
 * keep the queued mutations, and stamp the new buster so restore accepts
 * the blob. Queued VARIABLES are self-describing JSON posted verbatim to
 * the API, so they survive shape changes the query cache can't.
 */
export function salvageQueuedMutations(
  persisted: PersistedClient | undefined,
  buster: string,
): PersistedClient | undefined {
  if (!persisted || persisted.buster === buster) return persisted;
  const mutations = persisted.clientState.mutations.filter((m) =>
    isQueuedMutationKey(m.mutationKey),
  );
  if (mutations.length === 0) return persisted; // plain wipe — nothing queued
  return { ...persisted, buster, clientState: { queries: [], mutations } };
}

export type LogFoodVars = {
  date: string;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  mealId?: string | null;
  loggedAt?: string;
  /** idempotency key — a replayed write dedupes server-side instead of
   * inserting a second row when the first attempt's ACK was lost */
  clientId?: string;
};

export type LogSetVars = {
  date: string;
  exerciseId: string;
  weightLbs: number;
  reps: number;
  rpe?: number | null;
  note?: string | null;
  /** idempotency key — see LogFoodVars */
  clientId?: string;
};

export function registerMutationDefaults(qc: QueryClient) {
  // After a post-reload replay the hooks' onSuccess swaps can't run — refetch
  // everything a queued write can touch so tmp- rows reconcile.
  const reconcile = () => {
    void qc.invalidateQueries({ queryKey: ["weigh-ins"] });
    void qc.invalidateQueries({ queryKey: ["food-logs"] });
    void qc.invalidateQueries({ queryKey: ["sets"] });
    void qc.invalidateQueries({ queryKey: ["exercise-history"] });
    void qc.invalidateQueries({ queryKey: ["day-summaries"] });
  };

  // all three queued creates ride the same backoff — a transient 5xx during
  // a replay must not silently drop a write that survived being offline
  const RETRY = {
    retry: 3,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 8000),
  };

  qc.setMutationDefaults(["log-weight"], {
    ...RETRY,
    mutationFn: (w: WeighIn) =>
      fetchJson<WeighIn>("/api/weight", { method: "PUT", ...jsonBody(w) }),
    onSettled: reconcile,
  });

  qc.setMutationDefaults(["log-food"], {
    ...RETRY,
    mutationFn: (input: LogFoodVars) =>
      fetchJson("/api/food-logs", { method: "POST", ...jsonBody(input) }),
    onSettled: reconcile,
  });

  qc.setMutationDefaults(["log-set"], {
    ...RETRY,
    mutationFn: (input: LogSetVars) =>
      fetchJson("/api/sets", { method: "POST", ...jsonBody(input) }),
    onSettled: reconcile,
  });
}
