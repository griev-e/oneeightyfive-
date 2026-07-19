"use client";

/**
 * Between-sets rest clock. A module-level store (not React state) so the
 * running timer survives tab switches, the Lift drill-in unmounting, and
 * every re-render in between — panels stay mounted but ExerciseDetail does
 * not. Elapsed time is always derived from the wall clock, never from an
 * accumulating interval, so backgrounding the PWA can't drift it.
 * Deliberately not persisted: a relaunch mid-rest starts fresh.
 */

import { useEffect, useReducer, useSyncExternalStore } from "react";

export const REST_TARGET_SECONDS = 180;
/** A timer nobody looked at for this long is a finished workout, not a rest. */
const STALE_AFTER_MS = 15 * 60_000;

type RestState = { exerciseId: string; startedAt: number } | null;

let state: RestState = null;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getState = () => state;
const getServerState = () => null;

export const restTimer = {
  /** Call when a set is logged — restarts the clock for that exercise. */
  start(exerciseId: string) {
    state = { exerciseId, startedAt: Date.now() };
    notify();
  },
  clear() {
    if (state === null) return;
    state = null;
    notify();
  },
};

/** Whole elapsed seconds resting since the last set of this exercise, or null. */
export function useRestTimer(exerciseId: string): number | null {
  const current = useSyncExternalStore(subscribe, getState, getServerState);
  const [, tick] = useReducer((n: number) => n + 1, 0);

  const active = current !== null && current.exerciseId === exerciseId;
  const startedAt = active ? current.startedAt : null;

  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => {
      if (Date.now() - startedAt > STALE_AFTER_MS) restTimer.clear();
      else tick();
    }, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (startedAt === null) return null;
  const elapsedMs = Date.now() - startedAt;
  if (elapsedMs > STALE_AFTER_MS) return null;
  return Math.floor(elapsedMs / 1000);
}
