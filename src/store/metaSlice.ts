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
}

export const createMetaSlice: StateCreator<GameStore, [], [], MetaSlice> = (set, get) => ({
  playerId: newPlayerId(),
  ascendCount: 0,
  pastRuns: [],

  incrementAscendCount: () => set((s) => ({ ascendCount: s.ascendCount + 1 })),
  addPastRun: (run) =>
    set((s) => ({ pastRuns: [...s.pastRuns, run] as ReadonlyArray<PastRun> })),
  _setPlayerId: (id) => set({ playerId: id }),
  performAscend: () => performAscendOrchestrator(set, get),
});
