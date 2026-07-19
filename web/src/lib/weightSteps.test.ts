import { describe, expect, it } from "vitest";
import { bumpWeight, clampWeight, stepForWeight } from "./weightSteps.js";

describe("stepForWeight", () => {
  it("uses big steps near baseline and small steps at the extremes", () => {
    expect(stepForWeight(0)).toBe(10);
    expect(stepForWeight(9)).toBe(10);
    expect(stepForWeight(10)).toBe(5);
    expect(stepForWeight(29)).toBe(5);
    expect(stepForWeight(30)).toBe(2);
    expect(stepForWeight(59)).toBe(2);
    expect(stepForWeight(60)).toBe(1);
    expect(stepForWeight(100)).toBe(1);
  });

  it("is symmetric for negative weights", () => {
    expect(stepForWeight(-5)).toBe(10);
    expect(stepForWeight(-30)).toBe(2);
  });
});

describe("bumpWeight", () => {
  it("takes big first steps away from baseline", () => {
    expect(bumpWeight(0, 1)).toBe(10);
    expect(bumpWeight(0, -1)).toBe(-10);
  });

  it("takes progressively smaller steps further from baseline", () => {
    let weight = 0;
    const stepsUp = [];
    for (let i = 0; i < 6; i++) {
      weight = bumpWeight(weight, 1);
      stepsUp.push(weight);
    }
    expect(stepsUp).toEqual([10, 15, 20, 25, 30, 32]);
  });

  it("clamps at the range boundaries", () => {
    expect(bumpWeight(100, 1)).toBe(100);
    expect(bumpWeight(-100, -1)).toBe(-100);
  });
});

describe("clampWeight", () => {
  it("clamps to [-100, 100] and rounds", () => {
    expect(clampWeight(150)).toBe(100);
    expect(clampWeight(-150)).toBe(-100);
    expect(clampWeight(12.6)).toBe(13);
  });

  it("treats NaN as 0", () => {
    expect(clampWeight(Number.NaN)).toBe(0);
  });
});
