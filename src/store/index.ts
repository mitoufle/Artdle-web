import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { persistedAdapter } from "@/systems/persistence";
import { createMetaSlice, type MetaSlice } from "./metaSlice";
import { createCurrencySlice, type CurrencySlice } from "./currencySlice";
import { createHoverInfoSlice, type HoverInfoSlice } from "./hoverInfoSlice";
import { createTreeSlice, type TreeSlice } from "./treeSlice";
import { createCanvasSlice, type CanvasSlice } from "./canvasSlice";
import { createLifetimeStatsSlice, type LifetimeStatsSlice } from "./lifetimeStatsSlice";
import { createSkillTreeSlice, type SkillTreeSlice } from "./skillTreeSlice";
import { createWorkshopSlice, type WorkshopSlice } from "./workshopSlice";
import { createOfficeSlice, type OfficeSlice } from "./officeSlice";
import { createSchoolSlice, type SchoolSlice } from "./schoolSlice";
import { createStatsSlice, type StatsSlice } from "./statsSlice";
import { createAchievementSlice, type AchievementSlice } from "./achievementSlice";
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
  & OfficeSlice
  & LifetimeStatsSlice
  & SkillTreeSlice
  & WorkshopSlice
  & SchoolSlice
  & StatsSlice
  & AchievementSlice
  & GameTick;

