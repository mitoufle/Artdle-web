import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { persistedAdapter } from "@/systems/persistence";
import { createMetaSlice, type MetaSlice } from "./metaSlice";
import { createCurrencySlice, type CurrencySlice } from "./currencySlice";
import { createHoverInfoSlice, type HoverInfoSlice } from "./hoverInfoSlice";
import { createTreeSlice, type TreeSlice } from "./treeSlice";
import { createCanvasSlice, type CanvasSlice } from "./canvasSlice";
import { createPaintMasterySlice, type PaintMasterySlice } from "./paintMasterySlice";
import { createSkillTreeSlice, type SkillTreeSlice } from "./skillTreeSlice";
import { createWorkshopSlice, type WorkshopSlice } from "./workshopSlice";
import { big, isBig } from "@/core/bigNumber";

export interface GameTick {
  /**
   * Per-frame orchestrator. Calls `treeTick(delta)` first, then `canvasTick(delta)`.
   * Order is part of the API contract and pinned by tests; future phases that
   * depend on freshly-credited inspiration (none in Phase 2) require tree-first.
   * Idle frames (delta ≤ 0) are no-ops via each child's own early-return guard.
   */
  tickAll: (deltaSeconds: number) => void;
}

export type GameStore =
  & MetaSlice
  & CurrencySlice
  & HoverInfoSlice
  & TreeSlice
  & CanvasSlice
  & PaintMasterySlice
  & SkillTreeSlice
  & WorkshopSlice
  & GameTick;

const SAVE_VERSION = 10;
const SAVE_KEY = "artdle-save";

/**
 * Save schema migration chain. Each `if (fromVersion < N)` block migrates
 * from version N-1 to version N. Always merge into existing state — never
 * replace whole — so playerId and other invariants survive.
 *
 * v1 → v2 (2026-05-03): the `+inspiration_rate%` workshop affix was removed
 * (items are now painting-only by design). Filter out any items with that
 * kind from `inventory` and `equippedItems`.
 *
 * v2 → v3 (2026-05-03): v1.1 adds canvasTier (default 1) and paintMastery
 * (default big(0)). Existing v2 saves load with v1.0-equivalent defaults.
 *
 * v3 → v4 (2026-05-03): v1.1 PM redesign — adds lifetimeGold (default big(0)).
 * Existing paintMastery values preserved; gain rate slows going forward.
 *
 * v4 → v5 (2026-05-04): prep for v2.0 router — no schema change, version bump only.
 *
 * v5 → v6 (2026-05-04): viewSlice retired in favor of react-router-dom.
 * Drop the persisted currentView field so future loads don't carry it.
 *
 * v6 → v7 (2026-05-04): v2.0 Round 3 adds pastRuns ledger to metaSlice.
 * Existing saves get default pastRuns: [] so the AscensionRoute ledger starts empty.
 *
 * v7 → v8 (2026-05-05): skill-tree rewrite. Wipe purchasedNodes; reset
 * pokeTreeTimer.
 *
 * v8 → v9 (2026-05-06): workshop rework. Wipe inventory + equipped; initialize
 * workshopLevel=1, workshopXp=0.
 *
 * v9 → v10 (2026-05-10): canvas-depth rework. Drop canvasTier; seed sellPriceLevel=1,
 * speedLevel=1, sizeLevel=0, critLevel=0, comboLevel=0, comboChain=0,
 * isCritThisCanvas=false.
 *
 * Exported for unit testing in `tests/store/persistence-integration.test.ts`.
 */
