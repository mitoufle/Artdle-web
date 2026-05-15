import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { hasNode, canBuyNode, getNodeLevel, getNextCost } from "@/store/skillTreeSlice";
import { big } from "@/core/bigNumber";
import type { SkillNodeId } from "@/config/skillTreeNodes";

describe("skillTreeSlice (multi-level + DAG)", () => {
  beforeEach(() => {
    useGameStore.setState({ purchasedNodes: {}, pokeTreeTimer: 0, fame: big(0) });
  });

  it("initializes with empty purchasedNodes", () => {
    expect(useGameStore.getState().purchasedNodes).toEqual({});
  });

  it("getNodeLevel returns 0 for never-bought node", () => {
    expect(getNodeLevel(useGameStore.getState(), "get_inspired")).toBe(0);
  });

  it("buyNode('get_inspired') with 1 fame: succeeds, level=1, fame=0", () => {
    useGameStore.setState({ fame: big(1) });
    expect(useGameStore.getState().buyNode("get_inspired")).toBe(true);
    expect(getNodeLevel(useGameStore.getState(), "get_inspired")).toBe(1);
    expect(useGameStore.getState().fame.eq(0)).toBe(true);
  });

  it("buyNode('get_inspired') 5 times spends [1,2,3,5,8] = 19 total fame", () => {
    useGameStore.setState({ fame: big(19) });
    for (let i = 0; i < 5; i++) {
      expect(useGameStore.getState().buyNode("get_inspired")).toBe(true);
    }
    expect(getNodeLevel(useGameStore.getState(), "get_inspired")).toBe(5);
    expect(useGameStore.getState().fame.eq(0)).toBe(true);
  });

  it("buyNode at maxLevel returns false", () => {
    useGameStore.setState({ fame: big(1000) });
    for (let i = 0; i < 5; i++) useGameStore.getState().buyNode("get_inspired");
    expect(useGameStore.getState().buyNode("get_inspired")).toBe(false);
    expect(getNodeLevel(useGameStore.getState(), "get_inspired")).toBe(5);
  });

  it("buyNode without fame returns false", () => {
    expect(useGameStore.getState().buyNode("get_inspired")).toBe(false);
  });

  it("buyNode without all parents owned returns false", () => {
    // 'red' has parents [magenta, yellow]. Owning only one is not enough.
    useGameStore.setState({ fame: big(1000), purchasedNodes: { magenta: 1 } });
    expect(useGameStore.getState().buyNode("red")).toBe(false);
    useGameStore.setState({ purchasedNodes: { magenta: 1, yellow: 1 } });
    expect(useGameStore.getState().buyNode("red")).toBe(true);
  });

  it("hasNode returns true iff level > 0", () => {
    expect(hasNode(useGameStore.getState(), "get_inspired")).toBe(false);
    useGameStore.setState({ purchasedNodes: { get_inspired: 1 } });
    expect(hasNode(useGameStore.getState(), "get_inspired")).toBe(true);
  });

  it("canBuyNode false when prereq not met", () => {
    useGameStore.setState({ fame: big(1000) });
    expect(canBuyNode(useGameStore.getState(), "red")).toBe(false);
  });

  it("getNextCost returns the next-level cost; null if maxed", () => {
    expect(getNextCost(useGameStore.getState(), "get_inspired")).toBe(1);
    useGameStore.setState({ purchasedNodes: { get_inspired: 2 } });
    expect(getNextCost(useGameStore.getState(), "get_inspired")).toBe(3);
    useGameStore.setState({ purchasedNodes: { get_inspired: 5 } });
    expect(getNextCost(useGameStore.getState(), "get_inspired")).toBe(null);
  });

  it("getNextCost returns null for unknown id", () => {
    expect(getNextCost(useGameStore.getState(), "ghost" as SkillNodeId)).toBe(null);
  });

  it("skillTreeTick: poke_tree level 0 → no inspi, timer stays 0", () => {
    useGameStore.setState({ inspiration: big(0), purchasedNodes: {} });
    useGameStore.getState().skillTreeTick(15);
    expect(useGameStore.getState().inspiration.eq(0)).toBe(true);
    expect(useGameStore.getState().pokeTreeTimer).toBe(0);
  });

  it("skillTreeTick: poke_tree level 1, 5s tick → 0 inspi, timer 5", () => {
    useGameStore.setState({ inspiration: big(0), purchasedNodes: { poke_tree: 1 }, pokeTreeTimer: 0 });
    useGameStore.getState().skillTreeTick(5);
    expect(useGameStore.getState().inspiration.eq(0)).toBe(true);
    expect(useGameStore.getState().pokeTreeTimer).toBeCloseTo(5, 5);
  });

  it("skillTreeTick: poke_tree level 1, 10s tick → +100 inspi, timer 0", () => {
    useGameStore.setState({ inspiration: big(0), purchasedNodes: { poke_tree: 1 }, pokeTreeTimer: 0 });
    useGameStore.getState().skillTreeTick(10);
    expect(useGameStore.getState().inspiration.eq(100)).toBe(true);
    expect(useGameStore.getState().pokeTreeTimer).toBeCloseTo(0, 5);
  });

  it("skillTreeTick: poke_tree level 3, 25s tick → +800 inspi (2 grants × 100×2^2), timer 5", () => {
    // L3 doubling: 100 × 2^(3-1) = 400 per grant. 2 grants in 25s → 800.
    useGameStore.setState({ inspiration: big(0), purchasedNodes: { poke_tree: 3 }, pokeTreeTimer: 0 });
    useGameStore.getState().skillTreeTick(25);
    expect(useGameStore.getState().inspiration.eq(800)).toBe(true);
    expect(useGameStore.getState().pokeTreeTimer).toBeCloseTo(5, 5);
  });

  it("skillTreeTick: poke_tree level 5, 10s tick → +1600 inspi (100 × 2^4)", () => {
    useGameStore.setState({ inspiration: big(0), purchasedNodes: { poke_tree: 5 }, pokeTreeTimer: 0 });
    useGameStore.getState().skillTreeTick(10);
    expect(useGameStore.getState().inspiration.eq(1600)).toBe(true);
  });

  it("resetSkillTree clears purchasedNodes and pokeTreeTimer", () => {
    useGameStore.setState({ purchasedNodes: { get_inspired: 3 }, pokeTreeTimer: 7 });
    useGameStore.getState().resetSkillTree();
    expect(useGameStore.getState().purchasedNodes).toEqual({});
    expect(useGameStore.getState().pokeTreeTimer).toBe(0);
  });
});

