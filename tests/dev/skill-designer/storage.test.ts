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
      parentId: null,
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
});
