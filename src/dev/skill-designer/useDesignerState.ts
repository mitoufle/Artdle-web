import { useState, useEffect, useCallback, useRef } from "react";
import type { DesignFile, DesignNode, NodeKind, StackingMode, DesignCluster } from "./types";
import { EMPTY_DESIGN } from "./types";
import { loadDraft, saveDraft, clearDraft } from "./storage";
import { nextClusterRegion } from "./clusterRegion";
import designJson from "@/config/skillTreeDesign.json";

const SAVE_DEBOUNCE_MS = 500;

export interface DesignerActions {
  addNode: () => void;
  updateNode: (id: string, patch: Partial<DesignNode>) => void;
  deleteNode: (id: string) => void;
  selectNode: (id: string | null) => void;
  resetAll: () => void;
  importDesign: (design: DesignFile) => void;
  addCluster: () => void;
  updateCluster: (id: string, patch: Partial<DesignCluster>) => void;
  deleteCluster: (id: string) => void;
  selectCluster: (id: string | null) => void;
}

export interface DesignerState {
  design: DesignFile;
  selectedId: string | null;
  selectedClusterId: string | null;
  actions: DesignerActions;
}

function uniqueId(existing: ReadonlyArray<DesignNode>, base: string): string {
  if (!existing.some((n) => n.id === base)) return base;
  let i = 2;
  while (existing.some((n) => n.id === `${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

function uniqueClusterId(existing: ReadonlyArray<DesignCluster>): string {
  let i = existing.length + 1;
  while (existing.some((c) => c.id === `cluster_${i}`)) i += 1;
  return `cluster_${i}`;
}

/**
 * Read the on-disk design JSON as a fallback when localStorage has no draft.
 * Coerces JSON-string types to the union types our DesignNode interface expects.
 */
function loadFileBaseline(): DesignFile {
  return {
    version: 1,
    title: designJson.title ?? "From file",
    designedAt: designJson.designedAt ?? "",
    nodes: designJson.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      description: n.description,
      numericEffect: n.numericEffect,
      parentIds: n.parentIds,
      stacking: ((n as { stacking?: string }).stacking ?? "additive") as StackingMode,
      kind: ((n as { kind?: string }).kind ?? "minor") as NodeKind,
      maxLevel: n.maxLevel,
      costs: n.costs,
      unlocks: ((n as { unlocks?: string[] }).unlocks ?? []) as string[],
      position: n.position,
      clusterId: ((n as { clusterId?: string }).clusterId ?? "inspiration") as string,
    })),
    clusters: ((designJson as { clusters?: DesignCluster[] }).clusters ?? []) as ReadonlyArray<DesignCluster>,
  };
}

export function useDesignerState(): DesignerState {
  const [design, setDesign] = useState<DesignFile>(
    () => loadDraft() ?? loadFileBaseline(),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
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
        parentIds: [],
        stacking: "additive",
        kind: "minor",
        maxLevel: 1,
        costs: [0],
        unlocks: [],
        position: null,
        clusterId: "inspiration",
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
        .map((n) =>
          n.parentIds.includes(id)
            ? { ...n, parentIds: n.parentIds.filter((p) => p !== id) }
            : n,
        ),
    }));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const selectNode = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id !== null) setSelectedClusterId(null);
  }, []);

  const resetAll = useCallback(() => {
    clearDraft();
    setDesign({ ...loadFileBaseline() });
    setSelectedId(null);
    setSelectedClusterId(null);
  }, []);

  const importDesign = useCallback((d: DesignFile) => {
    setDesign(d);
    setSelectedId(null);
    setSelectedClusterId(null);
  }, []);

  const addCluster = useCallback(() => {
    // Id is computed from the current snapshot so we can select the new cluster
    // synchronously. Trade-off: two addCluster calls batched before a re-render
    // would collide on the id — fine for a dev tool driven by single clicks.
    const id = uniqueClusterId(design.clusters);
    const cluster: DesignCluster = {
      id, name: "New Cluster", theme: "", rootNodeId: "",
      region: nextClusterRegion(design.clusters),
    };
    setDesign((d) => ({ ...d, clusters: [...d.clusters, cluster] }));
    setSelectedClusterId(id);
    setSelectedId(null);
  }, [design.clusters]);

  const updateCluster = useCallback((id: string, patch: Partial<DesignCluster>) => {
    setDesign((d) => ({
      ...d,
      clusters: d.clusters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }, []);

  const deleteCluster = useCallback((id: string) => {
    setDesign((d) => {
      const remaining = d.clusters.filter((c) => c.id !== id);
      const fallback = remaining[0]?.id ?? "inspiration";
      return {
        ...d,
        clusters: remaining,
        nodes: d.nodes.map((n) => (n.clusterId === id ? { ...n, clusterId: fallback } : n)),
      };
    });
    setSelectedClusterId((cur) => (cur === id ? null : cur));
  }, []);

  const selectCluster = useCallback((id: string | null) => {
    setSelectedClusterId(id);
    if (id !== null) setSelectedId(null);
  }, []);

  return {
    design,
    selectedId,
    selectedClusterId,
    actions: { addNode, updateNode, deleteNode, selectNode, resetAll, importDesign,
               addCluster, updateCluster, deleteCluster, selectCluster },
  };
}

// HMR boundary — see comment in achievement-designer/useAchievementDesignerState.ts
// for the rationale. Stops skill-designer JSON saves from cascading into a
// full page reload that would race the IDB save adapter and revert game state.
if (import.meta.hot) {
  import.meta.hot.accept();
}
