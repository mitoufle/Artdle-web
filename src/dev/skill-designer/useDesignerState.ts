import { useState, useEffect, useCallback, useRef } from "react";
import type { DesignFile, DesignNode } from "./types";
import { EMPTY_DESIGN } from "./types";
import { loadDraft, saveDraft, clearDraft } from "./storage";

const SAVE_DEBOUNCE_MS = 500;

export interface DesignerActions {
  addNode: () => void;
  updateNode: (id: string, patch: Partial<DesignNode>) => void;
  deleteNode: (id: string) => void;
  selectNode: (id: string | null) => void;
  resetAll: () => void;
  importDesign: (design: DesignFile) => void;
}

export interface DesignerState {
  design: DesignFile;
  selectedId: string | null;
  actions: DesignerActions;
}

function uniqueId(existing: ReadonlyArray<DesignNode>, base: string): string {
  if (!existing.some((n) => n.id === base)) return base;
  let i = 2;
  while (existing.some((n) => n.id === `${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

export function useDesignerState(): DesignerState {
  const [design, setDesign] = useState<DesignFile>(() => loadDraft() ?? EMPTY_DESIGN);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveDraft(design);
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [design]);

  const addNode = useCallback(() => {
    setDesign((d) => {
      const newId = uniqueId(d.nodes, "new_node");
      const newNode: DesignNode = {
        id: newId,
        name: "New Node",
        description: "",
        numericEffect: "",
        parentId: null,
        maxLevel: 1,
        costs: [0],
        position: null,
      };
      return { ...d, nodes: [...d.nodes, newNode] };
    });
  }, []);

  const updateNode = useCallback((id: string, patch: Partial<DesignNode>) => {
    setDesign((d) => ({
      ...d,
      nodes: d.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    }));
    if (patch.id !== undefined) {
      setSelectedId((cur) => (cur === id ? patch.id! : cur));
    }
  }, []);

  const deleteNode = useCallback((id: string) => {
    setDesign((d) => ({
      ...d,
      nodes: d.nodes
        .filter((n) => n.id !== id)
        .map((n) => (n.parentId === id ? { ...n, parentId: null } : n)),
    }));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const selectNode = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const resetAll = useCallback(() => {
    clearDraft();
    setDesign(EMPTY_DESIGN);
    setSelectedId(null);
  }, []);

  const importDesign = useCallback((d: DesignFile) => {
    setDesign(d);
    setSelectedId(null);
  }, []);

  return {
    design,
    selectedId,
    actions: { addNode, updateNode, deleteNode, selectNode, resetAll, importDesign },
  };
}
