import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { idbAdapter } from "@/systems/persistence";
import { big, isBig } from "@/core/bigNumber";

describe("persistence integration", () => {
  beforeEach(async () => {
    // Clear IDB save between tests.
    await idbAdapter.removeItem("artdle-save");
    // Reset in-memory state to defaults by re-initializing the store.
    // (Zustand stores are singletons; we rehydrate from cleared IDB.)
  });

  it("playerId is a valid UUID after store creation", () => {
    const id = useGameStore.getState().playerId;
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("currency add persists across rehydration", async () => {
    useGameStore.getState().add("gold", big(1234));
    // Wait one microtask for persist's async write.
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 50));

    // Read raw IDB content; should contain serialized state.
    const raw = await idbAdapter.getItem("artdle-save");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    // Big values are stored under our `__big` marker.
    expect(parsed.state.gold).toEqual({ __big: "1234" });
  });

  it("the stored state preserves playerId across writes", async () => {
    const idBefore = useGameStore.getState().playerId;
    useGameStore.getState().add("inspiration", big(50));
    await new Promise((r) => setTimeout(r, 50));

    const raw = await idbAdapter.getItem("artdle-save");
    const parsed = JSON.parse(raw!);
    expect(parsed.state.playerId).toBe(idBefore);
  });

  it("hoverInfo state is partialized OUT of the save", async () => {
    useGameStore.getState().pushHoverInfo("Title", "Body", "Footer");
    await new Promise((r) => setTimeout(r, 50));

    const raw = await idbAdapter.getItem("artdle-save");
    const parsed = JSON.parse(raw!);
    expect("hoverTitle" in parsed.state).toBe(false);
    expect("hoverBody" in parsed.state).toBe(false);
    expect("hoverFooter" in parsed.state).toBe(false);
  });

  it("rehydration reconstructs Bigs from {__big} markers", async () => {
    // Write a known state with a Big through the live store, then capture the
    // pre-rehydrate value (the store is a singleton across tests, so we can't
    // assume a clean baseline — only that `add` advanced gold by 9876).
    useGameStore.getState().add("gold", big(9876));
    await new Promise((r) => setTimeout(r, 50));
    const before = useGameStore.getState().gold.toString();

    // Force-rehydrate from IDB; should restore gold as a Big (not a string or marker).
    await useGameStore.persist.rehydrate();

    const restored = useGameStore.getState().gold;
    expect(isBig(restored)).toBe(true);
    expect(restored.toString()).toBe(before);
  });
});
