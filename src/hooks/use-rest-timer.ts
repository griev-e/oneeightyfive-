"use client";

/**
 * Between-sets rest clock. A module-level store (not React state) so the
 * running timer survives tab switches, the Lift drill-in unmounting, and
 * every re-render in between — panels stay mounted but ExerciseDetail does
 * not. Elapsed time is always derived from the wall clock, never from an
 * accumulating counter, so backgrounding the PWA can't drift it. The store
 * does its own ticking and components subscribe via useSyncExternalStore —
 * renders stay pure. Deliberately not persisted: a relaunch mid-rest starts
 * fresh.
 */

import { useSyncExternalStore } from "react";

export const REST_TARGET_SECONDS = 180;
/** A timer nobody looked at for this long is a finished workout, not a rest. */
const STALE_AFTER_MS = 15 * 60_000;

type RestState = { exerciseId: string; startedAt: number } | null;

let state: RestState = null;
let elapsedSeconds = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const tick = () => {
  if (state === null) return;
  const ms = Date.now() - state.startedAt;
  if (ms > STALE_AFTER_MS) {
    restTimer.clear();
    return;
  }
  const next = Math.floor(ms / 1000);
  if (next !== elapsedSeconds) {
    elapsedSeconds = next;
    notify();
  }
};

export const restTimer = {
  /** Call when a set is logged — restarts the clock for that exercise. */
  start(exerciseId: string) {
    state = { exerciseId, startedAt: Date.now() };
    elapsedSeconds = 0;
    // sub-second cadence so displayed seconds never visibly skip
    if (intervalId === null) intervalId = setInterval(tick, 500);
    notify();
  },
  clear() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (state === null) return;
    state = null;
    notify();
  },
};

/** Whole elapsed seconds resting since the last set of this exercise, or null. */
export function useRestTimer(exerciseId: string): number | null {
  return useSyncExternalStore(
    subscribe,
    () =>
      state !== null && state.exerciseId === exerciseId
        ? elapsedSeconds
        : null,
    () => null,
  );
}