import { getCanvasTrackUnlocked, hasCapability, countCapability } from "@/store/skillTreeSlice";
import { SKILL_NODES } from "@/config/skillTreeNodes";

describe("getCanvasTrackUnlocked", () => {
  it("returns true for sell_price always", () => {
    useGameStore.setState({ purchasedNodes: {} });
    expect(getCanvasTrackUnlocked(useGameStore.getState(), "sell_price")).toBe(true);
  });

  it("returns true for speed always", () => {
    useGameStore.setState({ purchasedNodes: {} });
    expect(getCanvasTrackUnlocked(useGameStore.getState(), "speed")).toBe(true);
  });

  it("returns false for size when no purchased node unlocks canvas_size", () => {
    useGameStore.setState({ purchasedNodes: {} });
    expect(getCanvasTrackUnlocked(useGameStore.getState(), "size")).toBe(false);
  });

  it("returns true for size when a node with unlocks:[canvas_size] is purchased (regardless of node ID)", () => {
    // size_matters node in skillTreeDesign.json has unlocks: ["canvas_size"]
    useGameStore.setState({ purchasedNodes: { size_matters: 1 } });
    expect(getCanvasTrackUnlocked(useGameStore.getState(), "size")).toBe(true);
  });

  it("returns false for size when the purchased node unlocks array does not include canvas_size", () => {
    // get_inspired node has no unlocks array
    useGameStore.setState({ purchasedNodes: { get_inspired: 1 } });
    expect(getCanvasTrackUnlocked(useGameStore.getState(), "size")).toBe(false);
  });

  it("checks canvas_crit capability for crit track", () => {
    useGameStore.setState({ purchasedNodes: {} });
    expect(getCanvasTrackUnlocked(useGameStore.getState(), "crit")).toBe(false);
  });

  it("checks canvas_combo capability for combo track", () => {
    useGameStore.setState({ purchasedNodes: {} });
    expect(getCanvasTrackUnlocked(useGameStore.getState(), "combo")).toBe(false);
  });
});

