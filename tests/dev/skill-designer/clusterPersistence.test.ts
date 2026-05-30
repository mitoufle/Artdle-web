import { describe, it, expect, beforeEach } from "vitest";
import { loadDraft, saveDraft, STORAGE_KEY } from "@/dev/skill-designer/storage";
import design from "@/config/skillTreeDesign.json";
import type { DesignFile } from "@/dev/skill-designer/types";

describe("cluster persistence", () => {
  beforeEach(() => localStorage.clear());

  it("the design file seeds the seven clusters", () => {
    const ids = (design as { clusters: { id: string }[] }).clusters.map((c) => c.id).sort();
    expect(ids).toEqual(["colors", "combo", "crit", "inspiration", "office", "school", "workshop"]);
  });

  it("each seeded cluster's rootNodeId is a node whose clusterId matches and has no parents", () => {
    const d = design as { clusters: { id: string; rootNodeId: string }[]; nodes: { id: string; clusterId: string; parentIds: string[] }[] };
    for (const c of d.clusters) {
      const root = d.nodes.find((n) => n.id === c.rootNodeId);
      expect(root, c.id).toBeDefined();
      expect(root!.clusterId).toBe(c.id);
      expect(root!.parentIds).toEqual([]);
    }
  });

  it("round-trips custom clusters through localStorage", () => {
    const file: DesignFile = {
      version: 1, title: "t", designedAt: "", nodes: [],
      clusters: [{ id: "music", name: "Music", theme: "", rootNodeId: "", region: { x: 0, y: 0, w: 600, h: 600 } }],
    };
    saveDraft(file);
    const back = loadDraft();
    expect(back?.clusters).toEqual(file.clusters);
  });

  it("defaults clusters to the seeded set for a legacy draft missing clusters", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, title: "old", designedAt: "", nodes: [] }));
    const back = loadDraft();
    expect(back?.clusters.map((c) => c.id).sort()).toContain("workshop");
  });
});
