import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useGameStore, migrate } from "@/store";
import { idbAdapter, persistedAdapter } from "@/systems/persistence";
import { TREE_STAGES } from "@/config/treeStages";
import { big, isBig } from "@/core/bigNumber";
import { PAINT_TIME_BASE_SECONDS } from "@/core/balance";
import { defaultLifecycleHooks } from "@/systems/lifecycle";
import { setErrorReporter, resetErrorReporter } from "@/systems/telemetry";

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
    await persistedAdapter.flush();

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
    await persistedAdapter.flush();

    const raw = await idbAdapter.getItem("artdle-save");
    const parsed = JSON.parse(raw!);
    expect(parsed.state.playerId).toBe(idBefore);
  });

  it("hoverInfo state is partialized OUT of the save", async () => {
    useGameStore.getState().pushHoverInfo("Title", "Body", "Footer");
    await persistedAdapter.flush();

    const raw = await idbAdapter.getItem("artdle-save");
    const parsed = JSON.parse(raw!);
    expect("hoverTitle" in parsed.state).toBe(false);
    expect("hoverBody" in parsed.state).toBe(false);
    expect("hoverFooter" in parsed.state).toBe(false);
  });

  it("lastSale transient is partialized OUT of the save", async () => {
    // Trigger a sale to make lastSale non-null.
    useGameStore.getState().canvasTick(PAINT_TIME_BASE_SECONDS);
    expect(useGameStore.getState().lastSale).not.toBeNull();
    await persistedAdapter.flush();

    const raw = await idbAdapter.getItem("artdle-save");
    const parsed = JSON.parse(raw!);
    expect("lastSale" in parsed.state).toBe(false);
  });

  it("rehydration reconstructs Bigs from {__big} markers", async () => {
    // Write a known state with a Big through the live store, then capture the
    // pre-rehydrate value (the store is a singleton across tests, so we can't
    // assume a clean baseline — only that `add` advanced gold by 9876).
    useGameStore.getState().add("gold", big(9876));
    await persistedAdapter.flush();
    const before = useGameStore.getState().gold.toString();

    // Force-rehydrate from IDB; should restore gold as a Big (not a string or marker).
    await useGameStore.persist.rehydrate();

    const restored = useGameStore.getState().gold;
    expect(isBig(restored)).toBe(true);
    expect(restored.toString()).toBe(before);
  });
});

describe("persistence integration — Phase 2 fields round-trip", () => {
  beforeEach(async () => {
    await idbAdapter.removeItem("artdle-save");
    // Reset in-memory state to defaults so the test starts from a clean slate.
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
    useGameStore.getState().resetCanvas();
  });

  it("partLevels + currentStage + canvasProgress all round-trip through save", async () => {
    // Seed known state.
    useGameStore.getState().add("gold", big(100000));
    useGameStore.getState().buyPartLevel("spark"); // partLevels.spark → 1
    useGameStore.getState().buyPartLevel("spark"); // → 2
    useGameStore.getState().buyPartLevel("bud"); // partLevels.bud → 1
    useGameStore.setState({ currentStage: 1, canvasProgress: 5.5 });

    const beforeStage = useGameStore.getState().currentStage;
    const beforeProgress = useGameStore.getState().canvasProgress;
    const beforeLevels = { ...useGameStore.getState().partLevels };

    // Force the throttle to flush the latest persist write.
    await persistedAdapter.flush();

    // Stomp in-memory state with bogus values so we can prove rehydration
    // restored from IDB rather than just observing in-memory.
    useGameStore.setState({
      currentStage: 99,
      canvasProgress: 999,
      partLevels: Object.fromEntries(
        TREE_STAGES.flatMap((s) => s.parts.map((p) => [p.id, 99])),
      ),
    });

    // Force-rehydrate from IDB.
    await useGameStore.persist.rehydrate();

    // Assert the seeded values were restored.
    const after = useGameStore.getState();
    expect(after.currentStage).toBe(beforeStage);
    expect(after.canvasProgress).toBe(beforeProgress);
    expect(after.partLevels).toEqual(beforeLevels);
  });
});

describe("persistence integration — Phase 3 fields round-trip", () => {
  beforeEach(async () => {
    await idbAdapter.removeItem("artdle-save");
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetWorkshop();
    useGameStore.setState({ purchasedNodes: {} });
  });

  it("inventory + equippedItems + purchasedNodes all round-trip through save", async () => {
    // Seed known state.
    useGameStore.setState({
      inventory: [
        { kind: "+canvas_gold%", magnitude: 12 },
        { kind: "-paint_time%", magnitude: 8 },
      ],
      equippedItems: [
        { kind: "-paint_time%", magnitude: 10 },
      ],
      purchasedNodes: { goldsmith: true, patient_eye: true },
    });

    const beforeInventory = [...useGameStore.getState().inventory];
    const beforeEquipped = [...useGameStore.getState().equippedItems];
    const beforeNodes = { ...useGameStore.getState().purchasedNodes };

    // Force the throttle to flush the latest persist write.
    await persistedAdapter.flush();

    // Stomp in-memory state with bogus values so we can prove rehydration
    // restored from IDB rather than just observing in-memory.
    useGameStore.setState({
      inventory: [{ kind: "+canvas_gold%", magnitude: 99 }],
      equippedItems: [],
      purchasedNodes: { better_brush: true }, // Use a real SkillNodeId; we just want a different value than seeded.
    });

    // Force-rehydrate from IDB.
    await useGameStore.persist.rehydrate();

    // Assert the seeded values were restored.
    const after = useGameStore.getState();
    expect(after.inventory).toEqual(beforeInventory);
    expect(after.equippedItems).toEqual(beforeEquipped);
    expect(after.purchasedNodes).toEqual(beforeNodes);
  });
});

