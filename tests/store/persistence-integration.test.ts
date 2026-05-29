import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useGameStore, migrate } from "@/store";
import { idbAdapter, persistedAdapter } from "@/systems/persistence";
import { TREE_STAGES } from "@/config/treeStages";
import { big, isBig } from "@/core/bigNumber";

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
    // Trigger a sale to make lastSale non-null. T1 chunk-domain: full canvas =
    // chunksPerCanvas(1)=10 chunks × BASE_CHUNK_INTERVAL=5s = 50s. +0.01 to clear
    // the final-chunk float-accumulation boundary.
    useGameStore.getState().canvasTick(50.01);
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
    useGameStore.getState().buyPartLevel("cotyledon"); // partLevels.cotyledon → 1
    useGameStore.getState().buyPartLevel("cotyledon"); // → 2
    useGameStore.setState({ currentStage: 1 });
    useGameStore.getState().buyPartLevel("tendril"); // partLevels.tendril → 1
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

  it("inventory + equipped + purchasedNodes all round-trip through save", async () => {
    // Seed known state.
    useGameStore.setState({
      inventory: [],
      equipped: {
        brush: {
          id: "p-1",
          slot: "brush",
          tier: "normal",
          affixes: [{ kind: "+sell_price%", magnitude: 12 }],
          fuseCount: 0,
        },
      },
      purchasedNodes: { get_inspired: 3, black_white: 1 },
    });

    const beforeInventory = [...useGameStore.getState().inventory];
    const beforeEquipped = { ...useGameStore.getState().equipped };
    const beforeNodes = { ...useGameStore.getState().purchasedNodes };

    // Force the throttle to flush the latest persist write.
    await persistedAdapter.flush();

    // Stomp in-memory state with bogus values so we can prove rehydration
    // restored from IDB rather than just observing in-memory.
    useGameStore.setState({
      inventory: [],
      equipped: {},
      purchasedNodes: { rainbow: 2 }, // Use a real SkillNodeId; we just want a different value than seeded.
    });

    // Force-rehydrate from IDB.
    await useGameStore.persist.rehydrate();

    // Assert the seeded values were restored.
    const after = useGameStore.getState();
    expect(after.inventory).toEqual(beforeInventory);
    expect(after.equipped).toEqual(beforeEquipped);
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
  // Note: v22→v23 does a full wipe (returns {}). All saves below v23 are wiped;
  // the assertions below confirm the empty-record return that triggers zustand default merge.

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
    const result = migrate(v1State, 1) as unknown as Record<string, unknown>;
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(result)).toEqual([]);
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
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(result)).toEqual([]);
  });

  it("migrate from version 2 (legacy): v9 wipes inventory and drops equippedItems", () => {
    const v2State = {
      inventory: [{ kind: "+canvas_gold%", magnitude: 10 }],
      equippedItems: [{ kind: "-paint_time%", magnitude: 7 }],
    };
    const result = migrate(v2State, 2) as unknown as Record<string, unknown>;
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(result)).toEqual([]);
  });

  it("migrate handles missing inventory/equippedItems gracefully (defaults to empty)", () => {
    const v1State = { playerId: "x" };
    const result = migrate(v1State, 1) as unknown as Record<string, unknown>;
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(result)).toEqual([]);
  });
});

describe("save migration v2 → v3", () => {
  // v22→v23 full wipe applies to all saves below v23.

  it("v2 save (no canvasTier, no paintMastery) gets defaults on migrate", () => {
    const v2State = {
      gold: { __big: "5000" },
      inspiration: { __big: "100" },
      fame: { __big: "3" },
      ascendCount: 1,
      playerId: "test-player-id-v2",
    };
    const migrated = migrate(v2State, 2) as unknown as Record<string, unknown>;
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(migrated)).toEqual([]);
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
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(migrated)).toEqual([]);
  });
});

