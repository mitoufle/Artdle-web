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

describe("paintMasterySlice — addGoldEarned (v1.1 integer redesign)", () => {
  it("phase 1: 1000g sale credits 1 PM and increments lifetimeGold by 1000", () => {
    const h = createHarness();
    h.slice.addGoldEarned(big(1000));
    expect((h.state().paintMastery as ReturnType<typeof big>).toNumber()).toBe(1);
    expect((h.state().lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(1000);
  });

  it("phase 1: 999g sale credits 0 PM (sub-threshold)", () => {
    const h = createHarness();
    h.slice.addGoldEarned(big(999));
    expect((h.state().paintMastery as ReturnType<typeof big>).toNumber()).toBe(0);
    expect((h.state().lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(999);
  });

  it("two 500g sales: PM ticks once when crossing 1000g", () => {
    const h = createHarness();
    h.slice.addGoldEarned(big(500));
    expect((h.state().paintMastery as ReturnType<typeof big>).toNumber()).toBe(0);
    h.slice.addGoldEarned(big(500));
    expect((h.state().paintMastery as ReturnType<typeof big>).toNumber()).toBe(1);
  });

  it("0g sale is a no-op for both PM and lifetime", () => {
    const h = createHarness();
    h.slice.addGoldEarned(big(0));
    expect((h.state().paintMastery as ReturnType<typeof big>).toNumber()).toBe(0);
    expect((h.state().lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(0);
  });

  it("at high lifetime gold, 1000g sale credits 1 PM (linear, no phase slowdown)", () => {
    const h = createHarness();
    h.slice._setLifetimeGold(big(1_000_000));
    h.slice.addGoldEarned(big(1000));
    // Linear: pmFromLifetime(1_001_000) - pmFromLifetime(1_000_000) = 1001 - 1000 = 1 PM
    expect((h.state().paintMastery as ReturnType<typeof big>).toNumber()).toBe(1);
    expect((h.state().lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(1_001_000);
  });

  it("at high lifetime gold, 1M-gold sale credits 1000 PM (linear: no phase cap)", () => {
    const h = createHarness();
    h.slice._setLifetimeGold(big(1_000_000));
    h.slice.addGoldEarned(big(1_000_000));
    // Linear: pmFromLifetime(2_000_000) - pmFromLifetime(1_000_000) = 2000 - 1000 = 1000 PM
    expect((h.state().paintMastery as ReturnType<typeof big>).toNumber()).toBe(1000);
  });

  it("boundary crossing: lt=999_500, sale=1000 grants 1 PM (linear)", () => {
    const h = createHarness();
    h.slice._setLifetimeGold(big(999_500));
    h.slice.addGoldEarned(big(1000));
    // Linear: pmFromLifetime(999_500) = 999. pmFromLifetime(1_000_500) = 1000.
    expect((h.state().paintMastery as ReturnType<typeof big>).toNumber()).toBe(1);
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