export const migrate = (persisted: unknown, fromVersion: number): GameStore => {
  let state = persisted as Record<string, unknown>;

  if (fromVersion < 2) {
    const isItem = (v: unknown): v is { kind: string; magnitude: number } =>
      typeof v === "object" && v !== null && "kind" in v && "magnitude" in v;
    const filterRemovedAffix = (arr: unknown): unknown[] =>
      Array.isArray(arr) ? arr.filter((i) => isItem(i) && i.kind !== "+inspiration_rate%") : [];

    state = {
      ...state,
      inventory: filterRemovedAffix(state.inventory),
      equippedItems: filterRemovedAffix(state.equippedItems),
    };
  }

  if (fromVersion < 3) {
    state = {
      ...state,
      canvasTier: 1,
      paintMastery: big(0),
    };
  }

  if (fromVersion < 4) {
    // v3 → v4 (2026-05-03): PM redesign — gain is now gold-fraction (not tier²).
    // Existing paintMastery values are preserved; only the gain formula changes
    // going forward. lifetimeGold defaults to 0 (no retroactive credit).
    state = {
      ...state,
      lifetimeGold: big(0),
    };
  }

  if (fromVersion < 5) {
    // v4 → v5 (2026-05-04): prep for v2.0 router.
    // No schema change; version bump only to align with task numbering.
  }

  if (fromVersion < 6) {
    // v5 → v6 (2026-05-04): viewSlice retired in favor of react-router-dom.
    // Drop the persisted currentView field so future loads don't carry it.
    const { currentView: _cv, ...rest } = state;
    state = rest;
    void _cv;
  }

  if (fromVersion < 7) {
    // v6 → v7 (2026-05-04): v2.0 Round 3 adds pastRuns ledger to metaSlice.
    state = {
      ...state,
      pastRuns: [],
    };
  }

  if (fromVersion < 8) {
    // v7 → v8 (2026-05-05): full skill-tree rewrite from `skillTreeDesign.json`.
    // The v1.1 node IDs (goldsmith, patient_eye, second_slot, faster_strokes,
    // better_brush) no longer exist in the new tree. Wipe purchasedNodes;
    // existing fame is preserved so players can re-spend on the new tree.
    state = {
      ...state,
      purchasedNodes: {},
      pokeTreeTimer: 0,
    };
  }

  if (fromVersion < 9) {
    // v8 → v9 (2026-05-06): workshop rework. Items change shape (single-affix
    // → multi-affix). equippedItems array → equipped: Partial<Record<SlotKind, Item>>.
    // Game is unreleased; wipe inventory + equipped and initialize workshop level/xp.
    const { equippedItems: _ei, ...rest } = state;
    void _ei;
    state = {
      ...rest,
      inventory: [],
      equipped: {},
      workshopLevel: 1,
      workshopXp: 0,
    };
  }

  if (fromVersion < 10) {
    // v9 → v10 (2026-05-10): canvas-depth rework. Replace canvasTier with 5 track levels
    // (sellPriceLevel + speedLevel unlocked at 1; sizeLevel + critLevel + comboLevel
    // gated start at 0). Seed comboChain=0, isCritThisCanvas=false.
    // Game is unreleased; no need to translate canvasTier 1-10 onto the new tracks.
    const { canvasTier: _ct, ...rest } = state;
    void _ct;
    state = {
      ...rest,
      sellPriceLevel: 1,
      speedLevel: 1,
      sizeLevel: 0,
      critLevel: 0,
      comboLevel: 0,
      comboChain: 0,
      isCritThisCanvas: false,
    };
  }

  return state as unknown as GameStore;
};

/**
 * Big values (break_eternity.js Decimal) need custom serialisation.
 * `JSON.stringify` calls `Decimal.toJSON()` BEFORE invoking any replacer,
 * so a replacer-based approach can't see Decimals — they arrive as bare strings.
 * Instead, we walk the partialized state and pre-wrap Bigs as `{ __big: "..." }`
 * markers before `JSON.stringify` ever runs.
 */
type SerializedBig = { __big: string };
const isSerializedBig = (v: unknown): v is SerializedBig =>
  typeof v === "object" && v !== null && "__big" in v;

function serializeBigs(value: unknown): unknown {
  if (isBig(value)) return { __big: value.toString() };
  if (Array.isArray(value)) return value.map(serializeBigs);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value)) {
      out[k] = serializeBigs((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

const reviver = (_key: string, value: unknown): unknown => {
  if (isSerializedBig(value)) return big(value.__big);
  return value;
};

export const useGameStore = create<GameStore>()(
  persist(
    (set, get, store) => ({
      ...createMetaSlice(set, get, store),
      ...createCurrencySlice(set, get, store),
      ...createHoverInfoSlice(set, get, store),
      ...createTreeSlice(set, get, store),
      ...createCanvasSlice(set, get, store),
      ...createPaintMasterySlice(set, get, store),
      ...createSkillTreeSlice(set, get, store),
      ...createWorkshopSlice(set, get, store),
      tickAll: (deltaSeconds: number) => {
        const s = get();
        s.treeTick(deltaSeconds);
        s.canvasTick(deltaSeconds);
        s.skillTreeTick(deltaSeconds);
        s.workshopTick(deltaSeconds);
      },
    }),
    {
      name: SAVE_KEY,
      version: SAVE_VERSION,
      storage: createJSONStorage(() => persistedAdapter, { reviver }),
      migrate,
      partialize: (s) => {
        // Exclude transient hover-info + animation-trigger state, then pre-wrap Bigs as `{ __big: "..." }` markers.
        const {
          hoverTitle: _t,
          hoverBody: _b,
          hoverFooter: _f,
          lastSale: _ls,
          ...rest
        } = s;
        return serializeBigs(rest) as unknown as Omit<
          GameStore,
          "hoverTitle" | "hoverBody" | "hoverFooter" | "lastSale"
        >;
      },
    },
  ),
);
