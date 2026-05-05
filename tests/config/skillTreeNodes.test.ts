import { describe, it, expect } from "vitest";
import { SKILL_NODES, type SkillNodeId } from "@/config/skillTreeNodes";

describe("SKILL_NODES config", () => {
  it("has the expected number of nodes", () => {
    expect(SKILL_NODES.length).toBeGreaterThan(0);
  });

  it("all IDs are unique", () => {
    const ids = SKILL_NODES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all parentIds reference valid existing IDs", () => {
    const ids = new Set<string>(SKILL_NODES.map((n) => n.id));
    for (const node of SKILL_NODES) {
      for (const parentId of node.parentIds) {
        expect(ids.has(parentId), `parentId "${parentId}" of node "${node.id}" not found`).toBe(true);
      }
    }
  });

  it("at least one node has empty parentIds (root connected to FAME hub)", () => {
    const hasRoot = SKILL_NODES.some((n) => n.parentIds.length === 0);
    expect(hasRoot).toBe(true);
  });

  it("every node has costs.length === maxLevel", () => {
    for (const node of SKILL_NODES) {
      expect(node.costs.length, `node "${node.id}" costs.length !== maxLevel`).toBe(node.maxLevel);
    }
  });

  it("every node's costs are all positive numbers", () => {
    for (const node of SKILL_NODES) {
      for (const cost of node.costs) {
        expect(cost, `node "${node.id}" has a non-positive cost`).toBeGreaterThan(0);
      }
    }
  });

  it("the expected v3 IDs are present (regression pin)", () => {
    const ids: SkillNodeId[] = SKILL_NODES.map((n) => n.id);
    // Root nodes
    expect(ids).toContain("get_inspired");
    expect(ids).toContain("black_white");
    // Color chain
    expect(ids).toContain("magenta");
    expect(ids).toContain("cyan");
    expect(ids).toContain("yellow");
    expect(ids).toContain("rainbow");
    // Skill progression
    expect(ids).toContain("poke_tree");
    expect(ids).toContain("basic_technique");
    expect(ids).toContain("muscle_memory");
    expect(ids).toContain("gear_up");
  });
});
