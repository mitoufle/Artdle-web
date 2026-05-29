import type { StateCreator } from "zustand";
import { v4 as uuidv4 } from "uuid";
import { big, type Big } from "@/core/bigNumber";
import type { GameStore } from "@/store";
import { countCapability } from "@/store/skillTreeSlice";
import { createBaseStats, type WorkerStats } from "@/core/workerModel";

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
}

export interface OfficeState {
  readonly roster: ReadonlyArray<Worker>;
}

export const initialOfficeState: OfficeState = Object.freeze({
  roster: Object.freeze([]) as ReadonlyArray<Worker>,
}) as OfficeState;

export interface OfficeSlice extends OfficeState {
  /**
   * Spawn fresh level-1 workers until the roster fills every unlocked slot.
   * Spawn-only (never despawns — caps only grow). Idempotent. Call after a
   * roster_slot purchase and once post-rehydration.
   */
  reconcileRoster: () => void;
  /**
   * Ascend hook. Workers PERSIST across ascend; this resets only per-run
   * contribution (strokesThisRun → 0). Phase C renames this at the ascend
   * call site and adds the XP/level-up pass.
   */
  resetOffice: () => void;
}

/** Max number of workers — sum of fame-node levels carrying the `roster_slot` tag. */
export const getRosterCap = (state: Pick<GameStore, "purchasedNodes">): number =>
  countCapability(state, "roster_slot");

/** Factory: a fresh level-1 worker of the given class (default neutral "base"). */
export const createWorker = (classId = "base"): Worker => ({
  id: uuidv4(),
  classId,
  level: 1,
  xp: big(0),
  stats: createBaseStats(),
  mastery: 0,
  strokesThisRun: 0,
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

  resetOffice: () => {
    set((s) => ({
      roster: s.roster.map((w) => ({ ...w, strokesThisRun: 0 })),
    }));
  },
});
