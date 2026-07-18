import { describe, expect, it } from "vitest";
import {
  RECALIBRATION_COOLDOWN_DAYS,
  RECALIBRATION_MIN_DELTA,
  shouldSuggestRecalibration,
} from "@/lib/recalibration";
import { sessionVolume } from "@/lib/stats";

const TODAY = "2026-07-18";

describe("shouldSuggestRecalibration", () => {
  it("suggests when the delta clears the threshold and no event is on the clock", () => {
    expect(
      shouldSuggestRecalibration({
        currentTarget: 2700,
        suggestedTarget: 3000,
        lastEventDate: null,
        today: TODAY,
      }),
    ).toBe(true);
  });

  it("stays quiet for a delta inside formula noise", () => {
    expect(
      shouldSuggestRecalibration({
        currentTarget: 2700,
        suggestedTarget: 2700 + RECALIBRATION_MIN_DELTA - 1,
        lastEventDate: null,
        today: TODAY,
      }),
    ).toBe(false);
  });

  it("suggests a downward retarget too (only ever reached when ahead of pace)", () => {
    expect(
      shouldSuggestRecalibration({
        currentTarget: 3000,
        suggestedTarget: 2700,
        lastEventDate: null,
        today: TODAY,
      }),
    ).toBe(true);
  });

  it("a recent event silences the card for the cooldown window", () => {
    const recent = "2026-07-10"; // 8 days ago
    expect(daysAgo(recent)).toBeLessThan(RECALIBRATION_COOLDOWN_DAYS);
    expect(
      shouldSuggestRecalibration({
        currentTarget: 2700,
        suggestedTarget: 3100,
        lastEventDate: recent,
        today: TODAY,
      }),
    ).toBe(false);
  });

  it("resurfaces once the cooldown has fully elapsed", () => {
    const old = "2026-07-03"; // 15 days ago
    expect(daysAgo(old)).toBeGreaterThanOrEqual(RECALIBRATION_COOLDOWN_DAYS);
    expect(
      shouldSuggestRecalibration({
        currentTarget: 2700,
        suggestedTarget: 3100,
        lastEventDate: old,
        today: TODAY,
      }),
    ).toBe(true);
  });
});

describe("sessionVolume", () => {
  it("sums weight × reps across sets", () => {
    expect(
      sessionVolume([
        { weightLbs: 100, reps: 5 },
        { weightLbs: 135, reps: 3 },
      ]),
    ).toBe(905);
  });

  it("is zero for bodyweight-only work", () => {
    expect(
      sessionVolume([
        { weightLbs: 0, reps: 12 },
        { weightLbs: 0, reps: 10 },
      ]),
    ).toBe(0);
  });
});

function daysAgo(date: string): number {
  const [fy, fm, fd] = date.split("-").map(Number);
  const [ty, tm, td] = TODAY.split("-").map(Number);
  return Math.round(
    (new Date(ty, tm - 1, td).getTime() - new Date(fy, fm - 1, fd).getTime()) /
      86_400_000,
  );
}
