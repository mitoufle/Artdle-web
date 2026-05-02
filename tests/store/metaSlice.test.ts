import { describe, it, expect, beforeEach } from "vitest";
import { create } from "zustand";
import { createMetaSlice, type MetaSlice } from "@/store/metaSlice";
import { isPlayerId } from "@/core/playerId";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

import type { StateCreator } from "zustand";
// Cast needed because createMetaSlice is typed against GameStore (full store),
// but the isolated unit-test store only provides MetaSlice — the isolated
// tests never call performAscend so the cast is safe for these 5 tests.
const isolatedFactory = createMetaSlice as unknown as StateCreator<MetaSlice, [], [], MetaSlice>;
const useTestStore = () => create<MetaSlice>()((...a) => isolatedFactory(...a));

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

describe("metaSlice — performAscend wrapper", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetWorkshop();
    useGameStore.setState({ purchasedNodes: {}, ascendCount: 0 });
  });

  it("performAscend() returns false when canAscend is false; no state changes", () => {
    expect(useGameStore.getState().performAscend()).toBe(false);
    expect(useGameStore.getState().ascendCount).toBe(0);
  });

  it("performAscend() returns true and increments ascendCount when canAscend is true", () => {
    useGameStore.getState().add("inspiration", big(1500));
    const beforeCount = useGameStore.getState().ascendCount;
    expect(useGameStore.getState().performAscend()).toBe(true);
    expect(useGameStore.getState().ascendCount).toBe(beforeCount + 1);
  });
});
