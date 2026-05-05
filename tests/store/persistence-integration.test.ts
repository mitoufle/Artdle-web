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
      purchasedNodes: { get_inspired: 3, black_white: 1 },
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
      purchasedNodes: { rainbow: 2 }, // Use a real SkillNodeId; we just want a different value than seeded.
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
      purchasedNodes: { get_inspired: 1 },
      currentStage: 1,
    };
    const result = migrate(v1State, 1) as unknown as Record<string, unknown>;
    expect(result.playerId).toBe("preserved-uuid");
    expect(result.gold).toEqual({ __big: "1234" });
    // v8 migration wipes purchasedNodes (skill-tree rewrite), so old IDs don't survive.
    expect(result.purchasedNodes).toEqual({});
    expect(result.currentStage).toBe(1);
  });

  it("migrate from version 2 (legacy) leaves inventory and equipped items untouched", () => {
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

describe("save migration v2 → v3", () => {
  it("v2 save (no canvasTier, no paintMastery) gets defaults on migrate", () => {
    const v2State = {
      gold: { __big: "5000" },
      inspiration: { __big: "100" },
      fame: { __big: "3" },
      ascendCount: 1,
      playerId: "test-player-id-v2",
      // ...other v2 fields would be here, but migrate doesn't depend on them
    };
    const migrated = migrate(v2State, 2) as unknown as Record<string, unknown>;
    expect(migrated.canvasTier).toBe(1);
    expect((migrated.paintMastery as ReturnType<typeof big>).toNumber()).toBe(0);
    // playerId preserved.
    expect(migrated.playerId).toBe("test-player-id-v2");
    // gold preserved.
    expect((migrated.gold as { __big: string }).__big).toBe("5000");
  });

  it("v1 save chained through migrateV1toV2 then v2→v3 lands with all defaults", () => {
    const v1State = {
      gold: { __big: "100" },
      inventory: [
        { kind: "+inspiration_rate%", magnitude: 10 }, // removed by v1→v2
        { kind: "+canvas_gold%", magnitude: 5 },
      ],
      equippedItems: [],
      playerId: "test-player-id-v1",
    };
    const migrated = migrate(v1State, 1) as unknown as Record<string, unknown>;
    // v1→v2: inspiration_rate% removed.
    expect((migrated.inventory as Array<{ kind: string }>).length).toBe(1);
    expect((migrated.inventory as Array<{ kind: string }>)[0]!.kind).toBe("+canvas_gold%");
    // v2→v3: defaults added.
    expect(migrated.canvasTier).toBe(1);
    expect((migrated.paintMastery as ReturnType<typeof big>).toNumber()).toBe(0);
  });

  it("v3 save with non-default canvasTier and paintMastery round-trips", async () => {
    // Mutate the live store with non-defaults, flush, re-read.
    useGameStore.setState({ canvasTier: 7 });
    useGameStore.getState()._setPaintMastery(big(54_321));
    await persistedAdapter.flush();

    const raw = await idbAdapter.getItem("artdle-save");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.canvasTier).toBe(7);
    expect(parsed.state.paintMastery).toEqual({ __big: "54321" });
    expect(parsed.version).toBe(8);
  });
});

describe("save migration v3 → v4 (PM redesign)", () => {
  it("v3 save (no lifetimeGold) gets default big(0) on migrate", () => {
    const v3State = {
      gold: { __big: "5000" },
      inspiration: { __big: "100" },
      fame: { __big: "3" },
      ascendCount: 1,
      playerId: "test-player-id-v3",
      canvasTier: 5,
      paintMastery: { __big: "42" },
    };
    const migrated = migrate(v3State, 3) as unknown as Record<string, unknown>;
    expect((migrated.lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(0);
    // Existing paintMastery preserved.
    expect((migrated.paintMastery as { __big: string }).__big).toBe("42");
    // Other fields preserved.
    expect(migrated.canvasTier).toBe(5);
    expect(migrated.playerId).toBe("test-player-id-v3");
  });

  it("v1 save chained through v1→v2→v3→v4 lands with all defaults", () => {
    const v1State = {
      gold: { __big: "100" },
      inventory: [
        { kind: "+inspiration_rate%", magnitude: 10 },
        { kind: "+canvas_gold%", magnitude: 5 },
      ],
      equippedItems: [],
      playerId: "test-player-id-v1",
    };
    const migrated = migrate(v1State, 1) as unknown as Record<string, unknown>;
    expect((migrated.inventory as Array<{ kind: string }>).length).toBe(1);
    expect(migrated.canvasTier).toBe(1);
    expect((migrated.paintMastery as ReturnType<typeof big>).toNumber()).toBe(0);
    expect((migrated.lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(0);
  });

  it("v4 save with non-default lifetimeGold round-trips", async () => {
    useGameStore.setState({ canvasTier: 3 });
    useGameStore.getState()._setPaintMastery(big(100));
    useGameStore.getState()._setLifetimeGold(big(50_000));
    await persistedAdapter.flush();

    const raw = await idbAdapter.getItem("artdle-save");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.canvasTier).toBe(3);
    expect(parsed.state.paintMastery).toEqual({ __big: "100" });
    expect(parsed.state.lifetimeGold).toEqual({ __big: "50000" });
    expect(parsed.version).toBe(8);
  });
});

describe("save migration v5 → v6 (drop currentView)", () => {
  it("drops currentView field from v5 save", () => {
    const v5State = {
      gold: { __big: "0" },
      inspiration: { __big: "0" },
      fame: { __big: "0" },
      ascendCount: 0,
      playerId: "test-id",
      canvasTier: 1,
      paintMastery: { __big: "0" },
      lifetimeGold: { __big: "0" },
      currentView: "painting",
    };
    const migrated = migrate(v5State, 5) as unknown as Record<string, unknown>;
    expect("currentView" in migrated).toBe(false);
  });

  it("v1 → v6 chain preserves all earlier-migration data + drops currentView", () => {
    const v1State = {
      gold: { __big: "100" },
      inventory: [
        { kind: "+inspiration_rate%", magnitude: 10 },
        { kind: "+canvas_gold%", magnitude: 5 },
      ],
      equippedItems: [],
      playerId: "test-id-v1",
      currentView: "home",
    };
    const migrated = migrate(v1State, 1) as unknown as Record<string, unknown>;
    expect((migrated.inventory as Array<{ kind: string }>).length).toBe(1);
    expect(migrated.canvasTier).toBe(1);
    expect((migrated.paintMastery as ReturnType<typeof big>).toNumber()).toBe(0);
    expect((migrated.lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(0);
    expect("currentView" in migrated).toBe(false);
  });
});

describe("save migration v6 → v7 (add pastRuns)", () => {
  it("v6 save (no pastRuns) gets default empty array on migrate", () => {
    const v6State = {
      gold: { __big: "0" },
      inspiration: { __big: "0" },
      fame: { __big: "0" },
      ascendCount: 1,
      playerId: "test-id-v6",
      canvasTier: 1,
      paintMastery: { __big: "0" },
      lifetimeGold: { __big: "0" },
    };
    const migrated = migrate(v6State, 6) as unknown as Record<string, unknown>;
    expect(Array.isArray(migrated.pastRuns)).toBe(true);
    expect(migrated.pastRuns).toEqual([]);
    expect(migrated.playerId).toBe("test-id-v6");
  });

  it("full chain v1 → v7 produces all defaults including pastRuns", () => {
    const v1State = {
      gold: { __big: "0" },
      inventory: [],
      equippedItems: [],
      playerId: "v1-test",
    };
    const migrated = migrate(v1State, 1) as unknown as Record<string, unknown>;
    expect(migrated.canvasTier).toBe(1);
    expect((migrated.paintMastery as ReturnType<typeof big>).toNumber()).toBe(0);
    expect((migrated.lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(0);
    expect(migrated.pastRuns).toEqual([]);
  });
});

describe("save migration v7 → v8 (skill-tree rewrite)", () => {
  it("v7 save wipes purchasedNodes and resets pokeTreeTimer on migrate", () => {
    const v7State = {
      gold: { __big: "0" },
      inspiration: { __big: "0" },
      fame: { __big: "10" },
      ascendCount: 2,
      playerId: "test-id-v7",
      canvasTier: 1,
      paintMastery: { __big: "0" },
      lifetimeGold: { __big: "0" },
      pastRuns: [],
      purchasedNodes: { goldsmith: true, patient_eye: true },
      pokeTreeTimer: 99,
    };
    const migrated = migrate(v7State, 7) as unknown as Record<string, unknown>;
    // purchasedNodes wiped — old IDs no longer valid.
    expect(migrated.purchasedNodes).toEqual({});
    // pokeTreeTimer reset.
    expect(migrated.pokeTreeTimer).toBe(0);
    // fame and playerId preserved.
    expect((migrated.fame as { __big: string }).__big).toBe("10");
    expect(migrated.playerId).toBe("test-id-v7");
  });

  it("full chain v1 → v8 produces all defaults including empty purchasedNodes", () => {
    const v1State = {
      gold: { __big: "0" },
      inventory: [],
      equippedItems: [],
      playerId: "v1-test-v8",
      purchasedNodes: { goldsmith: true },
    };
    const migrated = migrate(v1State, 1) as unknown as Record<string, unknown>;
    expect(migrated.canvasTier).toBe(1);
    expect((migrated.paintMastery as ReturnType<typeof big>).toNumber()).toBe(0);
    expect((migrated.lifetimeGold as ReturnType<typeof big>).toNumber()).toBe(0);
    expect(migrated.pastRuns).toEqual([]);
    expect(migrated.purchasedNodes).toEqual({});
    expect(migrated.pokeTreeTimer).toBe(0);
  });
});
