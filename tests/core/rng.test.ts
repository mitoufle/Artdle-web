import { describe, it, expect, beforeEach } from "vitest";
import { setSeed, rng, rngInt, rngFloat, rngPick } from "@/core/rng";

describe("rng", () => {
  beforeEach(() => setSeed(42));

  it("is deterministic for a given seed", () => {
    const a = [rng(), rng(), rng()];
    setSeed(42);
    const b = [rng(), rng(), rng()];
    expect(a).toEqual(b);
  });

  it("changes output for different seeds", () => {
    setSeed(1);
    const a = rng();
    setSeed(2);
    const b = rng();
    expect(a).not.toBe(b);
  });

  it("produces values in [0, 1)", () => {
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("rngInt", () => {
  beforeEach(() => setSeed(42));

  it("respects bounds inclusive", () => {
    for (let i = 0; i < 1000; i++) {
      const v = rngInt(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("returns the single value when min==max", () => {
    expect(rngInt(5, 5)).toBe(5);
    expect(rngInt(5, 5)).toBe(5);
  });
});

describe("rngFloat", () => {
  beforeEach(() => setSeed(42));

  it("respects bounds: [min, max)", () => {
    for (let i = 0; i < 1000; i++) {
      const v = rngFloat(2.5, 7.5);
      expect(v).toBeGreaterThanOrEqual(2.5);
      expect(v).toBeLessThan(7.5);
    }
  });
});

describe("rngPick", () => {
  beforeEach(() => setSeed(42));

  it("returns an element from the array", () => {
    const arr = ["a", "b", "c", "d"] as const;
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(rngPick(arr));
    }
  });

  it("throws on empty array", () => {
    expect(() => rngPick([])).toThrow("rngPick: empty array");
  });
});
