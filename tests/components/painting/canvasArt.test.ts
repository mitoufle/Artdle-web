import { describe, it, expect } from "vitest";
import { getSketchUrl, getCellRevealOrder, getSketchGridDim } from "@/components/painting/canvasArt";

describe("canvasArt — getSketchUrl", () => {
  it("returns a string URL for T1", () => {
    const url = getSketchUrl(1, 1);
    expect(typeof url).toBe("string");
    expect(url).toMatch(/\.png/);
  });

  it("same canvasNumber + tier returns the same URL (deterministic)", () => {
    expect(getSketchUrl(1, 42)).toBe(getSketchUrl(1, 42));
    expect(getSketchUrl(2, 100)).toBe(getSketchUrl(2, 100));
  });

  it("different canvasNumbers in the same tier likely return different URLs across the pool", () => {
    const seen = new Set<string | null>();
    for (let i = 0; i < 50; i++) seen.add(getSketchUrl(1, i));
    // T1 has 8 sketches; 50 random picks should hit at least 3 distinct entries.
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it("falls back to T4 art for tiers above the highest authored (T5+)", () => {
    const t4 = getSketchUrl(4, 7);
    const t5 = getSketchUrl(5, 7);
    const t10 = getSketchUrl(10, 7);
    expect(t5).toBe(t4);
    expect(t10).toBe(t4);
  });

  it("clamps tier < 1 to T1", () => {
    expect(getSketchUrl(0, 5)).toBe(getSketchUrl(1, 5));
    expect(getSketchUrl(-1, 5)).toBe(getSketchUrl(1, 5));
  });
});

describe("canvasArt — getCellRevealOrder", () => {
  it("returns a permutation of [0, totalCells)", () => {
    const order = getCellRevealOrder(123, 25);
    expect(order.length).toBe(25);
    expect(new Set(order).size).toBe(25);
    expect(Math.min(...order)).toBe(0);
    expect(Math.max(...order)).toBe(24);
  });

  it("is deterministic for the same canvasNumber", () => {
    expect(getCellRevealOrder(7, 25)).toEqual(getCellRevealOrder(7, 25));
  });

  it("typically differs between different canvasNumbers", () => {
    const a = getCellRevealOrder(1, 25);
    const b = getCellRevealOrder(2, 25);
    expect(a).not.toEqual(b);
  });

  it("works for arbitrary totalCells (e.g., 16)", () => {
    const order = getCellRevealOrder(99, 16);
    expect(order.length).toBe(16);
    expect(new Set(order).size).toBe(16);
  });
});

describe("canvasArt — getSketchGridDim", () => {
  it("returns 5 for T1 (baseline 5x5 = 25 chunks)", () => {
    expect(getSketchGridDim(1)).toBe(5);
  });

  it("approximately doubles cell count per tier from T1 to T5, then plateaus", () => {
    // round(5 * sqrt(2)^(t-1)) → 5, 7, 10, 14, 20, capped at 20 thereafter.
    expect(getSketchGridDim(2)).toBe(7);   // 49 ≈ 2 * 25
    expect(getSketchGridDim(3)).toBe(10);  // 100 ≈ 4 * 25
    expect(getSketchGridDim(4)).toBe(14);  // 196 ≈ 8 * 25
    expect(getSketchGridDim(5)).toBe(20);  // 400 = 16 * 25
    expect(getSketchGridDim(6)).toBe(20);  // capped (raw would be 28 / 784)
    expect(getSketchGridDim(7)).toBe(20);  // capped (raw would be 40 / 1600)
  });

  it("cell count grows monotonically from T1 to T5 and stays flat from T5+", () => {
    let prev = 0;
    for (let t = 1; t <= 5; t++) {
      const dim = getSketchGridDim(t);
      const count = dim * dim;
      expect(count).toBeGreaterThan(prev);
      prev = count;
    }
    // From T5 onward, dim is capped at 20 → count stays at 400.
    for (let t = 5; t <= 11; t++) {
      const dim = getSketchGridDim(t);
      expect(dim * dim).toBe(400);
    }
  });

  it("clamps tier < 1 to the T1 dim", () => {
    expect(getSketchGridDim(0)).toBe(5);
    expect(getSketchGridDim(-3)).toBe(5);
  });
});

describe("getSketchGridDim cap", () => {
  it("returns the formula value at T1-T4 (unchanged)", () => {
    expect(getSketchGridDim(1)).toBe(5);
    expect(getSketchGridDim(2)).toBe(7);
    expect(getSketchGridDim(3)).toBe(10);
    expect(getSketchGridDim(4)).toBe(14);
  });

  it("caps at 20 from T5 onward", () => {
    expect(getSketchGridDim(5)).toBe(20);
    expect(getSketchGridDim(6)).toBe(20);
    expect(getSketchGridDim(10)).toBe(20);
    expect(getSketchGridDim(100)).toBe(20);
  });

  it("never exceeds 400 total cells", () => {
    for (let t = 1; t <= 30; t++) {
      const dim = getSketchGridDim(t);
      expect(dim * dim).toBeLessThanOrEqual(400);
    }
  });
});
