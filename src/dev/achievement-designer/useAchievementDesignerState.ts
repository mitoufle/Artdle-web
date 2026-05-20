import { useState, useEffect, useCallback, useRef } from "react";
import type { DesignFile, DesignAchievement, DesignEffect } from "./types";
import { EMPTY_DESIGN } from "./types";
import { saveDraft, clearDraft, migrateDesign, uuid } from "./storage";
import rawAchievements from "@/config/achievementsDesign.json";

const SAVE_DEBOUNCE_MS = 500;

export interface AchievementDesignerActions {
  addAchievement: () => void;
  deleteAchievement: (id: string) => void;
  updateAchievement: (id: string, patch: Partial<Omit<DesignAchievement, "effects">>) => void;
  addEffect: (achievementId: string) => void;
  updateEffect: (achievementId: string, effectId: string, patch: Partial<DesignEffect>) => void;
  deleteEffect: (achievementId: string, effectId: string) => void;
  moveAchievement: (id: string, toIndex: number) => void;
  resetAll: () => void;
  importDesign: (design: DesignFile) => void;
}

export interface AchievementDesignerState {
  design: DesignFile;
  actions: AchievementDesignerActions;
}

function loadFileBaseline(): DesignFile {
  return migrateDesign(rawAchievements);
}

export function useAchievementDesignerState(): AchievementDesignerState {
  // File is the source of truth. The draft still auto-saves (crash recovery)
  // but never overrides the file on load — prevents stale drafts silently
  // reverting changes wired into achievementsDesign.json out-of-band.
  const [design, setDesign] = useState<DesignFile>(() => loadFileBaseline());
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveDraft(design), SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [design]);

  const addAchievement = useCallback(() => {
    setDesign((d) => {
      const newId = `achievement_${d.length + 1}`;
      const newAch: DesignAchievement = {
        id: newId,
        name: "New Achievement",
        description: "",
        icon: "⭐",
        category: "canvas",
        condition: { stat: "lifetime.canvasesSold", op: ">=", value: 1 },
        effects: [],
      };
      return [...d, newAch];
    });
  }, []);

  const deleteAchievement = useCallback((id: string) => {
    setDesign((d) => d.filter((a) => a.id !== id));
  }, []);

  const updateAchievement = useCallback(
    (id: string, patch: Partial<Omit<DesignAchievement, "effects">>) => {
      setDesign((d) => d.map((a) => (a.id === id ? { ...a, ...patch } : a)));
    },
    [],
  );

  const addEffect = useCallback((achievementId: string) => {
    setDesign((d) =>
      d.map((a) => {
        if (a.id !== achievementId) return a;
        const newEffect: DesignEffect = { id: uuid(), kind: "canvas_gold_pct", value: 0 };
        return { ...a, effects: [...a.effects, newEffect] };
      }),
    );
  }, []);

  const updateEffect = useCallback(
    (achievementId: string, effectId: string, patch: Partial<DesignEffect>) => {
      setDesign((d) =>
        d.map((a) => {
          if (a.id !== achievementId) return a;
          return {
            ...a,
            effects: a.effects.map((e) => (e.id === effectId ? { ...e, ...patch } : e)),
          };
        }),
      );
    },
    [],
  );

  const deleteEffect = useCallback((achievementId: string, effectId: string) => {
    setDesign((d) =>
      d.map((a) => {
        if (a.id !== achievementId) return a;
        return { ...a, effects: a.effects.filter((e) => e.id !== effectId) };
      }),
    );
  }, []);

  const moveAchievement = useCallback((id: string, toIndex: number) => {
    setDesign((d) => {
      const currentIndex = d.findIndex((a) => a.id === id);
      if (currentIndex === -1) return d;
      const clamped = Math.max(0, Math.min(toIndex, d.length - 1));
      if (clamped === currentIndex) return d;
      const next = d.slice();
      const [moved] = next.splice(currentIndex, 1);
      next.splice(clamped, 0, moved!);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    clearDraft();
    setDesign([...loadFileBaseline()]);
  }, []);

  const importDesign = useCallback((d: DesignFile) => {
    setDesign(d);
  }, []);

  return {
    design: design.length > 0 ? design : EMPTY_DESIGN,
    actions: {
      addAchievement,
      deleteAchievement,
      updateAchievement,
      addEffect,
      updateEffect,
      deleteEffect,
      moveAchievement,
      resetAll,
      importDesign,
    },
  };
}

// HMR boundary. `achievementsDesign.json` is the user→agent communication
// channel: when the user saves in the designer, Vite invalidates this module
// because it imports the JSON. Without a self-accept the invalidation walks
// up through the designer route → App → main.tsx, hits a Fast-Refresh-
// incompatible export, and Vite falls back to a full page reload. That
// reload races the throttled IDB save adapter and silently reverts game
// state. Self-accepting stops the cascade here — the running game is
// completely untouched by JSON saves, matching the intent that the JSON is
// a spec file the agent reads, not a live runtime input.
if (import.meta.hot) {
  import.meta.hot.accept();
}
