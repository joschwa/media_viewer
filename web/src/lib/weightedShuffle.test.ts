import { describe, expect, it } from "vitest";
import { weightedShuffle, weightMultiplier } from "./weightedShuffle.js";

describe("weightMultiplier", () => {
  it("is 1x at baseline and doubles every +25", () => {
    expect(weightMultiplier(0)).toBeCloseTo(1);
    expect(weightMultiplier(25)).toBeCloseTo(2);
    expect(weightMultiplier(50)).toBeCloseTo(4);
    expect(weightMultiplier(-25)).toBeCloseTo(0.5);
  });
});

describe("weightedShuffle", () => {
  it("returns a full permutation with no duplicates or omissions", () => {
    const items = [{ id: 1, w: 0 }, { id: 2, w: 50 }, { id: 3, w: -50 }];
    const result = weightedShuffle(items, (i) => i.w);
    expect(result).toHaveLength(3);
    expect(new Set(result.map((i) => i.id))).toEqual(new Set([1, 2, 3]));
  });

  it("draws higher-weight items first proportionally more often (statistical sanity check)", () => {
    const items = [
      { id: "low", w: -50 },
      { id: "baseline", w: 0 },
      { id: "high", w: 50 },
    ];

    const firstPickCounts: Record<string, number> = { low: 0, baseline: 0, high: 0 };
    const trials = 5000;
    for (let i = 0; i < trials; i++) {
      const shuffled = weightedShuffle(items, (item) => item.w);
      firstPickCounts[shuffled[0].id] += 1;
    }

    // "high" (4x baseline multiplier) should be drawn first far more often than "low" (1/4x).
    expect(firstPickCounts.high).toBeGreaterThan(firstPickCounts.baseline);
    expect(firstPickCounts.baseline).toBeGreaterThan(firstPickCounts.low);
    // Roughly matches the 16:4:1 ratio implied by weightMultiplier(-50/0/50) over enough trials.
    expect(firstPickCounts.high / firstPickCounts.low).toBeGreaterThan(8);
  });
});
