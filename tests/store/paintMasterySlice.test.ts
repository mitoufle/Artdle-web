import { describe, it, expect } from "vitest";
import {
  createPaintMasterySlice,
  initialPaintMasteryState,
} from "@/store/paintMasterySlice";
import { big } from "@/core/bigNumber";
import type { GameStore } from "@/store";

/**
 * Mock store harness. The slice creator only reads / writes its own fields;
 * we provide a minimal Record-shaped state container and a set/get pair
 * matching Zustand's signatures.
 */
function createHarness() {
  let state: Record<string, unknown> = { ...initialPaintMasteryState };
  const get = (() => state as unknown as GameStore) as () => GameStore;
  const set = ((partial: unknown) => {
    const update =
      typeof partial === "function" ? (partial as (s: unknown) => unknown)(state) : partial;
    state = { ...state, ...(update as Record<string, unknown>) };
  }) as Parameters<typeof createPaintMasterySlice>[0];
  const slice = createPaintMasterySlice(set, get, {} as Parameters<typeof createPaintMasterySlice>[2]);
  state = { ...state, ...slice };
  return { state: () => state, slice };
}

describe("paintMasterySlice — initial state (v1.1 redesign)", () => {
  it("initial paintMastery is big(0)", () => {
    const h = createHarness();
    expect((h.state().paintMastery as ReturnType<typeof big>).toNumber()).toBe(0);
  });

  it("initial lifetimeGold is big(0)", () => {
    const h = createHarness();
    expect((h.state().lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(0);
  });
});

describe("paintMasterySlice — addGoldEarned (v1.1 redesign)", () => {
  it("phase 1: 1000g sale credits 1 PM and increments lifetimeGold by 1000", () => {
    const h = createHarness();
    h.slice.addGoldEarned(big(1000));
    expect((h.state().paintMastery as ReturnType<typeof big>).toNumber()).toBeCloseTo(1, 9);
    expect((h.state().lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(1000);
  });

  it("phase 1: 100g sale credits 0.1 PM (fractional)", () => {
    const h = createHarness();
    h.slice.addGoldEarned(big(100));
    expect((h.state().paintMastery as ReturnType<typeof big>).toNumber()).toBeCloseTo(0.1, 9);
  });

  it("repeated addGoldEarned accumulates lifetimeGold and PM", () => {
    const h = createHarness();
    h.slice.addGoldEarned(big(500));
    h.slice.addGoldEarned(big(500));
    h.slice.addGoldEarned(big(1000));
    expect((h.state().lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(2000);
    expect((h.state().paintMastery as ReturnType<typeof big>).toNumber()).toBeCloseTo(2, 9);
  });

  it("0g sale is a no-op for PM, increments lifetime by 0", () => {
    const h = createHarness();
    h.slice.addGoldEarned(big(0));
    expect((h.state().paintMastery as ReturnType<typeof big>).toNumber()).toBe(0);
    expect((h.state().lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(0);
  });

  it("phase 2 (lifetime ≥ 1M): 1000g sale credits only 0.001 PM", () => {
    const h = createHarness();
    h.slice._setLifetimeGold(big(1_000_000));
    h.slice.addGoldEarned(big(1000));
    expect((h.state().paintMastery as ReturnType<typeof big>).toNumber()).toBeCloseTo(0.001, 9);
    expect((h.state().lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(1_001_000);
  });

  it("threshold uses pre-sale lifetimeGold (boundary fairness)", () => {
    const h = createHarness();
    // Lifetime 999_999 (still phase 1, threshold 1000); sale of 2g would land in phase 2.
    h.slice._setLifetimeGold(big(999_999));
    h.slice.addGoldEarned(big(2));
    // Pre-sale threshold was 1000, so gain = 2/1000 = 0.002, NOT 2/1M.
    expect((h.state().paintMastery as ReturnType<typeof big>).toNumber()).toBeCloseTo(0.002, 9);
  });
});

describe("paintMasterySlice — test helpers", () => {
  it("_setPaintMastery overwrites paintMastery", () => {
    const h = createHarness();
    h.slice._setPaintMastery(big(12345));
    expect((h.state().paintMastery as ReturnType<typeof big>).toNumber()).toBe(12345);
  });

  it("_setLifetimeGold overwrites lifetimeGold", () => {
    const h = createHarness();
    h.slice._setLifetimeGold(big(67890));
    expect((h.state().lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(67890);
  });
});
