import type { StateCreator } from "zustand";
import { big, type Big } from "@/core/bigNumber";
import type { GameStore } from "@/store";

export interface StatsLifetime {
  canvasesSold: number;
  critsLanded: number;
  maxComboChain: number;
  workshopItemsCrafted: number;
  workshopItemsFused: number;
  schoolResearchesCompleted: number;
  schoolTiersPassed: number;
  officeWorkersHired: number;
}

export interface StatsRun {
  canvasesSold: number;
  critsLanded: number;
  currentCritStreak: number;
  maxCritStreak: number;
  maxComboChain: number;
  goldEarned: Big;
  workshopItemsCrafted: number;
  schoolResearchesCompleted: number;
}

export interface StatsState {
  statsLifetime: StatsLifetime;
  statsRun: StatsRun;
}

export interface StatsSlice extends StatsState {
  incrementStat: (namespace: "lifetime" | "run", key: string, by?: number) => void;
  patchRunStats: (patch: Partial<StatsRun>) => void;
  resetRunStats: () => void;
}

export const initialStatsLifetime: StatsLifetime = Object.freeze({
  canvasesSold: 0,
  critsLanded: 0,
  maxComboChain: 0,
  workshopItemsCrafted: 0,
  workshopItemsFused: 0,
  schoolResearchesCompleted: 0,
  schoolTiersPassed: 0,
  officeWorkersHired: 0,
});

export const initialStatsRun: StatsRun = Object.freeze({
  canvasesSold: 0,
  critsLanded: 0,
  currentCritStreak: 0,
  maxCritStreak: 0,
  maxComboChain: 0,
  goldEarned: big(0),
  workshopItemsCrafted: 0,
  schoolResearchesCompleted: 0,
}) as StatsRun;

export const createStatsSlice: StateCreator<GameStore, [], [], StatsSlice> = (set, get) => ({
  statsLifetime: { ...initialStatsLifetime },
  statsRun: { ...initialStatsRun },

  incrementStat: (namespace, key, by = 1) => {
    const state = get();
    if (namespace === "lifetime") {
      const prev = (state.statsLifetime as Record<string, number>)[key] ?? 0;
      set({ statsLifetime: { ...state.statsLifetime, [key]: prev + by } });
    } else {
      const prev = (state.statsRun as Record<string, unknown>)[key] ?? 0;
      set({ statsRun: { ...state.statsRun, [key]: (prev as number) + by } });
    }
  },

  patchRunStats: (patch) => {
    set((s) => ({ statsRun: { ...s.statsRun, ...patch } }));
  },

  resetRunStats: () => {
    set({ statsRun: { ...initialStatsRun } });
  },
});
