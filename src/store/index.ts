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
import { TREE_STAGES } from "@/config/treeStages";
import { WORKER_NAME_POOL } from "@/config/workerNames";
import { aggregateAffixes, type Affix } from "@/core/workshopRoll";

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

export const SAVE_VERSION = 30;
const SAVE_KEY = "artdle-save";

/**
 * Save schema migration chain. Each `if (fromVersion < N)` block migrates
 * from version N-1 to version N. Always merge into existing state — never
 * replace whole — so playerId and other invariants survive.
 *
 * PRE-v23 HISTORY COLLAPSED. Versions 1→22 spanned the unreleased-game era and
 * every one of them was rendered moot by the v22→v23 full wipe below: any save
 * at `fromVersion < 23` hits the unconditional `return {}` first, so no earlier
 * transform could ever survive to be observed. Those ~250 lines of per-version
 * transforms were dead code (they only ran on saves about to be discarded) and
 * were removed on 2026-06-02. The per-version changelog lives in git history if
 * you need it. The live migration path is v23 → v30 only.
 *
 * v22 → v23 (2026-05-24): crit per-chunk rework. Full wipe per spec — and the
 * floor for every older save (see above).
 *
 * v23 → v24 (2026-05-26): canvas chunk-domain rework. `canvasProgress`
 * semantics change from seconds → chunks (safe-reset to 0). Drop `sizeLevel`
 * field. Strip `+size%` from equipped items, inventory, and worker affixes.
 * Refund fame for the three removed size-related skill nodes (size_matters,
 * big_picture, expanding_horizon) and delete them from `purchasedNodes`.
 *
 * v26 → v27 (2026-05-29): Painter's Office autonomous-painter redesign (A2).
 * The old worker schema (class/tier/affixes) and the Office Level / queue /
 * trickle fields are removed. Drop officeLevel, officeXp, queue, and
 * trickleTimer from persisted state, and reset roster to []. Fresh level-1
 * workers respawn via reconcileRoster() for each currently-unlocked
 * roster_slot. Worker XP/level and skill-node refunds are handled in Phase C.
 *
 * v27 → v28 (2026-05-29): Office redesign Phase C — the old office skill
 * sub-tree (worker classes, queue, hire-cost, affix-magnitude) is gone. Delete
 * the 5 now-dead nodes (education, free_will, recruiter, bookkeeper,
 * gold_diggers) and refund their fame at the pre-deletion per-level costs.
 * Surviving office nodes (entrepreneur/hire_manager/accelerator) are reparented
 * in config; parent edges aren't persisted, so nothing to migrate there.
 *
 * Exported for unit testing in `tests/store/persistence-integration.test.ts`.
 */
