import { describe, it, expect } from "vitest";
import { getSketchUrl, getCellRevealOrder } from "@/components/painting/canvasArt";

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
