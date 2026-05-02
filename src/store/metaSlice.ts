import type { StateCreator } from "zustand";
import { newPlayerId } from "@/core/playerId";
import { performAscendOrchestrator } from "@/systems/ascend";
import type { GameStore } from "@/store";

export interface MetaSlice {
  playerId: string;
  ascendCount: number;

  /** Bumped on each successful ascend. */
  incrementAscendCount: () => void;
  /** Test/debug helper — overwrite the playerId. Not used in production. */
  _setPlayerId: (id: string) => void;
  /**
   * Atomic ascend. Validates via canAscend(state); if true, runs the orchestrator
   * (resets gold/inspi/tree/canvas/workshop, credits fame, increments ascendCount).
   * Returns true on success; false if canAscend is false (no state changed).
   */
  performAscend: () => boolean;
}

export const createMetaSlice: StateCreator<GameStore, [], [], MetaSlice> = (set, get) => ({
  playerId: newPlayerId(),
  ascendCount: 0,

  incrementAscendCount: () => set((s) => ({ ascendCount: s.ascendCount + 1 })),
  _setPlayerId: (id) => set({ playerId: id }),
  performAscend: () => performAscendOrchestrator(set, get),
});
