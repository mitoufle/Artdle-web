import { describe, it, expect, beforeEach } from "vitest";
import { create } from "zustand";
import { createMetaSlice, type MetaSlice } from "@/store/metaSlice";
import { isPlayerId } from "@/core/playerId";

const useTestStore = () => create<MetaSlice>()((...a) => createMetaSlice(...a));

describe("metaSlice", () => {
  let store: ReturnType<typeof useTestStore>;
  beforeEach(() => {
    store = useTestStore();
  });

  it("initializes with a valid UUID v4 playerId", () => {
    expect(isPlayerId(store.getState().playerId)).toBe(true);
  });

  it("initializes ascendCount to 0", () => {
    expect(store.getState().ascendCount).toBe(0);
  });

  it("incrementAscendCount bumps the count by 1", () => {
    store.getState().incrementAscendCount();
    expect(store.getState().ascendCount).toBe(1);
    store.getState().incrementAscendCount();
    expect(store.getState().ascendCount).toBe(2);
  });

  it("two store instances have different playerIds", () => {
    const store2 = useTestStore();
    expect(store.getState().playerId).not.toBe(store2.getState().playerId);
  });

  it("_setPlayerId overwrites the id", () => {
    store.getState()._setPlayerId("c70ba8c4-7be9-4f57-a87a-2f6b1a0a3c7e");
    expect(store.getState().playerId).toBe("c70ba8c4-7be9-4f57-a87a-2f6b1a0a3c7e");
  });
});
