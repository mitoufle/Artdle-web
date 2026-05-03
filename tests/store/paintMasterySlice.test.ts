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
  // store argument is unused by the slice
  const slice = createPaintMasterySlice(set, get, {} as Parameters<typeof createPaintMasterySlice>[2]);
  // Mutate state to include slice's actions (since Zustand normally does this)
  state = { ...state, ...slice };
  return { state: () => state, slice };
}

describe("paintMasterySlice — initial state", () => {
  it("initial paintMastery is big(0)", () => {
    const h = createHarness();
    expect((h.state().paintMastery as ReturnType<typeof big>).toNumber()).toBe(0);
  });
});

describe("paintMasterySlice — gainFromSale", () => {
  it("tier 1 adds 1 PM", () => {
    const h = createHarness();
    h.slice.gainFromSale(1);
    expect((h.state().paintMastery as ReturnType<typeof big>).toNumber()).toBe(1);
  });

  it("tier 10 adds 100 PM", () => {
    const h = createHarness();
    h.slice.gainFromSale(10);
    expect((h.state().paintMastery as ReturnType<typeof big>).toNumber()).toBe(100);
  });

  it("repeated gainFromSale accumulates additively", () => {
    const h = createHarness();
    h.slice.gainFromSale(5); // +25
    h.slice.gainFromSale(5); // +25
    h.slice.gainFromSale(10); // +100
    expect((h.state().paintMastery as ReturnType<typeof big>).toNumber()).toBe(150);
  });
});

describe("paintMasterySlice — _setPaintMastery (test helper)", () => {
  it("overwrites paintMastery to the given value", () => {
    const h = createHarness();
    h.slice._setPaintMastery(big(12345));
    expect((h.state().paintMastery as ReturnType<typeof big>).toNumber()).toBe(12345);
  });
});