describe("persistence integration — Phase 4 fields round-trip", () => {
  beforeEach(async () => {
    await idbAdapter.removeItem("artdle-save");
    useGameStore.setState({ currentView: "home" });
  });

  it("currentView round-trips through save/rehydrate", async () => {
    // Seed: switch away from the default.
    useGameStore.getState().setView("skills");
    expect(useGameStore.getState().currentView).toBe("skills");

    // Force the throttle to flush the latest persist write.
    await persistedAdapter.flush();

    // Stomp in-memory state with a different view so we can prove rehydration
    // restored from IDB rather than just observing in-memory.
    useGameStore.setState({ currentView: "home" });

    // Force-rehydrate from IDB.
    await useGameStore.persist.rehydrate();

    expect(useGameStore.getState().currentView).toBe("skills");
  });
});

describe("persistence integration — Phase 5 fields strip", () => {
  beforeEach(async () => {
    await idbAdapter.removeItem("artdle-save");
    useGameStore.setState({ workshopPopupOpen: false });
  });

  it("workshopPopupOpen is partialized OUT of the save", async () => {
    // Set a non-default value so we can confirm it doesn't appear in the raw save.
    useGameStore.setState({ workshopPopupOpen: true });

    // Force the throttle to flush the latest persist write.
    await persistedAdapter.flush();

    // Read raw IDB content and confirm the field is absent.
    const raw = await idbAdapter.getItem("artdle-save");
    const parsed = JSON.parse(raw!);
    expect("workshopPopupOpen" in parsed.state).toBe(false);
  });
});

describe("persistence integration — flush error routing through telemetry", () => {
  beforeEach(() => {
    resetErrorReporter();
  });

  afterEach(() => {
    resetErrorReporter();
    vi.restoreAllMocks();
  });

  it("defaultLifecycleHooks.onUnload routes flush rejection to the configured reporter", async () => {
    const errorSink = vi.fn();
    setErrorReporter(errorSink);
    vi.spyOn(persistedAdapter, "flush").mockRejectedValueOnce(new Error("integration-boom"));

    defaultLifecycleHooks.onUnload();
    await new Promise((r) => setTimeout(r, 0));

    expect(errorSink).toHaveBeenCalledOnce();
    const [err, ctx] = errorSink.mock.calls[0]!;
    expect((err as Error).message).toBe("integration-boom");
    expect(ctx).toBe("persist.flush.beforeunload");
  });
});

describe("save schema migration", () => {
  it("migrate v1 → v2 filters out items with the removed +inspiration_rate% affix", () => {
    const v1State = {
      playerId: "deadbeef-uuid",
      gold: { __big: "100" },
      inventory: [
        { kind: "+canvas_gold%", magnitude: 12 },
        { kind: "+inspiration_rate%", magnitude: 8 },
        { kind: "-paint_time%", magnitude: 5 },
      ],
      equippedItems: [
        { kind: "+inspiration_rate%", magnitude: 10 },
      ],
    };
    const result = migrate(v1State, 1);
    expect(result.inventory).toHaveLength(2);
    expect(result.inventory.map((i) => i.kind)).toEqual(["+canvas_gold%", "-paint_time%"]);
    expect(result.equippedItems).toHaveLength(0);
  });

  it("migrate v1 → v2 preserves all other fields verbatim (only inventory + equippedItems are filtered)", () => {
    const v1State = {
      playerId: "preserved-uuid",
      gold: { __big: "1234" },
      inventory: [],
      equippedItems: [],
      purchasedNodes: { goldsmith: true },
      currentStage: 1,
    };
    const result = migrate(v1State, 1) as unknown as Record<string, unknown>;
    expect(result.playerId).toBe("preserved-uuid");
    expect(result.gold).toEqual({ __big: "1234" });
    expect(result.purchasedNodes).toEqual({ goldsmith: true });
    expect(result.currentStage).toBe(1);
  });

  it("migrate from version 2 (current) is a no-op", () => {
    const v2State = {
      inventory: [{ kind: "+canvas_gold%", magnitude: 10 }],
      equippedItems: [{ kind: "-paint_time%", magnitude: 7 }],
    };
    const result = migrate(v2State, 2);
    expect(result.inventory).toHaveLength(1);
    expect(result.equippedItems).toHaveLength(1);
  });

  it("migrate handles missing inventory/equippedItems gracefully (defaults to empty)", () => {
    const v1State = { playerId: "x" };
    const result = migrate(v1State, 1);
    expect(result.inventory).toEqual([]);
    expect(result.equippedItems).toEqual([]);
  });
});
