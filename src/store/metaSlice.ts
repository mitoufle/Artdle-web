import type { StateCreator } from "zustand";
import { newPlayerId } from "@/core/playerId";
import { performAscendOrchestrator } from "@/systems/ascend";
import type { GameStore } from "@/store";

export interface PastRun {
  /** Fame gained on this ascend. */
  readonly fame: number;
  /** Date.now() at the moment the orchestrator captured the ascend. */
  readonly ascendedAt: number;
}

export interface MetaSlice {
  playerId: string;
  ascendCount: number;
  /**
   * Append-only chronological log of past ascends. Persists across reloads.
   * Populated by the ascend orchestrator (`performAscendOrchestrator`).
   * UI-only consumer is the AscensionRoute's PastRunsLedger panel.
   */
  pastRuns: ReadonlyArray<PastRun>;
  /**
   * Epoch ms of the last save flush (visibilitychange / beforeunload / 10s
   * heartbeat). Used on rehydration to compute `elapsed = Date.now() - lastSeen`
   * for the offline-progress catch-up simulation.
   */
  lastSeen: number;

  /**
   * Sticky unlock for the Ascension tab in TopBar. Flips false → true once
   * the player FIRST reaches the inspiration threshold for ascending
   * (canAscend predicate true). NEVER resets, even though canAscend itself
   * flips back to false after an ascend (inspiration → 0). Persisted.
   */
  unlockedAscension: boolean;
  /**
   * Sticky unlock for the Constellation tab in TopBar. Flips false → true
   * once the player has at least 1 fame for the first time. NEVER resets,
   * even if the player spends all fame on skill nodes. Persisted.
   */
  unlockedConstellation: boolean;

  /** Bumped on each successful ascend. */
  incrementAscendCount: () => void;
  /** Append a single past run entry. Called by the orchestrator. */
  addPastRun: (run: PastRun) => void;
  /** Test/debug helper — overwrite the playerId. Not used in production. */
  _setPlayerId: (id: string) => void;
  /**
   * Atomic ascend. Validates via canAscend(state); if true, runs the orchestrator
   * (resets gold/inspi/tree/canvas/workshop, credits fame, increments ascendCount,
   * appends a pastRun entry). Returns true on success; false if canAscend is false.
   */
  performAscend: () => boolean;
  /** Flip unlockedAscension to true. Idempotent. */
  unlockAscension: () => void;
  /** Flip unlockedConstellation to true. Idempotent. */
  unlockConstellation: () => void;
}

export const createMetaSlice: StateCreator<GameStore, [], [], MetaSlice> = (set, get) => ({
  playerId: newPlayerId(),
  ascendCount: 0,
  pastRuns: [],
  lastSeen: Date.now(),
  unlockedAscension: false,
  unlockedConstellation: false,

  incrementAscendCount: () => set((s) => ({ ascendCount: s.ascendCount + 1 })),
  addPastRun: (run) =>
    set((s) => ({ pastRuns: [...s.pastRuns, run] as ReadonlyArray<PastRun> })),
  _setPlayerId: (id) => set({ playerId: id }),
  performAscend: () => performAscendOrchestrator(get),
  unlockAscension: () => set((s) => (s.unlockedAscension ? {} : { unlockedAscension: true })),
  unlockConstellation: () => set((s) => (s.unlockedConstellation ? {} : { unlockedConstellation: true })),
});
