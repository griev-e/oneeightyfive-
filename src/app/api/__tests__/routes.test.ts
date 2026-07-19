import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route-handler contract tests. Supabase is fully mocked — these assert the
 * request/response contract (validation → 400/500 shapes, camelCase mapping,
 * the "server never guesses local time" query-param invariant), not the DB.
 *
 * The mock is a chainable proxy: every query-builder method returns the proxy,
 * and awaiting any terminal (`.single()`, `.order()`, …) resolves the single
 * configured `{ data, error }`. Enough for one terminal query per request.
 */
const { setResult, client } = vi.hoisted(() => {
  const state: { result: { data: unknown; error: unknown } } = {
    result: { data: null, error: null },
  };
  const proxy: unknown = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => unknown) => resolve(state.result);
      }
      return () => proxy;
    },
  });
  return {
    client: { from: () => proxy },
    setResult: (r: { data: unknown; error: unknown }) => {
      state.result = r;
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({ supabaseServer: () => client }));

import { GET as weightGET, PUT as weightPUT } from "@/app/api/weight/route";
import { GET as logsGET, POST as logsPOST } from "@/app/api/food-logs/route";
import { GET as suggestGET } from "@/app/api/food-suggestions/route";
import { GET as planEventsGET } from "@/app/api/plan-events/route";
import { GET as daySummariesGET } from "@/app/api/day-summaries/route";
import { POST as unlockPOST } from "@/app/api/unlock/route";
import { UNLOCK_COOKIE, unlockToken } from "@/lib/auth";

const post = (url: string, body: unknown) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const put = (url: string, body: unknown) =>
  new Request(url, { method: "PUT", body: JSON.stringify(body) });

beforeEach(() => setResult({ data: null, error: null }));

describe("GET /api/weight", () => {
  it("maps snake_case rows to camelCase DTOs", async () => {
    setResult({
      data: [
        { date: "2026-07-17", weight_lbs: 125.4 },
        { date: "2026-07-18", weight_lbs: 125.8 },
      ],
      error: null,
    });
    const res = await weightGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { date: "2026-07-17", weightLbs: 125.4 },
      { date: "2026-07-18", weightLbs: 125.8 },
    ]);
  });

  it("surfaces a DB error as a 500", async () => {
    setResult({ data: null, error: { message: "boom" } });
    const res = await weightGET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "boom" });
  });
});

describe("PUT /api/weight", () => {
  it("rejects a bad date shape with 400", async () => {
    const res = await weightPUT(put("http://x/api/weight", { date: "7/18/26", weightLbs: 125 }));
    expect(res.status).toBe(400);
  });

  it("rejects an out-of-range weight with 400", async () => {
    for (const weightLbs of [49, 501]) {
      const res = await weightPUT(put("http://x/api/weight", { date: "2026-07-18", weightLbs }));
      expect(res.status).toBe(400);
    }
  });

  it("upserts a valid weigh-in and returns the camelCase row", async () => {
    setResult({ data: { date: "2026-07-18", weight_lbs: 125.8 }, error: null });
    const res = await weightPUT(put("http://x/api/weight", { date: "2026-07-18", weightLbs: 125.8 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ date: "2026-07-18", weightLbs: 125.8 });
  });
});

describe("GET /api/food-logs", () => {
  it("requires a date param", async () => {
    const res = await logsGET(new Request("http://x/api/food-logs"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "date required" });
  });

  it("maps rows to DTOs for a valid date", async () => {
    setResult({
      data: [
        {
          id: "a",
          date: "2026-07-18",
          name: "Oats",
          calories: 300,
          protein_g: 10,
          carbs_g: 54,
          fat_g: 5,
          meal_id: null,
          logged_at: "2026-07-18T13:00:00Z",
        },
      ],
      error: null,
    });
    const res = await logsGET(new Request("http://x/api/food-logs?date=2026-07-18"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      {
        id: "a",
        date: "2026-07-18",
        name: "Oats",
        calories: 300,
        proteinG: 10,
        carbsG: 54,
        fatG: 5,
        mealId: null,
        loggedAt: "2026-07-18T13:00:00Z",
      },
    ]);
  });
});

describe("POST /api/food-logs", () => {
  it("400s on a missing date", async () => {
    const res = await logsPOST(post("http://x/api/food-logs", { calories: 300 }));
    expect(res.status).toBe(400);
  });

  it("400s when calories are out of range", async () => {
    const res = await logsPOST(post("http://x/api/food-logs", { date: "2026-07-18", calories: 99999 }));
    expect(res.status).toBe(400);
  });

  it("defaults the name to 'Quick add' and macros to 0, returning a DTO", async () => {
    setResult({
      data: {
        id: "z",
        date: "2026-07-18",
        name: "Quick add",
        calories: 300,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        meal_id: null,
        logged_at: "2026-07-18T13:00:00Z",
      },
      error: null,
    });
    const res = await logsPOST(post("http://x/api/food-logs", { date: "2026-07-18", calories: 300 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ name: "Quick add", proteinG: 0, mealId: null });
  });
});

describe("GET /api/food-suggestions — client supplies local time", () => {
  it("400s on a missing date or out-of-range hour/timezone (server never guesses)", async () => {
    const cases = [
      "http://x/api/food-suggestions", // no date
      "http://x/api/food-suggestions?date=bad&hour=8&timezoneOffsetMinutes=0",
      "http://x/api/food-suggestions?date=2026-07-18&hour=25&timezoneOffsetMinutes=0",
      "http://x/api/food-suggestions?date=2026-07-18&hour=8.5&timezoneOffsetMinutes=0",
      "http://x/api/food-suggestions?date=2026-07-18&hour=8&timezoneOffsetMinutes=9999",
    ];
    for (const url of cases) {
      const res = await suggestGET(new Request(url));
      expect(res.status).toBe(400);
    }
  });

  it("returns ranked suggestions and yesterday's logs for valid params", async () => {
    setResult({
      data: [
        {
          id: "1",
          date: "2026-07-17",
          name: "Oats",
          calories: 300,
          protein_g: 10,
          carbs_g: 54,
          fat_g: 5,
          meal_id: null,
          logged_at: "2026-07-17T13:00:00Z",
        },
      ],
      error: null,
    });
    const res = await suggestGET(
      new Request("http://x/api/food-suggestions?date=2026-07-18&hour=13&timezoneOffsetMinutes=0"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.suggestions)).toBe(true);
    expect(body.yesterday).toHaveLength(1);
    expect(body.yesterday[0].name).toBe("Oats");
  });
});

describe("GET /api/plan-events", () => {
  it("returns the newest-first audit list as camelCase DTOs", async () => {
    setResult({
      data: [
        {
          id: "e1",
          date: "2026-07-18",
          action: "applied",
          observed_tdee: 2900,
          target_before: 2700,
          target_suggested: 2850,
          created_at: "2026-07-18T13:00:00Z",
        },
      ],
      error: null,
    });
    const res = await planEventsGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      {
        id: "e1",
        date: "2026-07-18",
        action: "applied",
        observedTdee: 2900,
        targetBefore: 2700,
        targetSuggested: 2850,
        createdAt: "2026-07-18T13:00:00Z",
      },
    ]);
  });

  it("returns an empty list when no events exist", async () => {
    setResult({ data: [], error: null });
    const res = await planEventsGET();
    expect(await res.json()).toEqual([]);
  });
});

