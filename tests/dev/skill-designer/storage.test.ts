import { describe, it, expect, beforeEach } from "vitest";
import { loadDraft, saveDraft, clearDraft, STORAGE_KEY } from "@/dev/skill-designer/storage";
import type { DesignFile } from "@/dev/skill-designer/types";

const sample: DesignFile = {
  version: 1,
  title: "Test draft",
  designedAt: "2026-01-01T00:00:00.000Z",
  nodes: [
    {
      id: "a",
      name: "A",
      description: "desc",
      numericEffect: "+10%",
      parentIds: [],
      stacking: "additive",
      kind: "minor",
      maxLevel: 1,
      costs: [1],
      position: null,
    },
  ],
};

describe("skill-designer storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loadDraft returns null when no draft exists", () => {
    expect(loadDraft()).toBeNull();
  });

  it("saveDraft + loadDraft round-trip", () => {
    saveDraft(sample);
    expect(loadDraft()).toEqual(sample);
  });

  it("loadDraft returns null when stored JSON is invalid", () => {
    localStorage.setItem(STORAGE_KEY, "not-json");
    expect(loadDraft()).toBeNull();
  });

  it("loadDraft returns null when version is wrong", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, nodes: [] }));
    expect(loadDraft()).toBeNull();
  });

  it("clearDraft removes the stored value", () => {
    saveDraft(sample);
    clearDraft();
    expect(loadDraft()).toBeNull();
  });

  it("loadDraft migrates legacy parentId to parentIds and defaults stacking to additive", () => {
    const legacy = {
      version: 1,
      title: "Legacy",
      designedAt: "",
      nodes: [
        { id: "a", name: "A", description: "", numericEffect: "", parentId: null,    maxLevel: 1, costs: [1], position: null },
        { id: "b", name: "B", description: "", numericEffect: "", parentId: "a",     maxLevel: 1, costs: [1], position: null },
      ],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    const loaded = loadDraft();
    expect(loaded).not.toBeNull();
    expect(loaded!.nodes[0]!.parentIds).toEqual([]);
    expect(loaded!.nodes[0]!.stacking).toBe("additive");
    expect(loaded!.nodes[1]!.parentIds).toEqual(["a"]);
    expect(loaded!.nodes[1]!.stacking).toBe("additive");
  });

  it("loadDraft defaults kind to 'minor' when missing on legacy nodes", () => {
    const legacy = {
      version: 1,
      title: "Legacy",
      designedAt: "",
      nodes: [
        { id: "a", name: "A", description: "", numericEffect: "", parentIds: [], stacking: "additive", maxLevel: 1, costs: [1], position: null },
        { id: "b", name: "B", description: "", numericEffect: "", parentIds: [], stacking: "additive", kind: "major", maxLevel: 1, costs: [1], position: null },
      ],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    const loaded = loadDraft();
    expect(loaded).not.toBeNull();
    expect(loaded!.nodes[0]!.kind).toBe("minor");
    expect(loaded!.nodes[1]!.kind).toBe("major");
  });
});
