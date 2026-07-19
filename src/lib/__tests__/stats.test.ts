import { describe, expect, it } from "vitest";
import {
  classifySet,
  computePace,
  e1rm,
  e1rmSeries,
  foldRecords,
  projectionGuide,
  rollingAverage,
  sessionVolume,
  weeklyVolume,
  type ExerciseRecords,
  type WeighIn,
} from "@/lib/stats";

/** Build a contiguous daily weigh-in series starting at `from`. */
function series(from: string, weights: number[]): WeighIn[] {
  const [y, m, d] = from.split("-").map(Number);
  return weights.map((weightLbs, i) => {
    const date = new Date(y, m - 1, d + i);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { date: iso, weightLbs };
  });
}

describe("rollingAverage", () => {
  it("returns one point per weigh-in and never interpolates a missing day", () => {
    const input: WeighIn[] = [
      { date: "2026-07-01", weightLbs: 180 },
      { date: "2026-07-05", weightLbs: 184 }, // 4-day gap, no fabricated points
    ];
    const ra = rollingAverage(input);
    expect(ra.map((p) => p.date)).toEqual(["2026-07-01", "2026-07-05"]);
  });

  it("averages only the weigh-ins that fall inside the trailing 7-day window", () => {
    // day 0 = 180 alone; day 6 sees both 180 and 186 (span exactly 7 days)
    const input = series("2026-07-01", [180, NaN, NaN, NaN, NaN, NaN, 186]).filter(
      (p) => !Number.isNaN(p.weightLbs),
    );
    const ra = rollingAverage(input);
    expect(ra[0].weightLbs).toBe(180); // window has only itself
    expect(ra[1].weightLbs).toBe(183); // (180 + 186) / 2 — 180 is day −6, still in window
  });

  it("drops points that fall outside the window", () => {
    const input: WeighIn[] = [
      { date: "2026-07-01", weightLbs: 180 },
      { date: "2026-07-09", weightLbs: 190 }, // 8 days later → 180 is out of window
    ];
    const ra = rollingAverage(input);
    expect(ra[1].weightLbs).toBe(190); // only itself
  });
});

describe("computePace", () => {
  it("reports gathering until there are at least five weigh-ins", () => {
    const pace = computePace(series("2026-07-01", [180, 181, 182, 183]), 0.5);
    expect(pace).toEqual({ status: "gathering", have: 4, need: 5 });
  });

  it("is on-pace when the smoothed weekly change sits inside the goal band", () => {
    // +0.5 lb/day over the window → but pace anchors on the 7-day-old RA point
    const pace = computePace(
      series("2026-07-01", [180, 180.1, 180.2, 180.3, 180.4, 180.5, 180.6, 180.7]),
      0.5,
    );
    expect(pace.status).toBe("ready");
    if (pace.status === "ready") {
      expect(pace.band).toBe("on-pace");
    }
  });

  it("flags behind when the trend is flat against a gaining goal", () => {
    const pace = computePace(
      series("2026-07-01", [180, 180, 180, 180, 180, 180, 180, 180]),
      0.5,
    );
    expect(pace.status).toBe("ready");
    if (pace.status === "ready") {
      expect(pace.lbsPerWeek).toBeCloseTo(0, 5);
      expect(pace.band).toBe("behind");
    }
  });

  it("flags ahead when the trend outruns the goal band", () => {
    const pace = computePace(
      series("2026-07-01", [180, 181, 182, 183, 184, 185, 186, 187]),
      0.5,
    );
    expect(pace.status).toBe("ready");
    if (pace.status === "ready") {
      expect(pace.band).toBe("ahead");
      expect(pace.lbsPerWeek).toBeGreaterThan(0.75);
    }
  });
});