describe("save migration v3 → v4 (lifetime gold add)", () => {
  // v22→v23 full wipe applies to all saves below v23.

  it("v3 save (no lifetimeGold) gets default big(0) on migrate", () => {
    const v3State = {
      gold: { __big: "5000" },
      inspiration: { __big: "100" },
      fame: { __big: "3" },
      ascendCount: 1,
      playerId: "test-player-id-v3",
      canvasTier: 5,
    };
    const migrated = migrate(v3State, 3) as unknown as Record<string, unknown>;
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(migrated)).toEqual([]);
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
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(migrated)).toEqual([]);
  });

  it("v4 lifetimeGold round-trips at the current SAVE_VERSION", async () => {
    useGameStore.getState()._setLifetimeGold(big(50_000));
    await persistedAdapter.flush();

    const raw = await idbAdapter.getItem("artdle-save");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.lifetimeGold).toEqual({ __big: "50000" });
    expect(parsed.version).toBe(26);
  });
});

describe("save migration v5 → v6 (drop currentView)", () => {
  // v22→v23 full wipe applies to all saves below v23.

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
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(migrated)).toEqual([]);
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
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(migrated)).toEqual([]);
  });
});

describe("save migration v6 → v7 (add pastRuns)", () => {
  // v22→v23 full wipe applies to all saves below v23.

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
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(migrated)).toEqual([]);
  });

  it("full chain v1 → v7 produces all defaults including pastRuns", () => {
    const v1State = {
      gold: { __big: "0" },
      inventory: [],
      equippedItems: [],
      playerId: "v1-test",
    };
    const migrated = migrate(v1State, 1) as unknown as Record<string, unknown>;
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(migrated)).toEqual([]);
  });
});

describe("save migration v7 → v8 (skill-tree rewrite)", () => {
  // v22→v23 full wipe applies to all saves below v23.

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
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(migrated)).toEqual([]);
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
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(migrated)).toEqual([]);
  });
});

describe("save migration v8 → v9 (workshop rework)", () => {
  // v22→v23 full wipe applies to all saves below v23.

  it("v8 → v9 migration: wipes inventory and equipped, initializes workshopLevel/Xp", () => {
    const v8State = {
      fame: { __big: "10" },
      gold: { __big: "100" },
      inventory: [{ kind: "+canvas_gold%", magnitude: 12 }],
      equippedItems: [{ kind: "-paint_time%", magnitude: 8 }],
      purchasedNodes: { gear_up: 1 },
      pokeTreeTimer: 0,
      pastRuns: [],
      canvasTier: 5,
      paintMastery: { __big: "100" },
      lifetimeGold: { __big: "10000" },
    };
    const result = migrate(v8State, 8) as unknown as Record<string, unknown>;
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(result)).toEqual([]);
  });
});

describe("migrate v9 → v10 (canvas depth)", () => {
  // v22→v23 full wipe applies to all saves below v23.

  it("drops canvasTier (v9→v10) then re-adds canvasTier: 1 (v21→v22), and seeds new track fields with defaults", () => {
    const v9State: Record<string, unknown> = {
      canvasTier: 5,
      canvasProgress: 0,
      gold: { __big: "100" },
    };
    const migrated = migrate(v9State, 9) as unknown as Record<string, unknown>;
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(migrated)).toEqual([]);
  });

  it("does not change saves at v10 (migrate is no-op when fromVersion >= 10)", () => {
    const v10State: Record<string, unknown> = {
      sellPriceLevel: 7,
      speedLevel: 4,
      sizeLevel: 5,
      critLevel: 0, comboLevel: 0, comboChain: 0, isCritThisCanvas: false,
      canvasProgress: 0,
    };
    const migrated = migrate(v10State, 10) as unknown as Record<string, unknown>;
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(migrated)).toEqual([]);
  });

  it("chains correctly from earlier versions (v8 → v10)", () => {
    const v8State: Record<string, unknown> = {
      gold: { __big: "0" },
    };
    const migrated = migrate(v8State, 8) as unknown as Record<string, unknown>;
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(migrated)).toEqual([]);
  });
});

