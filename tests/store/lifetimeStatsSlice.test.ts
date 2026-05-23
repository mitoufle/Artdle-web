import { describe, it, expect } from "vitest";
import {
  createLifetimeStatsSlice,
  initialLifetimeStatsState,
} from "@/store/lifetimeStatsSlice";
import { big } from "@/core/bigNumber";
import type { GameStore } from "@/store";

/**
 * Mock store harness. The slice creator only reads / writes its own fields;
 * we provide a minimal Record-shaped state container and a set/get pair
 * matching Zustand's signatures.
 */
function createHarness() {
  let state: Record<string, unknown> = { ...initialLifetimeStatsState };
  const get = (() => state as unknown as GameStore) as () => GameStore;
  const set = ((partial: unknown) => {
    const update =
      typeof partial === "function" ? (partial as (s: unknown) => unknown)(state) : partial;
    state = { ...state, ...(update as Record<string, unknown>) };
  }) as Parameters<typeof createLifetimeStatsSlice>[0];
  const slice = createLifetimeStatsSlice(set, get, {} as Parameters<typeof createLifetimeStatsSlice>[2]);
  state = { ...state, ...slice };
  return { state: () => state, slice };
}

describe("lifetimeStatsSlice — initial state", () => {
  it("starts with zero lifetimeGold and lifetimeInspiration", () => {
    const h = createHarness();
    expect((h.state().lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(0);
    expect((h.state().lifetimeInspiration as ReturnType<typeof big>).toNumber()).toBe(0);
  });
});

describe("lifetimeStatsSlice — trackInspirationGain (lifetimeInspiration accumulator)", () => {
  it("1000 inspi gain increments lifetimeInspiration by 1000", () => {
    const h = createHarness();
    h.slice.trackInspirationGain(big(1000));
    expect((h.state().lifetimeInspiration as ReturnType<typeof big>).toNumber()).toBe(1000);
  });

  it("two 500 gains accumulate to 1000", () => {
    const h = createHarness();
    h.slice.trackInspirationGain(big(500));
    h.slice.trackInspirationGain(big(500));
    expect((h.state().lifetimeInspiration as ReturnType<typeof big>).toNumber()).toBe(1000);
  });

  it("0 gain is a no-op", () => {
    const h = createHarness();
    h.slice.trackInspirationGain(big(0));
    expect((h.state().lifetimeInspiration as ReturnType<typeof big>).toNumber()).toBe(0);
  });

  it("does NOT touch lifetimeGold", () => {
    const h = createHarness();
    h.slice.trackInspirationGain(big(1234));
    expect((h.state().lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(0);
  });
});

describe("lifetimeStatsSlice — trackSaleGold (lifetimeGold accumulator)", () => {
  it("1000g sale increments lifetimeGold by 1000", () => {
    const h = createHarness();
    h.slice.trackSaleGold(big(1000));
    expect((h.state().lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(1000);
  });

  it("999g sale increments lifetimeGold by 999", () => {
    const h = createHarness();
    h.slice.trackSaleGold(big(999));
    expect((h.state().lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(999);
  });

  it("two 500g sales accumulate lifetimeGold correctly", () => {
    const h = createHarness();
    h.slice.trackSaleGold(big(500));
    expect((h.state().lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(500);
    h.slice.trackSaleGold(big(500));
    expect((h.state().lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(1000);
  });

  it("0g sale is a no-op for lifetimeGold", () => {
    const h = createHarness();
    h.slice.trackSaleGold(big(0));
    expect((h.state().lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(0);
  });

  it("large sale increments lifetimeGold correctly", () => {
    const h = createHarness();
    h.slice._setLifetimeGold(big(1_000_000));
    h.slice.trackSaleGold(big(1_000_000));
    expect((h.state().lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(2_000_000);
  });
});

describe("lifetimeStatsSlice — test helpers", () => {
  it("_setLifetimeGold overwrites lifetimeGold", () => {
    const h = createHarness();
    h.slice._setLifetimeGold(big(67890));
    expect((h.state().lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(67890);
  });

  it("_setLifetimeInspiration overwrites lifetimeInspiration", () => {
    const h = createHarness();
    h.slice._setLifetimeInspiration(big(42));
    expect((h.state().lifetimeInspiration as ReturnType<typeof big>).toNumber()).toBe(42);
  });
});