describe("GET /api/day-summaries", () => {
  it("requires a from param", async () => {
    const res = await daySummariesGET(new Request("http://x/api/day-summaries"));
    expect(res.status).toBe(400);
  });

  it("folds carbs and fat into the per-day sums", async () => {
    // the shared mock answers every query with the same rows — one row that
    // carries every column exercises all three folds at once
    setResult({
      data: [
        {
          date: "2026-07-17",
          calories: 800,
          protein_g: 40,
          carbs_g: 90,
          fat_g: 25,
          effective_date: "2026-07-01",
          calorie_target: 2700,
          protein_target_g: 135,
          carb_target_g: 360,
          fat_target_g: 80,
        },
        {
          date: "2026-07-17",
          calories: 700,
          protein_g: 35,
          carbs_g: 60,
          fat_g: 20,
          effective_date: "2026-07-01",
          calorie_target: 2700,
          protein_target_g: 135,
          carb_target_g: 360,
          fat_target_g: 80,
        },
      ],
      error: null,
    });
    const res = await daySummariesGET(
      new Request("http://x/api/day-summaries?from=2026-07-01"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.days).toEqual([
      {
        date: "2026-07-17",
        calories: 1500,
        proteinG: 75,
        carbsG: 150,
        fatG: 45,
        entryCount: 2,
      },
    ]);
    expect(body.targets[0]).toMatchObject({ carbTargetG: 360, fatTargetG: 80 });
    expect(body.trainingDates).toEqual(["2026-07-17"]);
  });
});

describe("POST /api/unlock", () => {
  const ORIGINAL = process.env.PIN_LOCK;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.PIN_LOCK;
    else process.env.PIN_LOCK = ORIGINAL;
  });

  it("500s when PIN_LOCK is not configured", async () => {
    delete process.env.PIN_LOCK;
    const res = await unlockPOST(post("http://x/api/unlock", { pin: "1234" }));
    expect(res.status).toBe(500);
  });

  it("401s on the wrong PIN without setting a cookie", async () => {
    process.env.PIN_LOCK = "1234";
    const res = await unlockPOST(post("http://x/api/unlock", { pin: "0000" }));
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("200s on the right PIN and sets the HMAC unlock cookie", async () => {
    process.env.PIN_LOCK = "1234";
    setResult({ data: { name: "kevin" }, error: null });
    const res = await unlockPOST(post("http://x/api/unlock", { pin: "1234" }));
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${UNLOCK_COOKIE}=${await unlockToken("1234")}`);
    expect(cookie.toLowerCase()).toContain("httponly");
  });
});