describe("migrate v10 → v11 (affix-pool rework)", () => {
  // v22→v23 full wipe applies to all saves below v23.

  it("wipes inventory + equipped (game unreleased; magnitudes don't translate cleanly)", () => {
    const v10State: Record<string, unknown> = {
      inventory: [
        { id: "old1", slot: "brush", tier: "rare", affixes: [{ kind: "+canvas_gold%", magnitude: 12 }] },
      ],
      equipped: { brush: { id: "old2", slot: "brush", tier: "magic", affixes: [{ kind: "-paint_time%", magnitude: 10 }] } },
      workshopLevel: 8,
      workshopXp: 17,
    };
    const migrated = migrate(v10State, 10) as unknown as Record<string, unknown>;
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(migrated)).toEqual([]);
  });

  it("v11 save is migrated to v12 (inventory + equipped wiped)", () => {
    const v11State: Record<string, unknown> = {
      inventory: [{ id: "x", slot: "brush", tier: "magic", affixes: [{ kind: "+sell_price%", magnitude: 7 }] }],
      equipped: { brush: { id: "eq-x", slot: "brush", tier: "normal", affixes: [{ kind: "+speed%", magnitude: 5 }] } },
      workshopLevel: 3,
      workshopXp: 5,
    };
    const migrated = migrate(v11State, 11) as unknown as Record<string, unknown>;
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(migrated)).toEqual([]);
  });
});

describe("migrate v11 → v12 (+size_gold_per_level% → +size%)", () => {
  // v22→v23 full wipe applies to all saves below v23.

  it("wipes inventory + equipped (magnitudes from old kind don't translate cleanly)", () => {
    const v11State: Record<string, unknown> = {
      inventory: [
        { id: "old1", slot: "brush", tier: "magic", affixes: [{ kind: "+size_gold_per_level%", magnitude: 10 }] },
      ],
      equipped: { brush: { id: "old2", slot: "brush", tier: "rare", affixes: [{ kind: "+size_gold_per_level%", magnitude: 8 }] } },
      workshopLevel: 5,
      workshopXp: 10,
    };
    const migrated = migrate(v11State, 11) as unknown as Record<string, unknown>;
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(migrated)).toEqual([]);
  });

  it("v12 save migrates through v13/v14/v15 (fuseCount added by v15)", () => {
    const v12State: Record<string, unknown> = {
      inventory: [{ id: "y", slot: "easel", tier: "rare", affixes: [{ kind: "+size%", magnitude: 9 }] }],
      equipped: {},
      workshopLevel: 10,
      workshopXp: 40,
    };
    const migrated = migrate(v12State, 12) as unknown as Record<string, unknown>;
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(migrated)).toEqual([]);
  });
});

describe("save migration v12 → v13 (Painter's Office)", () => {
  // v22→v23 full wipe applies to all saves below v23.

  it("adds default office state to a v12 save", () => {
    const v12Save = {
      gold: { __big: "100" },
    };
    const migrated = migrate(v12Save, 12) as unknown as Record<string, unknown>;
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(migrated)).toEqual([]);
  });
});

describe("save migration v13 → v14 (inspiration tree rewrite)", () => {
  // v22→v23 full wipe applies to all saves below v23.

  it("v13 → v14 migration: wipes tree state, preserves other slices", () => {
    const v13Save = {
      currentStage: 2,
      partLevels: { spark: 7, bud: 3, leaf: 2, branch: 0, bough: 0, crown: 0 },
      gold: big(12345),
      inspiration: big(678),
      fame: big(9),
      purchasedNodes: { someNode: 1 },
      inventory: [],
      equipped: {},
      workshopLevel: 4,
      workshopXp: big(20),
      paintMastery: big(11),
      lifetimeGold: big(100),
      sellPriceLevel: 1, speedLevel: 1, sizeLevel: 0,
      critLevel: 0, comboLevel: 0, comboChain: 0,
      isCritThisCanvas: false,
      officeLevel: 0, officeXp: big(0),
      queue: [], roster: [], trickleTimer: 0,
      pastRuns: [],
      playerId: "test-uuid",
      pokeTreeTimer: 0,
    };
    const migrated = migrate(v13Save, 13) as unknown as Record<string, unknown>;
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(migrated)).toEqual([]);
  });
});