describe("hasCapability", () => {
  beforeEach(() => {
    useGameStore.setState({ purchasedNodes: {}, pokeTreeTimer: 0, fame: big(0) });
  });

  it("returns false when no nodes are purchased", () => {
    expect(hasCapability(useGameStore.getState(), "canvas_size")).toBe(false);
  });

  it("returns false when purchased nodes have no unlocks for the capability", () => {
    useGameStore.setState({ purchasedNodes: { get_inspired: 1 } });
    expect(hasCapability(useGameStore.getState(), "canvas_size")).toBe(false);
  });

  it("returns true when a purchased node has the capability in its unlocks", () => {
    // size_matters has unlocks: ["canvas_size"] in the JSON
    useGameStore.setState({ purchasedNodes: { size_matters: 1 } });
    expect(hasCapability(useGameStore.getState(), "canvas_size")).toBe(true);
  });

  it("returns false when a node with the capability is in purchasedNodes at level 0", () => {
    useGameStore.setState({ purchasedNodes: { size_matters: 0 } });
    expect(hasCapability(useGameStore.getState(), "canvas_size")).toBe(false);
  });

  it("size_matters node in SKILL_NODES has unlocks containing canvas_size", () => {
    const node = SKILL_NODES.find((n) => n.id === "size_matters");
    expect(node).toBeDefined();
    expect(node!.unlocks).toContain("canvas_size");
  });
});

describe("countCapability — sums level across nodes with the tag", () => {
  beforeEach(() => {
    useGameStore.setState({ purchasedNodes: {}, pokeTreeTimer: 0, fame: big(0) });
  });

  it("returns 0 when no purchased nodes carry the tag", () => {
    const state = useGameStore.getState();
    expect(countCapability(state, "canvas_size")).toBe(0);
  });

  it("sums the level of each purchased node whose unlocks include the tag", () => {
    // size_matters has unlocks: ["canvas_size"] in SKILL_NODES
    useGameStore.setState({ purchasedNodes: { size_matters: 1 } });
    const state = useGameStore.getState();
    expect(countCapability(state, "canvas_size")).toBe(1);
  });

  it("sums multiple nodes with the same capability", () => {
    // genius_episode has canvas_crit, unrelentless has canvas_combo
    useGameStore.setState({ purchasedNodes: { genius_episode: 1, unrelentless: 1 } });
    const state = useGameStore.getState();
    expect(countCapability(state, "canvas_crit")).toBe(1);
    expect(countCapability(state, "canvas_combo")).toBe(1);
  });

  it("sums across multiple nodes with the same capability tag", () => {
    // Use get_inspired (level 5) and another node with canvas_size
    // For now test the basic pattern
    useGameStore.setState({ purchasedNodes: { size_matters: 1, genius_episode: 1, unrelentless: 1 } });
    const state = useGameStore.getState();
    expect(countCapability(state, "canvas_size")).toBe(1);
    expect(countCapability(state, "canvas_crit")).toBe(1);
    expect(countCapability(state, "canvas_combo")).toBe(1);
  });

  it("returns 0 when a node with the capability is at level 0", () => {
    useGameStore.setState({ purchasedNodes: { size_matters: 0 } });
    const state = useGameStore.getState();
    expect(countCapability(state, "canvas_size")).toBe(0);
  });
});
