import type { StateCreator } from "zustand";
import { SCHOOL_TIERS } from "@/config/schoolResearches";
import { big } from "@/core/bigNumber";
import { schoolTickPure } from "@/core/schoolTickPure";
import type { GameStore } from "@/store";
import { getSchoolBonus } from "@/core/schoolMultipliers";

export interface SchoolState {
  completedResearches: Record<string, true>;
  currentTier: number;
  activeResearch: { id: string; remainingSeconds: number } | null;
  examsPassed: Record<number, true>;
}

export const initialSchoolState: SchoolState = Object.freeze({
  completedResearches: Object.freeze({}) as Record<string, true>,
  currentTier: 1,
  activeResearch: null,
  examsPassed: Object.freeze({}) as Record<number, true>,
}) as SchoolState;

export interface SchoolSlice extends SchoolState {
  startResearch: (id: string) => boolean;
  cancelResearch: () => void;
  schoolTick: (delta: number) => void;
  passExam: () => boolean;
  resetSchool: () => void;
}

export const createSchoolSlice: StateCreator<GameStore, [], [], SchoolSlice> = (set, get) => ({
  ...initialSchoolState,

  startResearch: (id) => {
    const state = get();
    if (state.activeResearch !== null) return false;
    if (state.completedResearches[id]) return false;
    const tierDef = SCHOOL_TIERS.find((t) => t.tier === state.currentTier);
    if (!tierDef) return false;
    const research = tierDef.researches.find((r) => r.id === id);
    if (!research) return false;
    const reductionSeconds = getSchoolBonus(state, "School Research flat reduction (mnt)") * 60;
    const remainingSeconds = Math.max(60, research.durationSeconds - reductionSeconds);
    set({ activeResearch: { id, remainingSeconds } });
    return true;
  },

  cancelResearch: () => {
    set({ activeResearch: null });
  },

  schoolTick: (delta) => {
    const before = get().activeResearch?.id ?? null;
    set((state) => {
      const draft = { ...state } as GameStore;
      schoolTickPure(draft, delta);
      return {
        activeResearch: draft.activeResearch,
        completedResearches: draft.completedResearches,
        statsLifetime: draft.statsLifetime,
        statsRun: draft.statsRun,
      };
    });
    // Fire achievement evaluation only if a research just completed.
    if (before !== null && get().activeResearch === null) {
      get().evaluateAchievements();
    }
  },

  passExam: () => {
    const state = get();
    const tierDef = SCHOOL_TIERS.find((t) => t.tier === state.currentTier);
    if (!tierDef) return false;
    if (!SCHOOL_TIERS.some((t) => t.tier === state.currentTier + 1)) return false;
    const allComplete = tierDef.researches.every((r) => state.completedResearches[r.id]);
    if (!allComplete) return false;
    const examCost = big(tierDef.examCost);
    if (!state.spend("fame", examCost)) return false;
    set({
      examsPassed: { ...state.examsPassed, [state.currentTier]: true },
      currentTier: state.currentTier + 1,
    });
    get().incrementStat("lifetime", "schoolTiersPassed");
    get().evaluateAchievements();
    return true;
  },

  resetSchool: () => {
    set(initialSchoolState);
  },
});
