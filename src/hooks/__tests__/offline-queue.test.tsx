// @vitest-environment happy-dom
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "@tanstack/react-query";

/**
 * The offline write queue (lib/mutation-defaults + networkMode "online"):
 * a write fired offline pauses with its optimistic row visible, persists
 * only if it's one of the three replayable creates, and replays with a
 * fully self-described payload once connectivity returns.
 */
const toastShow = vi.fn();
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ show: toastShow }),
  ToastProvider: ({ children }: { children: ReactNode }) => children,
}));

import { useLogFood, type FoodLog } from "@/hooks/use-food";
import { useLogSet, type WorkoutSet } from "@/hooks/use-workouts";
import {
  registerMutationDefaults,
  shouldPersistMutation,
} from "@/lib/mutation-defaults";

const DATE = "2026-07-18";

function makeClient() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { networkMode: "online", retry: false },
    },
  });
  registerMutationDefaults(qc);
  return qc;
}

function wrapper(qc: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  Wrapper.displayName = "TestQueryWrapper";
  return Wrapper;
}

function fetchOk(body: unknown) {
  const mock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  });
  global.fetch = mock as unknown as typeof fetch;
  return mock;
}

beforeEach(() => toastShow.mockClear());
afterEach(() => {
  onlineManager.setOnline(true);
  vi.restoreAllMocks();
});

describe("offline food log", () => {
  it("pauses offline with the optimistic row visible, then replays with date + loggedAt in the payload", async () => {
    const qc = makeClient();
    qc.setQueryData<FoodLog[]>(["food-logs", DATE], []);
    const saved: FoodLog = {
      id: "server-1",
      date: DATE,
      name: "Rice",
      calories: 200,
      proteinG: 4,
      carbsG: 44,
      fatG: 0,
      mealId: null,
      loggedAt: "2026-07-18T12:00:00Z",
    };
    const fetchMock = fetchOk(saved);

    onlineManager.setOnline(false);
    const { result } = renderHook(() => useLogFood(DATE), { wrapper: wrapper(qc) });
    act(() => {
      result.current.mutate({
        date: DATE,
        name: "Rice",
        calories: 200,
        proteinG: 4,
        carbsG: 44,
        fatG: 0,
      });
    });

    // paused, not failed: the row is on screen and nothing hit the network
    await waitFor(() => {
      const m = qc.getMutationCache().getAll()[0];
      expect(m.state.isPaused).toBe(true);
    });
    expect(fetchMock).not.toHaveBeenCalled();
    const rows = qc.getQueryData<FoodLog[]>(["food-logs", DATE])!;
    expect(rows).toHaveLength(1);
    expect(rows[0].id.startsWith("tmp-")).toBe(true);

    // the persisted-replay contract: variables self-describe the write
    const vars = qc.getMutationCache().getAll()[0].state.variables as Record<string, unknown>;
    expect(vars.date).toBe(DATE);
    expect(typeof vars.loggedAt).toBe("string");

    onlineManager.setOnline(true);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.date).toBe(DATE);
    expect(typeof body.loggedAt).toBe("string");
    await waitFor(() => {
      const after = qc.getQueryData<FoodLog[]>(["food-logs", DATE])!;
      expect(after[0].id).toBe("server-1");
    });
  });
});

describe("offline set log", () => {
  it("carries the app-day in the variables so a replay knows its date", async () => {
    const qc = makeClient();
    qc.setQueryData<WorkoutSet[]>(["sets", DATE], []);
    onlineManager.setOnline(false);

    const { result } = renderHook(() => useLogSet(DATE), { wrapper: wrapper(qc) });
    act(() => {
      result.current.mutate({ exerciseId: "ex-1", weightLbs: 100, reps: 8 });
    });

    await waitFor(() => {
      const m = qc.getMutationCache().getAll()[0];
      expect(m.state.isPaused).toBe(true);
    });
    const vars = qc.getMutationCache().getAll()[0].state.variables as Record<string, unknown>;
    expect(vars.date).toBe(DATE);
    expect(vars.exerciseId).toBe("ex-1");
    // optimistic set is on screen while queued
    expect(qc.getQueryData<WorkoutSet[]>(["sets", DATE])).toHaveLength(1);
  });
});

describe("shouldPersistMutation", () => {
  it("persists only paused mutations with a registered queue key", async () => {
    const qc = makeClient();
    onlineManager.setOnline(false);

    const food = renderHook(() => useLogFood(DATE), { wrapper: wrapper(qc) });
    act(() => {
      food.result.current.mutate({
        date: DATE,
        name: "Rice",
        calories: 200,
        proteinG: 4,
        carbsG: 44,
        fatG: 0,
      });
    });
    await waitFor(() =>
      expect(qc.getMutationCache().getAll()[0].state.isPaused).toBe(true),
    );

    const paused = qc.getMutationCache().getAll()[0];
    expect(shouldPersistMutation(paused)).toBe(true);

    // an unkeyed mutation must never be persisted — it can't be resumed
    const stray = qc
      .getMutationCache()
      .build<unknown, Error, unknown, unknown>(qc, {
        mutationFn: async () => null,
      });
    expect(shouldPersistMutation(stray)).toBe(false);
  });
});
