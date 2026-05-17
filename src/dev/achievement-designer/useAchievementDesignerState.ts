import { useState, useEffect, useCallback, useRef } from "react";
import type { DesignFile, DesignAchievement, DesignEffect } from "./types";
import { EMPTY_DESIGN } from "./types";
import { loadDraft, saveDraft, clearDraft, migrateDesign, uuid } from "./storage";
import rawAchievements from "@/config/achievementsDesign.json";

const SAVE_DEBOUNCE_MS = 500;

export interface AchievementDesignerActions {
  addAchievement: () => void;
  deleteAchievement: (id: string) => void;
  updateAchievement: (id: string, patch: Partial<Omit<DesignAchievement, "effects">>) => void;
  addEffect: (achievementId: string) => void;
  updateEffect: (achievementId: string, effectId: string, patch: Partial<DesignEffect>) => void;
  deleteEffect: (achievementId: string, effectId: string) => void;
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
  const [design, setDesign] = useState<DesignFile>(
    () => loadDraft() ?? loadFileBaseline(),
  );
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
      resetAll,
      importDesign,
    },
  };
}