export const migrate = (persisted: unknown, fromVersion: number): GameStore => {
  let state = persisted as Record<string, unknown>;

  if (fromVersion < 23) {
    // v22 → v23 (2026-05-24): crit per-chunk rework, full wipe per spec. This
    // also subsumes every pre-v23 migration (game was unreleased through v22),
    // so all older saves reset here and zustand merge fills from defaults.
    return {} as unknown as GameStore;
  }

  if (fromVersion < 24) {
    // v23 → v24 (2026-05-26): canvas chunk-domain rework.
    //   1. `canvasProgress` semantics changed (seconds → chunks). Safe-reset to 0.
    //   2. Drop `sizeLevel` from persisted state (no longer in CanvasState).
    //   3. Strip `+size%` affixes from equipped items + inventory (Task 8 removed
    //      the affix kind from the runtime pool; dead affixes on existing gear
    //      would otherwise contribute no effect but linger in saves).
    //   4. Strip `+size%` from worker affixes in the roster (Task 9 dropped it
    //      from the worker affix pool).
    //   5. Refund fame for the three removed size-related skill nodes
    //      (size_matters, big_picture, expanding_horizon — Task 9) so players
    //      can re-spend on surviving nodes. Costs hard-coded here from the
    //      pre-deletion config (the runtime config no longer holds them).
    const stripSize = (affixes: unknown): unknown[] =>
      Array.isArray(affixes)
        ? affixes.filter(
            (a) =>
              a !== null &&
              typeof a === "object" &&
              (a as { kind?: unknown }).kind !== "+size%",
          )
        : [];

    // Build the chunk-domain patch in a new object so the migration step
    // mirrors the immutable style used by earlier steps.
    const next: Record<string, unknown> = { ...state };
    next.canvasProgress = 0;
    delete next.sizeLevel;

    const equipped = next.equipped as Record<string, unknown> | undefined;
    if (equipped && typeof equipped === "object") {
      const cleaned: Record<string, unknown> = {};
      for (const [slot, item] of Object.entries(equipped)) {
        if (item && typeof item === "object") {
          cleaned[slot] = {
            ...(item as object),
            affixes: stripSize((item as { affixes?: unknown }).affixes),
          };
        } else {
          cleaned[slot] = item;
        }
      }
      next.equipped = cleaned;
    }

    if (Array.isArray(next.inventory)) {
      next.inventory = (next.inventory as unknown[]).map((item) =>
        item && typeof item === "object"
          ? { ...(item as object), affixes: stripSize((item as { affixes?: unknown }).affixes) }
          : item,
      );
    }

    if (Array.isArray(next.roster)) {
      next.roster = (next.roster as unknown[]).map((worker) =>
        worker && typeof worker === "object"
          ? {
              ...(worker as object),
              affixes: stripSize((worker as { affixes?: unknown }).affixes),
            }
          : worker,
      );
    }

    // Per-level costs of the three removed size-related skill nodes, captured
    // from src/config/skillTreeDesign.json prior to deletion in b729b84.
    // refund(level N) = sum of REMOVED_NODE_COSTS[id][0..N-1].
    const REMOVED_NODE_COSTS: Record<string, ReadonlyArray<number>> = {
      size_matters: [10],
      big_picture: [20, 35, 60, 100, 160],
      expanding_horizon: [50, 90, 150, 250, 400],
    };
    const purchasedNodes = next.purchasedNodes as Record<string, number> | undefined;
    if (purchasedNodes && typeof purchasedNodes === "object") {
      let refund = 0;
      const cleanedNodes: Record<string, number> = { ...purchasedNodes };
      for (const [nodeId, costs] of Object.entries(REMOVED_NODE_COSTS)) {
        const level = cleanedNodes[nodeId] ?? 0;
        if (level > 0) {
          for (let i = 0; i < Math.min(level, costs.length); i++) {
            refund += costs[i]!;
          }
          delete cleanedNodes[nodeId];
        }
      }
      next.purchasedNodes = cleanedNodes;
      if (refund > 0) {
        // `fame` arrives as a Big (reviver wraps `{ __big: "..." }` markers
        // back to Decimal before migrate runs). Tests that pass `big(...)`
        // hit the same `isBig` branch. Defensive fallback for missing/non-Big.
        const currentFame = next.fame;
        const baseFame = isBig(currentFame) ? currentFame : big(0);
        next.fame = baseFame.add(refund);
      }
    }

    state = next;
  }

  if (fromVersion < 25) {
    // v24 → v25 (2026-05-27): sticky top-bar unlocks for Ascension + Constellation.
    // Existing players who have ever ascended (ascendCount > 0) get both unlocks
    // immediately. Players currently sitting on enough inspiration to ascend
    // (or enough fame to spend) also start unlocked — the lock should never
    // appear for someone whose state already justifies the unlock.
    const next = state as Record<string, unknown>;
    const ascendCount = typeof next.ascendCount === "number" ? next.ascendCount : 0;
    const fame = isBig(next.fame) ? next.fame : big(0);
    const inspiration = isBig(next.inspiration) ? next.inspiration : big(0);
    // canAscend is true when fameOnAscend(inspiration, threshold-reduction) >= 1.
    // Migration doesn't have access to purchasedNodes-derived threshold reductions
    // in a clean way here (the typed selectors live in multipliers.ts and operate
    // on a GameStore-shaped argument). Approximate: if inspiration crosses the
    // base 10,000 threshold OR ascendCount > 0, unlock ascension.
    const hasInspiThreshold = inspiration.gte(10_000);
    next.unlockedAscension = ascendCount > 0 || hasInspiThreshold || next.unlockedAscension === true;
    next.unlockedConstellation = ascendCount > 0 || fame.gte(1) || next.unlockedConstellation === true;
    state = next;
  }

  if (fromVersion < 26) {
    // v25 → v26 (2026-05-29): inspiration tree reworked to 10 single-upgrade tiers
    // (IDs u1..u10) with inspi/sec unlock + back-loaded milestones. Old part IDs have
    // no equivalent; the tree resets every ascend, so wipe + reseed is correct.
    const wiped: Record<string, number> = {};
    for (const stage of TREE_STAGES) for (const part of stage.parts) wiped[part.id] = 0;
    state = { ...state, currentStage: 0, partLevels: wiped };
  }

  if (fromVersion < 27) {
    // v26 → v27 (2026-05-29): Painter's Office autonomous-painter redesign (A2).
    // The old worker schema (class/tier/affixes) + Office Level/queue/trickle are
    // gone. Drop every old office field and reset the roster to empty;
    // reconcileRoster() (run post-hydration and after buyNode) spawns fresh
    // level-1 workers for each currently-unlocked roster_slot. Worker XP/level
    // and skill-node refunds are handled in Phase C.
    const {
      officeLevel: _ol, officeXp: _ox, queue: _q, trickleTimer: _tt, ...rest
    } = state;
    void _ol; void _ox; void _q; void _tt;
    state = { ...rest, roster: [] };
  }

  if (fromVersion < 28) {
    // v27 → v28 (2026-05-29): Office redesign Phase C — the old office skill
    // sub-tree (worker classes, queue, hire-cost, affix-magnitude) is gone.
    // Delete the 5 now-dead nodes and refund their fame at the pre-deletion
    // per-level costs. Surviving office nodes (entrepreneur/hire_manager/
    // accelerator → roster_slot + worker_xp_mult) are reparented in config, and
    // unlock_school is reparented onto accelerator (parent edges aren't
    // persisted, so nothing to migrate there).
    const REMOVED_NODE_COSTS: Record<string, ReadonlyArray<number>> = {
      education: [1200, 2000, 3000, 4500, 6500],
      free_will: [3500],
      recruiter: [7000, 8500, 10000],
      bookkeeper: [7000, 8000, 9000, 10000],
      gold_diggers: [10000],
    };
    const purchasedNodes = (state as Record<string, unknown>).purchasedNodes as Record<string, number> | undefined;
    if (purchasedNodes && typeof purchasedNodes === "object") {
      let refund = 0;
      const cleaned: Record<string, number> = { ...purchasedNodes };
      for (const [nodeId, costs] of Object.entries(REMOVED_NODE_COSTS)) {
        const level = cleaned[nodeId] ?? 0;
        if (level > 0) {
          for (let i = 0; i < Math.min(level, costs.length); i++) refund += costs[i]!;
          delete cleaned[nodeId];
        }
      }
      const next: Record<string, unknown> = { ...state, purchasedNodes: cleaned };
      if (refund > 0) {
        const currentFame = next.fame;
        const baseFame = isBig(currentFame) ? currentFame : big(0);
        next.fame = baseFame.add(refund);
      }
      state = next as Record<string, unknown>;
    }
  }

  if (fromVersion < 29) {
    // v28 → v29 (2026-05-30): workers gain a persistent cosmetic name + avatar.
    // Backfill only missing fields (idempotent for partially-migrated saves).
    const roster = Array.isArray(state.roster) ? state.roster : [];
    state = {
      ...state,
      roster: roster.map((entry) => {
        const w = entry as Record<string, unknown>;
        return {
          ...w,
          name: typeof w.name === "string"
            ? w.name
            : WORKER_NAME_POOL[Math.floor(Math.random() * WORKER_NAME_POOL.length)],
          avatar: typeof w.avatar === "number" ? w.avatar : 1 + Math.floor(Math.random() * 4),
        };
      }),
    };
  }

  if (fromVersion < 30) {
    // v29 → v30 (2026-05-31): items show one aggregated value per affix kind,
    // and crit/combo are capped at one affix each. Collapse legacy items'
    // duplicate-kind affixes (sum sell/speed; keep the largest single crit/combo).
    const isAffix = (v: unknown): v is Affix =>
      typeof v === "object" && v !== null && "kind" in v && "magnitude" in v;
    const fixItem = (item: unknown): unknown => {
      if (typeof item !== "object" || item === null) return item;
      const it = item as Record<string, unknown>;
      if (!Array.isArray(it.affixes)) return item;
      return { ...it, affixes: aggregateAffixes(it.affixes.filter(isAffix)) };
    };
    const inventory = Array.isArray(state.inventory) ? state.inventory.map(fixItem) : state.inventory;
    const equippedIn = (state.equipped ?? {}) as Record<string, unknown>;
    const equipped: Record<string, unknown> = {};
    for (const [slot, item] of Object.entries(equippedIn)) {
      equipped[slot] = item == null ? item : fixItem(item);
    }
    state = { ...state, inventory, equipped };
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
          painterClocks: _pc,
          lastAscendRoll: _lar,
          devFreeNodes: _dfn,
          museBurstTimer: _mbt,
          collaborativeStrokeAcc: _csa,
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
