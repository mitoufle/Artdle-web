import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { hasNode, canBuyNode } from "@/store/skillTreeSlice";
import { big } from "@/core/bigNumber";
import type { SkillNodeId } from "@/config/skillTreeNodes";

describe("skillTreeSlice", () => {
  beforeEach(() => {
    // skillTreeSlice has no resetSkillTree action (purchasedNodes survives ascend).
    // Reset directly via setState.
    useGameStore.setState({ purchasedNodes: {} });
    // Reset fame to 0 so we can control test inputs.
    useGameStore.setState({ fame: big(0) });
  });

  it("initializes with purchasedNodes = {}", () => {
    expect(useGameStore.getState().purchasedNodes).toEqual({});
  });

  it("buyNode('goldsmith') with 1 fame succeeds; purchasedNodes.goldsmith === true; fame is 0", () => {
    useGameStore.getState().add("fame", big(1));
    expect(useGameStore.getState().buyNode("goldsmith")).toBe(true);
    expect(useGameStore.getState().purchasedNodes.goldsmith).toBe(true);
    expect(useGameStore.getState().fame.toNumber()).toBe(0);
  });

  it("buyNode('goldsmith') with 0 fame returns false; nothing changes", () => {
    expect(useGameStore.getState().buyNode("goldsmith")).toBe(false);
    expect(useGameStore.getState().purchasedNodes.goldsmith).toBeUndefined();
    expect(useGameStore.getState().fame.toNumber()).toBe(0);
  });

  it("buyNode('goldsmith') twice: second call returns false (already owned), no extra fame spent", () => {
    useGameStore.getState().add("fame", big(2));
    expect(useGameStore.getState().buyNode("goldsmith")).toBe(true);
    expect(useGameStore.getState().fame.toNumber()).toBe(1);
    expect(useGameStore.getState().buyNode("goldsmith")).toBe(false);
    expect(useGameStore.getState().fame.toNumber()).toBe(1);
  });

  it("buyNode('patient_eye') without goldsmith returns false; fame not spent", () => {
    useGameStore.getState().add("fame", big(100));
    expect(useGameStore.getState().buyNode("patient_eye")).toBe(false);
    expect(useGameStore.getState().purchasedNodes.patient_eye).toBeUndefined();
    expect(useGameStore.getState().fame.toNumber()).toBe(100);
  });

  it("buyNode('patient_eye') after goldsmith + 3 fame succeeds", () => {
    useGameStore.getState().add("fame", big(4)); // 1 for goldsmith + 3 for patient_eye
    useGameStore.getState().buyNode("goldsmith");
    expect(useGameStore.getState().buyNode("patient_eye")).toBe(true);
    expect(useGameStore.getState().purchasedNodes.patient_eye).toBe(true);
    expect(useGameStore.getState().fame.toNumber()).toBe(0);
  });

  it("linear chain: buying all 5 nodes in order works given enough fame", () => {
    useGameStore.getState().add("fame", big(144)); // 1+3+10+30+100
    expect(useGameStore.getState().buyNode("goldsmith")).toBe(true);
    expect(useGameStore.getState().buyNode("patient_eye")).toBe(true);
    expect(useGameStore.getState().buyNode("second_slot")).toBe(true);
    expect(useGameStore.getState().buyNode("faster_strokes")).toBe(true);
    expect(useGameStore.getState().buyNode("better_brush")).toBe(true);
    expect(useGameStore.getState().fame.toNumber()).toBe(0);
    expect(useGameStore.getState().purchasedNodes).toEqual({
      goldsmith: true,
      patient_eye: true,
      second_slot: true,
      faster_strokes: true,
      better_brush: true,
    });
  });

  it("skipping ahead: buying second_slot before patient_eye returns false", () => {
    useGameStore.getState().add("fame", big(100));
    useGameStore.getState().buyNode("goldsmith");
    expect(useGameStore.getState().buyNode("second_slot")).toBe(false);
    expect(useGameStore.getState().purchasedNodes.second_slot).toBeUndefined();
  });

  it("buyNode('nonexistent' as SkillNodeId) returns false", () => {
    useGameStore.getState().add("fame", big(1000));
    expect(useGameStore.getState().buyNode("nonexistent" as SkillNodeId)).toBe(false);
    expect(useGameStore.getState().fame.toNumber()).toBe(1000);
  });

  it("hasNode returns true only for purchased nodes", () => {
    useGameStore.getState().add("fame", big(4));
    useGameStore.getState().buyNode("goldsmith");
    useGameStore.getState().buyNode("patient_eye");
    expect(hasNode(useGameStore.getState(), "goldsmith")).toBe(true);
    expect(hasNode(useGameStore.getState(), "patient_eye")).toBe(true);
    expect(hasNode(useGameStore.getState(), "second_slot")).toBe(false);
  });

  it("canBuyNode('goldsmith') returns false at fame=0, true at fame=1, false again after purchase", () => {
    expect(canBuyNode(useGameStore.getState(), "goldsmith")).toBe(false);
    useGameStore.getState().add("fame", big(1));
    expect(canBuyNode(useGameStore.getState(), "goldsmith")).toBe(true);
    useGameStore.getState().buyNode("goldsmith");
    expect(canBuyNode(useGameStore.getState(), "goldsmith")).toBe(false);
  });

  it("canBuyNode('patient_eye') returns false until goldsmith is owned", () => {
    useGameStore.getState().add("fame", big(100));
    expect(canBuyNode(useGameStore.getState(), "patient_eye")).toBe(false);
    useGameStore.getState().buyNode("goldsmith");
    expect(canBuyNode(useGameStore.getState(), "patient_eye")).toBe(true);
  });
});