const SAVE_VERSION = 21;
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
 * v10 → v11 (2026-05-10): affix pool rework. AffixKind enum renamed
 * (+canvas_gold% → +sell_price%, -paint_time% → +speed%) and 3 new kinds
 * added (+crit_chance%, +combo_chance%, +size_gold_per_level%). Magnitude
 * semantics for the rename don't translate cleanly (-10% paint_time ≠
 * +10% speed). Game unreleased — wipe inventory + equipped. Workshop
 * level + XP preserved (long-tail meta progression).
 *
 * v11 → v12 (2026-05-10): rename +size_gold_per_level% → +size% and change
 * behavior (now affects both gold AND time, matching size-track semantics).
 * Magnitudes from the old kind don't translate cleanly. Game unreleased —
 * wipe inventory + equipped. Workshop level + XP preserved.
 *
 * v12 → v13 (2026-05-11): Painter's Office launch. Adds officeLevel, officeXp,
 * queue, roster, trickleTimer. No data to migrate from older saves (the
 * system didn't exist).
 *
 * v13 → v14 (2026-05-12): Inspiration tree rewrite — 6 stages with new
 * part IDs. Wipe currentStage + partLevels; all other slices preserved.
 *
 * v14 → v15 (2026-05-14): Add fuseCount field to Item. Backfill fuseCount: 0
 * on every item in inventory and equipped.
 *
 * v15 → v16 (2026-05-14): Add protectedTiers. Existing saves get empty object.
 *
 * v18 → v19 (2026-05-20): Add lifetimeInspiration (Big, default 0) on
 * paintMasterySlice for `lifetime.inspirationgain` achievement conditions.
 *
 * v19 → v20 (2026-05-22): offline progress — add `lastSeen` timestamp to
 * metaSlice. Existing saves get Date.now() so the first load post-update
 * has `elapsed = 0` (no false catch-up against the deploy timestamp).
 *
 * v20 → v21 (2026-05-23): Paint Mastery removed entirely. Drop persisted
 * `paintMastery` field; the slice no longer holds it.
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

  if (fromVersion < 11) {
    // v10 → v11 (2026-05-10): affix pool rework. AffixKind enum renamed
    // (+canvas_gold% → +sell_price%, -paint_time% → +speed%) and 3 new kinds
    // added (+crit_chance%, +combo_chance%, +size_gold_per_level%). Magnitude
    // semantics for the rename don't translate cleanly (-10% paint_time ≠
    // +10% speed). Game unreleased — wipe inventory + equipped. Workshop
    // level + XP preserved (long-tail meta progression).
    state = {
      ...state,
      inventory: [],
      equipped: {},
    };
  }

  if (fromVersion < 12) {
    // v11 → v12 (2026-05-10): rename +size_gold_per_level% → +size% and change
    // behavior (now also affects time). Magnitudes don't translate cleanly.
    // Wipe inventory + equipped; preserve workshopLevel + workshopXp.
    state = { ...state, inventory: [], equipped: {} };
  }

  if (fromVersion < 13) {
    // v12 → v13 (2026-05-11): Painter's Office. Adds officeLevel, officeXp,
    // queue, roster, trickleTimer. No data to migrate from older saves
    // (the system didn't exist).
    state = {
      ...state,
      officeLevel: 0,
      officeXp: big(0),
      queue: [],
      roster: [],
      trickleTimer: 0,
    };
  }

  if (fromVersion < 14) {
    // v13 → v14 (2026-05-12): inspiration tree rewrite — 6 stages with new
    // part IDs (cotyledon, tendril, ..., stalk). Old part IDs have no
    // mechanical equivalent; mapping them would produce misleading state.
    // Wipe currentStage + partLevels only; all other slices preserved.
    // See docs/superpowers/specs/2026-05-12-inspiration-tree-expansion-design.md.
    // One row per stage (1/2/2/3/3/4 parts).
    const TREE_PART_IDS = [
      "cotyledon",                                           // stage 0 Tiny Sprout
      "tendril", "budtip",                                   // stage 1 Bud
      "vein", "leaftip",                                     // stage 2 Leaflet
      "twig", "branch", "leaf",                              // stage 3 Sapling
      "softbough", "quietleaf", "faintvein",                 // stage 4 Whisperleaf
      "greenshoot", "lushbough", "vividleaf", "stalk",       // stage 5 Verdant Shoot
    ];
    const wipedPartLevels: Record<string, number> = {};
    for (const id of TREE_PART_IDS) wipedPartLevels[id] = 0;
    state = {
      ...state,
      currentStage: 0,
      partLevels: wipedPartLevels,
    };
  }

  if (fromVersion < 15) {
    // v14 → v15 (2026-05-14): add fuseCount field to Item. Backfill fuseCount: 0
    // on every item in inventory and equipped.
    const addFuseCount = (item: unknown): unknown => {
      if (item && typeof item === "object") {
        return { fuseCount: 0, ...(item as object) };
      }
      return item;
    };
    if (Array.isArray(state.inventory)) {
      state = { ...state, inventory: (state.inventory as unknown[]).map(addFuseCount) };
    }
    const equipped = state.equipped as Record<string, unknown> | undefined;
    if (equipped && typeof equipped === "object") {
      const fixedEquipped: Record<string, unknown> = {};
      for (const [slot, item] of Object.entries(equipped)) {
        fixedEquipped[slot] = addFuseCount(item);
      }
      state = { ...state, equipped: fixedEquipped };
    }
  }

  if (fromVersion < 16) {
    state = { ...state, protectedTiers: {} };
  }

  if (fromVersion < 17) {
    // v16 → v17 (2026-05-15): Painting School launch. Adds school progression
    // fields. All default to empty — school starts from scratch on first play.
    state = {
      ...state,
      completedResearches: {},
      currentTier: 1,
      activeResearch: null,
      examsPassed: {},
    };
  }

  if (fromVersion < 18) {
    // v17 → v18 (2026-05-17): Achievement system. Add statsLifetime, statsRun,
    // completedAchievements. All default to empty — no retroactive stat credit.
    state = {
      ...state,
      statsLifetime: {
        canvasesSold: 0, critsLanded: 0, maxComboChain: 0,
        workshopItemsCrafted: 0, workshopItemsFused: 0,
        schoolResearchesCompleted: 0, schoolTiersPassed: 0, officeWorkersHired: 0,
      },
      statsRun: {
        canvasesSold: 0, critsLanded: 0, currentCritStreak: 0, maxCritStreak: 0,
        maxComboChain: 0, goldEarned: big(0), workshopItemsCrafted: 0,
        schoolResearchesCompleted: 0,
      },
      completedAchievements: {},
    };
  }

  if (fromVersion < 19) {
    // v18 → v19 (2026-05-20): Add lifetimeInspiration (Big) tracker on
    // paintMasterySlice, mirroring lifetimeGold. Used by achievement
    // conditions targeting `lifetime.inspirationgain`. No retroactive credit
    // — existing saves start at 0, matching the v3→v4 lifetimeGold pattern.
    state = {
      ...state,
      lifetimeInspiration: big(0),
    };
  }

  if (fromVersion < 20) {
    // v19 → v20 (2026-05-22): offline progress — add lastSeen timestamp on
    // metaSlice. Seed with Date.now() so the first load post-update sees
    // `elapsed = 0` (no false catch-up against the deploy timestamp).
    state = {
      ...state,
      lastSeen: Date.now(),
    };
  }

  if (fromVersion < 21) {
    // v20 → v21 (2026-05-23): Paint Mastery removed entirely. Drop the
    // persisted `paintMastery` field from save state; the slice no longer
    // declares it, so leaving it in the persisted blob would be dead weight.
    const { paintMastery: _pm, ...rest } = state;
    void _pm;
    state = rest;
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

// Module-level heartbeat accumulator. Updates `meta.lastSeen` every
// HEARTBEAT_INTERVAL_S seconds of simulated game time. Reset between tests
// via `_resetHeartbeat()`.
let _heartbeatAccum = 0;
const HEARTBEAT_INTERVAL_S = 10;

/** Test helper: reset the module-level heartbeat accumulator. */
export function _resetHeartbeat(): void {
  _heartbeatAccum = 0;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get, store) => ({
      ...createMetaSlice(set, get, store),
      ...createCurrencySlice(set, get, store),
      ...createHoverInfoSlice(set, get, store),
      ...createTreeSlice(set, get, store),
      ...createCanvasSlice(set, get, store),
      ...createLifetimeStatsSlice(set, get, store),
      ...createSkillTreeSlice(set, get, store),
      ...createWorkshopSlice(set, get, store),
      ...createOfficeSlice(set, get, store),
      ...createSchoolSlice(set, get, store),
      ...createStatsSlice(set, get, store),
      ...createAchievementSlice(set, get, store),
      tickAll: (deltaSeconds: number) => {
        const s = get();
        s.treeTick(deltaSeconds);
        s.canvasTick(deltaSeconds);
        s.skillTreeTick(deltaSeconds);
        s.workshopTick(deltaSeconds);
        s.tickOffice(deltaSeconds);
        s.schoolTick(deltaSeconds);
        // Heartbeat: bound lastSeen staleness to 10s of simulated play.
        // Skip on idle frames (delta=0) to avoid spurious set() calls.
        if (deltaSeconds > 0) {
          _heartbeatAccum += deltaSeconds;
          if (_heartbeatAccum >= HEARTBEAT_INTERVAL_S) {
            _heartbeatAccum = 0;
            set({ lastSeen: Date.now() });
          }
        }
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
          devFreeNodes: _dfn,
          activeNotification: _an,
          notificationQueue: _nq,
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
