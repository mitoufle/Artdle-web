import { describe, it, expect, beforeEach } from "vitest";
import { create } from "zustand";
import { createHoverInfoSlice, type HoverInfoSlice } from "@/store/hoverInfoSlice";

const useTestStore = () => create<HoverInfoSlice>()((...a) => createHoverInfoSlice(...a));

describe("hoverInfoSlice", () => {
  let store: ReturnType<typeof useTestStore>;
  beforeEach(() => {
    store = useTestStore();
  });

  it("initializes with empty strings", () => {
    const s = store.getState();
    expect(s.hoverTitle).toBe("");
    expect(s.hoverBody).toBe("");
    expect(s.hoverFooter).toBe("");
  });

  it("pushHoverInfo sets all three fields", () => {
    store.getState().pushHoverInfo("Gold", "currency from canvas", "10g/sale");
    const s = store.getState();
    expect(s.hoverTitle).toBe("Gold");
    expect(s.hoverBody).toBe("currency from canvas");
    expect(s.hoverFooter).toBe("10g/sale");
  });

  it("pushHoverInfo overwrites previous content", () => {
    store.getState().pushHoverInfo("A", "a", "1");
    store.getState().pushHoverInfo("B", "b", "2");
    const s = store.getState();
    expect(s.hoverTitle).toBe("B");
    expect(s.hoverBody).toBe("b");
    expect(s.hoverFooter).toBe("2");
  });

  it("clearHoverInfo resets all fields to empty", () => {
    store.getState().pushHoverInfo("X", "y", "z");
    store.getState().clearHoverInfo();
    const s = store.getState();
    expect(s.hoverTitle).toBe("");
    expect(s.hoverBody).toBe("");
    expect(s.hoverFooter).toBe("");
  });

  it("accepts ReactNode for body and footer (not just strings)", () => {
    // Type-only check — if this compiles, the API accepts ReactNode.
    store.getState().pushHoverInfo("T", null, undefined);
    expect(store.getState().hoverTitle).toBe("T");
  });
});
