import type { StateCreator } from "zustand";
import { newPlayerId } from "@/core/playerId";

export interface MetaSlice {
  playerId: string;
  ascendCount: number;

  /** Bumped on each successful ascend. */
  incrementAscendCount: () => void;
  /** Test/debug helper — overwrite the playerId. Not used in production. */
  _setPlayerId: (id: string) => void;
}

export const createMetaSlice: StateCreator<MetaSlice, [], [], MetaSlice> = (set) => ({
  playerId: newPlayerId(),
  ascendCount: 0,

  incrementAscendCount: () => set((s) => ({ ascendCount: s.ascendCount + 1 })),
  _setPlayerId: (id) => set({ playerId: id }),
});
