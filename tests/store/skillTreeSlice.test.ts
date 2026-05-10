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

  it("buyNode('get_inspired') 5 times spends [1,5,10,15,20] = 51 total fame", () => {
    useGameStore.setState({ fame: big(51) });
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
    expect(getNextCost(useGameStore.getState(), "get_inspired")).toBe(10);
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

import { getCanvasTrackUnlocked } from "@/store/skillTreeSlice";

describe("getCanvasTrackUnlocked", () => {
  it("returns true for sell_price always", () => {
    useGameStore.setState({ purchasedNodes: {} });
    expect(getCanvasTrackUnlocked(useGameStore.getState(), "sell_price")).toBe(true);
  });

  it("returns true for speed always", () => {
    useGameStore.setState({ purchasedNodes: {} });
    expect(getCanvasTrackUnlocked(useGameStore.getState(), "speed")).toBe(true);
  });

  it("returns false for size when unlock_canvas_size not purchased", () => {
    useGameStore.setState({ purchasedNodes: {} });
    expect(getCanvasTrackUnlocked(useGameStore.getState(), "size")).toBe(false);
  });

  it("returns true for size when unlock_canvas_size purchased (any level)", () => {
    useGameStore.setState({ purchasedNodes: { unlock_canvas_size: 1 } });
    expect(getCanvasTrackUnlocked(useGameStore.getState(), "size")).toBe(true);
  });

  it("checks unlock_canvas_crit for crit", () => {
    useGameStore.setState({ purchasedNodes: { unlock_canvas_crit: 1 } });
    expect(getCanvasTrackUnlocked(useGameStore.getState(), "crit")).toBe(true);
    useGameStore.setState({ purchasedNodes: {} });
    expect(getCanvasTrackUnlocked(useGameStore.getState(), "crit")).toBe(false);
  });

  it("checks unlock_canvas_combo for combo", () => {
    useGameStore.setState({ purchasedNodes: { unlock_canvas_combo: 1 } });
    expect(getCanvasTrackUnlocked(useGameStore.getState(), "combo")).toBe(true);
  });
});