describe("e1rm", () => {
  it("is the bare weight at one rep (Epley)", () => {
    expect(e1rm(200, 1)).toBeCloseTo(200 * (1 + 1 / 30), 5);
  });

  it("clamps reps at 12 so a high-rep set can't inflate the estimate", () => {
    expect(e1rm(100, 20)).toBe(e1rm(100, 12));
    expect(e1rm(100, 12)).toBeCloseTo(140, 5);
  });
});

describe("sessionVolume", () => {
  it("sums weight × reps and ignores bodyweight sets (weight 0)", () => {
    expect(
      sessionVolume([
        { weightLbs: 100, reps: 5 },
        { weightLbs: 0, reps: 20 },
      ]),
    ).toBe(500);
  });
});

describe("foldRecords", () => {
  const base: ExerciseRecords = {
    maxWeightLbs: 200,
    maxE1rm: 220,
    maxRepsAtBodyweight: 10,
  };

  it("raises the weighted records when today's set beats them", () => {
    const folded = foldRecords(base, [{ weightLbs: 225, reps: 3 }]);
    expect(folded.maxWeightLbs).toBe(225);
    expect(folded.maxE1rm).toBeCloseTo(e1rm(225, 3), 5);
  });

  it("raises the bodyweight rep record independently of weighted records", () => {
    const folded = foldRecords(base, [{ weightLbs: 0, reps: 15 }]);
    expect(folded.maxRepsAtBodyweight).toBe(15);
    expect(folded.maxWeightLbs).toBe(200);
  });

  it("leaves records untouched when nothing beats them", () => {
    expect(foldRecords(base, [{ weightLbs: 135, reps: 5 }])).toEqual(base);
  });
});

describe("classifySet", () => {
  const records: ExerciseRecords = {
    maxWeightLbs: 200,
    maxE1rm: 220,
    maxRepsAtBodyweight: 10,
  };

  it("stays silent on a first-ever session (null server records)", () => {
    expect(
      classifySet({ weightLbs: 500, reps: 12 }, null, [], null),
    ).toBe("none");
  });

  it("fires a PR when the set beats the all-time max weight", () => {
    expect(
      classifySet({ weightLbs: 205, reps: 1 }, records, [], null),
    ).toBe("pr");
  });

  it("fires a PR on a new e1RM even below the max weight", () => {
    // 190×8 → e1RM ≈ 240.7, beats the 220 record though 190 < 200
    expect(
      classifySet({ weightLbs: 190, reps: 8 }, records, [], null),
    ).toBe("pr");
  });

  it("does not re-PR a lift already matched by an earlier set today", () => {
    // an earlier 205×1 folds into records → the repeat is no longer a PR
    expect(
      classifySet(
        { weightLbs: 205, reps: 1 },
        records,
        [{ weightLbs: 205, reps: 1 }],
        null,
      ),
    ).toBe("none");
  });

  it("marks overload when e1RM beats the positional ghost but not the record", () => {
    // 150×5 (e1RM 175) beats ghost 145×5 (e1RM ~169) yet is under the 220 record
    expect(
      classifySet(
        { weightLbs: 150, reps: 5 },
        records,
        [],
        { weightLbs: 145, reps: 5 },
      ),
    ).toBe("overload");
  });

  it("does not treat more weight at fewer reps as overload — 105×3 loses to 100×10", () => {
    expect(
      classifySet(
        { weightLbs: 105, reps: 3 },
        records,
        [],
        { weightLbs: 100, reps: 10 },
      ),
    ).toBe("none");
  });

  it("judges bodyweight PRs on reps", () => {
    expect(
      classifySet({ weightLbs: 0, reps: 11 }, records, [], null),
    ).toBe("pr");
    expect(
      classifySet({ weightLbs: 0, reps: 9 }, records, [], { weightLbs: 0, reps: 8 }),
    ).toBe("overload");
  });

  it("returns none when there is no ghost and no record is beaten", () => {
    expect(
      classifySet({ weightLbs: 135, reps: 5 }, records, [], null),
    ).toBe("none");
  });
});

