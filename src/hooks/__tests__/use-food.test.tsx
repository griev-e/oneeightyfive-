// @vitest-environment happy-dom
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Optimistic-mutation hook tests. These pin the contracts CLAUDE.md calls out:
 * the cache moves at tap time, rolls back on failure, and — critically — a
 * failed food log rolls back ONLY its own row, never a concurrent quick-add.
 * Supabase and the toast are irrelevant here, so `fetch` and the toast are
 * stubbed and we assert directly against the TanStack Query cache.
 */
const toastShow = vi.fn();
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ show: toastShow }),
  ToastProvider: ({ children }: { children: ReactNode }) => children,
}));

import { useLogWeight } from "@/hooks/use-weight";
import { useLogFood, useDeleteFoodLog, type FoodLog } from "@/hooks/use-food";

const DATE = "2026-07-18";
const KEY = ["food-logs", DATE];

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function wrapper(qc: QueryClient) {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  Wrapper.displayName = "TestQueryWrapper";
  return Wrapper;
}

function fetchOk(body: unknown) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  }) as unknown as typeof fetch;
}

function fetchFail() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => ({}),
  }) as unknown as typeof fetch;
}

const log = (over: Partial<FoodLog>): FoodLog => ({
  id: "existing",
  date: DATE,
  name: "Oats",
  calories: 300,
  proteinG: 10,
  carbsG: 54,
  fatG: 5,
  mealId: null,
  loggedAt: "2026-07-18T10:00:00Z",
  ...over,
});

beforeEach(() => toastShow.mockClear());
afterEach(() => vi.restoreAllMocks());

describe("useLogWeight — the canonical optimistic mutation", () => {
  it("moves the weigh-in into the cache at tap time, sorted by date", async () => {
    const qc = makeClient();
    qc.setQueryData(["weigh-ins"], [{ date: "2026-07-17", weightLbs: 120 }]);
    fetchOk({ date: DATE, weightLbs: 125 });

    const { result } = renderHook(() => useLogWeight(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ date: DATE, weightLbs: 125 });
    });

    expect(qc.getQueryData(["weigh-ins"])).toEqual([
      { date: "2026-07-17", weightLbs: 120 },
      { date: DATE, weightLbs: 125 },
    ]);
  });

  it("rolls the cache back and toasts on failure", async () => {
    const qc = makeClient();
    const prev = [{ date: "2026-07-17", weightLbs: 120 }];
    qc.setQueryData(["weigh-ins"], prev);
    fetchFail();

    const { result } = renderHook(() => useLogWeight(), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ date: DATE, weightLbs: 125 }).catch(() => {});
    });

    expect(qc.getQueryData(["weigh-ins"])).toEqual(prev);
    expect(toastShow).toHaveBeenCalledWith("Couldn't save — try again");
  });
});

describe("useLogFood", () => {
  it("swaps the temp row for the server row on success", async () => {
    const qc = makeClient();
    qc.setQueryData<FoodLog[]>(KEY, []);
    const saved = log({ id: "server-1", name: "Rice", loggedAt: "2026-07-18T12:00:00Z" });
    fetchOk(saved);

    const { result } = renderHook(() => useLogFood(DATE), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({
        date: DATE,
        name: "Rice",
        calories: 200,
        proteinG: 4,
        carbsG: 44,
        fatG: 0,
      });
    });

    const rows = qc.getQueryData<FoodLog[]>(KEY)!;
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("server-1");
    expect(rows[0].id.startsWith("tmp-")).toBe(false);
  });

  it("rolls back ONLY the failed row — a concurrent log stays intact", async () => {
    const qc = makeClient();
    const concurrent = log({ id: "existing", loggedAt: "2026-07-18T10:00:00Z" });
    qc.setQueryData<FoodLog[]>(KEY, [concurrent]);
    fetchFail();

    const { result } = renderHook(() => useLogFood(DATE), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current
        .mutateAsync({
          date: DATE,
          name: "Rice",
          calories: 200,
          proteinG: 4,
          carbsG: 44,
          fatG: 0,
          loggedAt: "2026-07-18T11:00:00Z",
        })
        .catch(() => {});
    });

    const rows = qc.getQueryData<FoodLog[]>(KEY)!;
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("existing"); // the concurrent quick-add survived
    expect(toastShow).toHaveBeenCalledWith("Couldn't save — try again");
  });
});

describe("useDeleteFoodLog", () => {
  it("removes the row optimistically and restores it on failure", async () => {
    const qc = makeClient();
    const a = log({ id: "a", loggedAt: "2026-07-18T09:00:00Z" });
    const b = log({ id: "b", loggedAt: "2026-07-18T10:00:00Z" });
    qc.setQueryData<FoodLog[]>(KEY, [a, b]);
    fetchFail();

    const { result } = renderHook(() => useDeleteFoodLog(DATE), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync("a").catch(() => {});
    });

    // rollback restores both rows in their original order
    expect(qc.getQueryData<FoodLog[]>(KEY)).toEqual([a, b]);
    expect(toastShow).toHaveBeenCalledWith("Couldn't delete — try again");
  });
});
