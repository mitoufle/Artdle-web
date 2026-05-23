import type { StateCreator } from "zustand";
import type { GameStore } from "@/store";
import { ACHIEVEMENTS, type AchievementEffect, type AchievementCategory } from "@/config/achievementConfig";

export interface AchievementNotification {
  id: string;
  name: string;
  icon: string;
  category: AchievementCategory;
  effects: ReadonlyArray<AchievementEffect>;
}

export interface AchievementState {
  completedAchievements: Record<string, true>;
  activeNotification: AchievementNotification | null;
  notificationQueue: ReadonlyArray<AchievementNotification>;
}

export interface AchievementSlice extends AchievementState {
  evaluateAchievements: () => void;
  advanceNotification: () => void;
  clearNotification: () => void;
}

const initialAchievementState: AchievementState = {
  completedAchievements: {},
  activeNotification: null,
  notificationQueue: [],
};

function resolveStatValue(state: GameStore, stat: string): number {
  // `audio.*` stats read from localStorage, mirroring useMusic.ts (music
  // volume/mute are not in the game store). Defaults match loadVolume/loadMuted.
  if (stat.startsWith("audio.")) {
    if (typeof localStorage === "undefined") return 0;
    if (stat === "audio.musicVolumePct") {
      if (localStorage.getItem("artdle-music-muted") === "true") return 0;
      const v = parseFloat(localStorage.getItem("artdle-music-volume") ?? "0.2");
      return (isNaN(v) ? 0.2 : Math.max(0, Math.min(1, v))) * 100;
    }
    return 0;
  }
  if (stat === "lifetime.goldEarned") return state.lifetimeGold.toNumber();
  // Designer alias: the user types the condition stat as `lifetime.goldgain` /
  // `lifetime.inspirationgain` in the achievement designer. Resolve to the
  // canonical Big trackers on the lifetimeStats slice.
  if (stat === "lifetime.goldgain") return state.lifetimeGold.toNumber();
  if (stat === "lifetime.inspirationgain") return state.lifetimeInspiration.toNumber();
  if (stat === "lifetime.ascensions") return state.ascendCount;
  // Tree tier displayed in the UI is 1-indexed (Tier 1 = Tiny Sprout = stage 0).
  if (stat === "tree.tier") return state.currentStage + 1;
  if (stat.startsWith("lifetime.")) {
    const key = stat.slice("lifetime.".length);
    return (state.statsLifetime as Record<string, number>)[key] ?? 0;
  }
  if (stat.startsWith("run.")) {
    const key = stat.slice("run.".length);
    const val = (state.statsRun as Record<string, unknown>)[key] ?? 0;
    if (typeof val === "number") return val;
    // Big value (e.g. goldEarned)
    return (val as { toNumber(): number }).toNumber();
  }
  return 0;
}

function checkCondition(actual: number, op: string, threshold: number): boolean {
  switch (op) {
    case ">=": return actual >= threshold;
    case ">":  return actual >  threshold;
    case "==": return actual === threshold;
    case "<=": return actual <= threshold;
    case "<":  return actual <  threshold;
    default:   return false;
  }
}

// Module-level timer handle — outside the StateCreator
let _notifTimer: ReturnType<typeof setTimeout> | null = null;

export const createAchievementSlice: StateCreator<GameStore, [], [], AchievementSlice> = (set, get) => ({
  ...initialAchievementState,

  evaluateAchievements: () => {
    const state = get();
    const newly: AchievementNotification[] = [];

    for (const achievement of ACHIEVEMENTS) {
      if (state.completedAchievements[achievement.id]) continue;
      const actual = resolveStatValue(state, achievement.condition.stat);
      if (!checkCondition(actual, achievement.condition.op, achievement.condition.value)) continue;

      newly.push({ id: achievement.id, name: achievement.name, icon: achievement.icon, category: achievement.category, effects: achievement.effects });
    }

    if (newly.length === 0) return;

    set((s) => {
      const updated: Record<string, true> = { ...s.completedAchievements };
      for (const n of newly) updated[n.id] = true;
      const combinedQueue = [...s.notificationQueue, ...newly];
      return { completedAchievements: updated, notificationQueue: combinedQueue };
    });

    // Drain queue into activeNotification if idle.
    if (get().activeNotification === null) {
      get().advanceNotification();
    }
  },

  advanceNotification: () => {
    const state = get();
    if (state.notificationQueue.length === 0) return;
    const [next, ...rest] = state.notificationQueue;
    set({ activeNotification: next, notificationQueue: rest });
    if (_notifTimer !== null) clearTimeout(_notifTimer);
    _notifTimer = setTimeout(() => {
      _notifTimer = null;
      get().clearNotification();
    }, 5000);
  },

  clearNotification: () => {
    set({ activeNotification: null });
    if (get().notificationQueue.length > 0) {
      get().advanceNotification();
    }
  },
});