describe("e1rmSeries", () => {
  it("maps newest-first sessions to an ascending e1RM series", () => {
    const out = e1rmSeries([
      { date: "2026-07-15", sets: 3, topWeight: 150, topReps: 5 },
      { date: "2026-07-10", sets: 3, topWeight: 145, topReps: 5 },
    ]);
    expect(out.map((p) => p.date)).toEqual(["2026-07-10", "2026-07-15"]);
    expect(out[1].weightLbs).toBeCloseTo(e1rm(150, 5));
  });

  it("uses top reps as the y-value for bodyweight sessions", () => {
    const out = e1rmSeries([
      { date: "2026-07-15", sets: 3, topWeight: 0, topReps: 12 },
      { date: "2026-07-10", sets: 3, topWeight: 0, topReps: 10 },
    ]);
    expect(out.map((p) => p.weightLbs)).toEqual([10, 12]);
  });
});

describe("projectionGuide", () => {
  const from: WeighIn = { date: "2026-07-18", weightLbs: 126 };

  it("draws a 2-point line at the goal rate", () => {
    const guide = projectionGuide(from, 0.5, 28, 185);
    expect(guide).toHaveLength(2);
    expect(guide[0]).toEqual(from);
    expect(guide[1].date).toBe("2026-08-15");
    expect(guide[1].weightLbs).toBeCloseTo(128);
  });

  it("clamps the line at the goal weight", () => {
    const guide = projectionGuide(from, 0.5, 28, 127);
    expect(guide[1].weightLbs).toBeLessThanOrEqual(127.1);
    expect(guide[1].date < "2026-08-15").toBe(true);
  });

  it("returns nothing at/past goal, at a zero rate, or with no anchor", () => {
    expect(projectionGuide({ date: "2026-07-18", weightLbs: 185 }, 0.5, 28, 185)).toEqual([]);
    expect(projectionGuide(from, 0, 28, 185)).toEqual([]);
    expect(projectionGuide(undefined, 0.5, 28, 185)).toEqual([]);
  });
});

describe("weeklyVolume", () => {
  const TODAY = "2026-07-19"; // a Sunday — the current week starts Mon 2026-07-13
  const day = (date: string, volumeLbs: number) => ({ date, volumeLbs, sets: 3 });

  it("buckets by Monday-start weeks, zero-filling untrained weeks", () => {
    const out = weeklyVolume(
      [day("2026-07-12", 5000), day("2026-07-13", 6000)], // Sun vs Mon straddle
      [],
      TODAY,
      4,
    );
    expect(out.map((w) => w.weekStart)).toEqual([
      "2026-06-22",
      "2026-06-29",
      "2026-07-06",
      "2026-07-13",
    ]);
    expect(out.map((w) => w.volumeLbs)).toEqual([0, 0, 5000, 6000]);
    expect(out.map((w) => w.sessions)).toEqual([0, 0, 1, 1]);
  });

  it("drops feed rows at/after today and overlays the live session instead", () => {
    const out = weeklyVolume(
      [day(TODAY, 9999)], // a stale synced row for today must not double-count
      [
        { weightLbs: 100, reps: 5 },
        { weightLbs: 100, reps: 5 },
      ],
      TODAY,
      2,
    );
    const current = out[out.length - 1];
    expect(current.volumeLbs).toBe(1000);
    expect(current.sessions).toBe(1);
  });

  it("counts a bodyweight-only session with zero tonnage", () => {
    const out = weeklyVolume([], [{ weightLbs: 0, reps: 12 }], TODAY, 2);
    expect(out[out.length - 1]).toEqual({
      weekStart: "2026-07-13",
      volumeLbs: 0,
      sessions: 1,
    });
  });

  it("ignores closed days older than the window", () => {
    const out = weeklyVolume([day("2026-06-01", 4000)], [], TODAY, 2);
    expect(out.every((w) => w.volumeLbs === 0)).toBe(true);
  });
});