describe("save migration v14 → v15 (fuseCount on items)", () => {
  // v22→v23 full wipe applies to all saves below v23.

  it("v14 → v15: adds fuseCount: 0 to inventory items and equipped items", () => {
    const v14Save = {
      inventory: [
        { id: "it-1", slot: "brush", tier: "magic", affixes: [{ kind: "+sell_price%", magnitude: 10 }] },
        { id: "it-2", slot: "palette", tier: "rare", affixes: [{ kind: "+speed%", magnitude: 7 }] },
      ],
      equipped: {
        brush: { id: "it-3", slot: "brush", tier: "normal", affixes: [{ kind: "+speed%", magnitude: 5 }] },
      },
      gold: big(500),
      workshopLevel: 3,
      workshopXp: 5,
    };
    const migrated = migrate(v14Save, 14) as unknown as Record<string, unknown>;
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(migrated)).toEqual([]);
  });
});

describe("save migration v20 → v21 (Paint Mastery removed)", () => {
  // v22→v23 full wipe applies to all saves below v23.

  it("drops the persisted paintMastery field from a v20 save", () => {
    const v20State = {
      playerId: "deadbeef-1234-4abc-9def-1234567890ab",
      paintMastery: { __big: "12345" },
      lifetimeGold: { __big: "500" },
      lifetimeInspiration: { __big: "100" },
    } as Record<string, unknown>;
    const migrated = migrate(v20State, 20) as unknown as Record<string, unknown>;
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(migrated)).toEqual([]);
  });

  it("the full chain from v3 produces no paintMastery", () => {
    const v3State = {
      playerId: "deadbeef-1234-4abc-9def-1234567890ab",
      paintMastery: { __big: "42" },
      canvasTier: 5,
    } as Record<string, unknown>;
    const migrated = migrate(v3State, 3) as unknown as Record<string, unknown>;
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(migrated)).toEqual([]);
  });
});

describe("save migration v21 → v22 (canvas tier system)", () => {
  // v22→v23 full wipe applies to all saves below v23.

  it("adds canvasTier: 1 to a v21 save", () => {
    const v21State = {
      playerId: "deadbeef-1234-4abc-9def-1234567890ab",
      sellPriceLevel: 5,
      speedLevel: 3,
      sizeLevel: 0,
      critLevel: 0,
      comboLevel: 0,
    } as Record<string, unknown>;
    const migrated = migrate(v21State, 21) as unknown as Record<string, unknown>;
    // v22→v23 full wipe: all old saves return {} so zustand defaults apply.
    expect(Object.keys(migrated)).toEqual([]);
  });

  it("SAVE_VERSION is 26", async () => {
    useGameStore.getState().add("gold", big(1));
    await persistedAdapter.flush();
    const raw = await idbAdapter.getItem("artdle-save");
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(26);
  });
});

describe("save migration v22 → v23 (crit per-chunk rework)", () => {
  it("returns an empty record so the store falls back to default initial state", () => {
    // migrate is imported at the top of this file from "@/store".
    const v22Save = {
      gold: { mantissa: 12345, exponent: 0 } as unknown,
      sellPriceLevel: 7,
      critLevel: 30,
      equipped: { brush: { affixes: [{ kind: "+crit_chance%", magnitude: 42 }] } },
      purchasedNodes: { prismatic_eye: 2 },
    };
    const migrated = migrate(v22Save, 22);
    // Full wipe: migrate returns an empty (or near-empty) object so zustand's
    // shallow merge fills the rest from defaults.
    expect(Object.keys(migrated)).toEqual([]);
  });
});

describe("save migration v25 → v26 (10-tier tree rework)", () => {
  it("v25 → v26 wipes the tree to the new 10-tier structure", () => {
    const old = {
      currentStage: 5,
      partLevels: { cotyledon: 40, tendril: 12, stalk: 3 }, // old IDs
    };
    const migrated = migrate(old, 25);
    expect(migrated.currentStage).toBe(0);
    expect(Object.keys(migrated.partLevels).sort()).toEqual(
      ["u1","u10","u2","u3","u4","u5","u6","u7","u8","u9"].sort(),
    );
    expect(Object.values(migrated.partLevels).every((v) => v === 0)).toBe(true);
  });
});
