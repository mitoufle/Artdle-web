import { useState, useEffect, useCallback, useRef } from "react";
import type { DesignFile, DesignTier, DesignResearch } from "./types";
import { EMPTY_DESIGN } from "./types";
import { loadDraft, saveDraft, clearDraft, migrateDesign } from "./storage";
import rawTiers from "@/config/schoolResearches.json";

const SAVE_DEBOUNCE_MS = 500;

export interface SchoolDesignerActions {
  addTier: () => void;
  deleteTier: (tier: number) => void;
  updateTier: (tier: number, patch: Partial<Omit<DesignTier, "tier" | "researches">>) => void;
  addResearch: (tier: number) => void;
  updateResearch: (tier: number, id: string, patch: Partial<DesignResearch>) => void;
  deleteResearch: (tier: number, id: string) => void;
  resetAll: () => void;
  importDesign: (design: DesignFile) => void;
}

export interface SchoolDesignerState {
  design: DesignFile;
  actions: SchoolDesignerActions;
}

function loadFileBaseline(): DesignFile {
  return migrateDesign(rawTiers);
}

export function useSchoolDesignerState(): SchoolDesignerState {
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

  const addTier = useCallback(() => {
    setDesign((d) => {
      const nextTier = d.length + 1;
      const newTier: DesignTier = {
        tier: nextTier,
        label: `Tier ${nextTier}`,
        examCost: 50,
        researches: [],
      };
      return [...d, newTier];
    });
  }, []);

  const deleteTier = useCallback((tier: number) => {
    setDesign((d) => {
      const filtered = d.filter((t) => t.tier !== tier);
      return filtered.map((t, i) => ({ ...t, tier: i + 1 }));
    });
  }, []);

  const updateTier = useCallback(
    (tier: number, patch: Partial<Omit<DesignTier, "tier" | "researches">>) => {
      setDesign((d) => d.map((t) => (t.tier === tier ? { ...t, ...patch } : t)));
    },
    [],
  );

  const addResearch = useCallback((tier: number) => {
    setDesign((d) =>
      d.map((t) => {
        if (t.tier !== tier) return t;
        const newId = `research_${t.tier}_${t.researches.length + 1}`;
        const newResearch: DesignResearch = {
          id: newId,
          name: "New Research",
          durationSeconds: 300,
          effects: [],
        };
        return { ...t, researches: [...t.researches, newResearch] };
      }),
    );
  }, []);

  const updateResearch = useCallback(
    (tier: number, id: string, patch: Partial<DesignResearch>) => {
      setDesign((d) =>
        d.map((t) => {
          if (t.tier !== tier) return t;
          return {
            ...t,
            researches: t.researches.map((r) => (r.id === id ? { ...r, ...patch } : r)),
          };
        }),
      );
    },
    [],
  );

  const deleteResearch = useCallback((tier: number, id: string) => {
    setDesign((d) =>
      d.map((t) => {
        if (t.tier !== tier) return t;
        return { ...t, researches: t.researches.filter((r) => r.id !== id) };
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
    design,
    actions: {
      addTier,
      deleteTier,
      updateTier,
      addResearch,
      updateResearch,
      deleteResearch,
      resetAll,
      importDesign,
    },
  };
}
