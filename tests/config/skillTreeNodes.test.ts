import { describe, it, expect } from "vitest";
import { SKILL_NODES, type SkillNodeId } from "@/config/skillTreeNodes";

describe("SKILL_NODES config", () => {
  it("has exactly 5 nodes", () => {
    expect(SKILL_NODES).toHaveLength(5);
  });

  it("costs are strictly increasing: 1 < 3 < 10 < 30 < 100", () => {
    expect(SKILL_NODES[0]?.cost).toBe(1);
    expect(SKILL_NODES[1]?.cost).toBe(3);
    expect(SKILL_NODES[2]?.cost).toBe(10);
    expect(SKILL_NODES[3]?.cost).toBe(30);
    expect(SKILL_NODES[4]?.cost).toBe(100);
    for (let i = 1; i < SKILL_NODES.length; i++) {
      expect(SKILL_NODES[i]!.cost).toBeGreaterThan(SKILL_NODES[i - 1]!.cost);
    }
  });

  it("all prereq references point to valid existing IDs (or null)", () => {
    const ids = new Set<string>(SKILL_NODES.map((n) => n.id));
    for (const node of SKILL_NODES) {
      if (node.prereq !== null) {
        expect(ids.has(node.prereq)).toBe(true);
      }
    }
  });

  it("the first node's prereq is null (chain root)", () => {
    expect(SKILL_NODES[0]?.prereq).toBeNull();
  });

  it("all 5 IDs are unique", () => {
    const ids = SKILL_NODES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("the 5 expected IDs are present (regression pin)", () => {
    const expectedIds: SkillNodeId[] = [
      "goldsmith",
      "patient_eye",
      "second_slot",
      "faster_strokes",
      "better_brush",
    ];
    expect(SKILL_NODES.map((n) => n.id)).toEqual(expectedIds);
  });
});
