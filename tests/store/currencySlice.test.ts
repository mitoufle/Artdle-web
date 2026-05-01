import { describe, it, expect, beforeEach } from "vitest";
import { create } from "zustand";
import { createCurrencySlice, type CurrencySlice } from "@/store/currencySlice";
import { big } from "@/core/bigNumber";

const useTestStore = () => create<CurrencySlice>()((...a) => createCurrencySlice(...a));

describe("currencySlice", () => {
  let store: ReturnType<typeof useTestStore>;
  beforeEach(() => {
    store = useTestStore();
  });

  it("initializes all currencies to 0", () => {
    const s = store.getState();
    expect(s.gold.toNumber()).toBe(0);
    expect(s.inspiration.toNumber()).toBe(0);
    expect(s.fame.toNumber()).toBe(0);
  });

  it("add increases the named currency", () => {
    store.getState().add("gold", big(100));
    expect(store.getState().gold.toNumber()).toBe(100);
    store.getState().add("gold", big(50));
    expect(store.getState().gold.toNumber()).toBe(150);
  });

  it("add ignores negative amounts (no underflow)", () => {
    store.getState().add("gold", big(100));
    store.getState().add("gold", big(-50));
    expect(store.getState().gold.toNumber()).toBe(100);
  });

  it("spend deducts and returns true on success", () => {
    store.getState().add("gold", big(100));
    expect(store.getState().spend("gold", big(40))).toBe(true);
    expect(store.getState().gold.toNumber()).toBe(60);
  });

  it("spend returns false and does NOT deduct on insufficient balance", () => {
    store.getState().add("gold", big(30));
    expect(store.getState().spend("gold", big(100))).toBe(false);
    expect(store.getState().gold.toNumber()).toBe(30);
  });

  it("spend at exactly the available balance succeeds", () => {
    store.getState().add("gold", big(50));
    expect(store.getState().spend("gold", big(50))).toBe(true);
    expect(store.getState().gold.toNumber()).toBe(0);
  });

  it("resetRunCurrencies zeroes gold + inspiration but preserves fame", () => {
    const s = store.getState();
    s.add("gold", big(100));
    s.add("inspiration", big(500));
    s.add("fame", big(7));
    s.resetRunCurrencies();
    const after = store.getState();
    expect(after.gold.toNumber()).toBe(0);
    expect(after.inspiration.toNumber()).toBe(0);
    expect(after.fame.toNumber()).toBe(7);
  });

  it("currencies are independent", () => {
    store.getState().add("gold", big(100));
    expect(store.getState().inspiration.toNumber()).toBe(0);
    expect(store.getState().fame.toNumber()).toBe(0);
  });
});
