import type { StateCreator } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { big, type Big } from "@/core/bigNumber";
import type { GameStore } from "@/store";
import { countCapability } from "@/store/skillTreeSlice";
import { createBaseStats, type WorkerStats } from "@/core/workerModel";
import { getWorkerXpPoolMultiplier } from "@/core/multipliers";
import { splitAscendPool, applyAscendXpToWorker } from "@/core/workerAscend";
import { WORKER_NAME_POOL } from "@/config/workerNames";

/**
 * A redesigned autonomous-painter worker. See
 * docs/superpowers/specs/2026-05-29-office-painter-redesign-design.md §2.1.
 *
 * Workers are persistent data: spawned at level 1 to fill unlocked roster
 * slots, they level up only at ascend (Phase C) and paint the shared canvas
 * (Phase B). In Phase A2 they exist but contribute nothing.
 */
export interface Worker {
  readonly id: string;
  /** Class = stat-roll bias profile (content deferred). "base" = neutral. */
  readonly classId: string;
  readonly level: number;
  /** Accumulated ascend-XP toward the next level (Big — pool scales with run gold). */
  readonly xp: Big;
  /** The five-stat sheet (gold%, speed, crit chance, strokes-per-crit, combo chance). */
  readonly stats: WorkerStats;
  /** Levels gained while assigned to the current class (forward hook; 0 in A2). */
  readonly mastery: number;
  /** Strokes this worker has landed in the current run (Phase B fills this; ascend resets it). */
  readonly strokesThisRun: number;
  /** Random painter name from WORKER_NAME_POOL — cosmetic, assigned at spawn. */
  readonly name: string;
  /** Avatar index 1..4 → worker_{n}.png — cosmetic, assigned at spawn. */
  readonly avatar: number;
}

/** Transient per-worker reveal data for the post-ascend roll screen (Phase D).
 *  A dumb before/after snapshot — the UI diffs it. Captured here because the
 *  level-up rolls consume global rng() and are unrecoverable afterward. */
export interface AscendRollEntry {
  readonly id: string;
  readonly levelBefore: number;
  readonly levelAfter: number;
  readonly statsBefore: WorkerStats;
  readonly statsAfter: WorkerStats;
}

export interface OfficeState {
  readonly roster: ReadonlyArray<Worker>;
  /** Most recent ascend's level-up reveal data (workers that gained ≥1 level).
   *  TRANSIENT — stripped from `partialize`, cleared on dismiss. null = nothing to show. */
  readonly lastAscendRoll: ReadonlyArray<AscendRollEntry> | null;
}

export const initialOfficeState: OfficeState = Object.freeze({
  roster: Object.freeze([]) as ReadonlyArray<Worker>,
  lastAscendRoll: null,
}) as OfficeState;

export interface OfficeSlice extends OfficeState {
  /**
   * Spawn fresh level-1 workers until the roster fills every unlocked slot.
   * Spawn-only (never despawns — caps only grow). Idempotent. Call after a
   * roster_slot purchase and once post-rehydration.
   */
  reconcileRoster: () => void;
  /**
   * Ascend XP pass: pool = `poolMagnitude × getWorkerXpPoolMultiplier`, split
   * across the roster (baseline floor + strokes-weighted), converted to
   * level-ups (each rolls applyStatLevelUp), captures `lastAscendRoll`, and
   * resets every worker's `strokesThisRun`. No-op (clears the roll) on an empty
   * roster. `applyAscendXp(big(0))` = "reset run contribution" with no XP.
   */
  applyAscendXp: (poolMagnitude: Big) => void;
  /** Clear the post-ascend roll (Phase D dismiss hook). */
  clearAscendRoll: () => void;
}

/** Max number of workers — sum of fame-node levels carrying the `roster_slot` tag. */
export const getRosterCap = (state: Pick<GameStore, "purchasedNodes">): number =>
  countCapability(state, "roster_slot");

/** Cosmetic-only randomness (name/avatar). Deliberately NOT the seeded gameplay
 *  rng — picking these must never perturb the canvas/catch-up RNG stream. */
const randomName = (): string =>
  WORKER_NAME_POOL[Math.floor(Math.random() * WORKER_NAME_POOL.length)]!;
const randomAvatar = (): number => 1 + Math.floor(Math.random() * 4);

/** Factory: a fresh level-1 worker of the given class (default neutral "base"). */
export const createWorker = (classId = "base"): Worker => ({
  id: uuidv4(),
  classId,
  level: 1,
  xp: big(0),
  stats: createBaseStats(),
  mastery: 0,
  strokesThisRun: 0,
  name: randomName(),
  avatar: randomAvatar(),
});

export const createOfficeSlice: StateCreator<GameStore, [], [], OfficeSlice> = (set, get) => ({
  ...initialOfficeState,

  reconcileRoster: () => {
    const state = get();
    const cap = getRosterCap(state);
    const missing = cap - state.roster.length;
    if (missing <= 0) return;
    const spawned: Worker[] = [];
    for (let i = 0; i < missing; i++) spawned.push(createWorker());
    set({ roster: [...state.roster, ...spawned] });
  },

  applyAscendXp: (poolMagnitude) => {
    const state = get();
    if (state.roster.length === 0) {
      set({ lastAscendRoll: null });
      return;
    }
    // Zero pool = "reset run contribution" only (subsumes resetOffice): no XP
    // pass, so banked XP is left untouched. applyAscendXpToWorker always drains
    // banked XP into levels, so we must short-circuit before it runs.
    if (poolMagnitude.lte(0)) {
      set({
        roster: state.roster.map((w) => ({ ...w, strokesThisRun: 0 })),
        lastAscendRoll: null,
      });
      return;
    }
    const pool = poolMagnitude.mul(getWorkerXpPoolMultiplier(state));
    const shares = splitAscendPool(pool, state.roster);
    const roll: AscendRollEntry[] = [];
    const newRoster = state.roster.map((w, i) => {
      const res = applyAscendXpToWorker(w, shares[i]!);
      if (res.levelAfter > res.levelBefore) {
        roll.push({
          id: w.id,
          levelBefore: res.levelBefore,
          levelAfter: res.levelAfter,
          statsBefore: res.statsBefore,
          statsAfter: res.statsAfter,
        });
      }
      return { ...res.worker, strokesThisRun: 0 };
    });
    set({ roster: newRoster, lastAscendRoll: roll.length > 0 ? roll : null });
  },

  clearAscendRoll: () => set({ lastAscendRoll: null }),
});
