import { describe, it, expect } from "vitest";
import { initialOfficeState, getRosterCap, getQueueCap, getOfficeTierCap, getClassUnlocked } from "@/store/officeSlice";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";
import type { GameStore } from "@/store";

describe("officeSlice — initial state", () => {
  it("level = 0, xp = big(0)", () => {
    expect(initialOfficeState.officeLevel).toBe(0);
    expect(initialOfficeState.officeXp.eq(big(0))).toBe(true);
  });

  it("queue + roster + trickleTimer empty/zero", () => {
    expect(initialOfficeState.queue).toEqual([]);
    expect(initialOfficeState.roster).toEqual([]);
    expect(initialOfficeState.trickleTimer).toBe(0);
  });
});

describe("officeSlice — wired into GameStore", () => {
  it("store has officeLevel + officeXp on first read", () => {
    const s = useGameStore.getState();
    expect(typeof s.officeLevel).toBe("number");
    expect(s.officeXp).toBeDefined();
  });
});

describe("getRosterCap / getQueueCap — sum capability levels", () => {
  it("returns 0 when no nodes with roster_slot are purchased", () => {
    const state = { purchasedNodes: {} } as GameStore;
    expect(getRosterCap(state)).toBe(0);
    expect(getQueueCap(state)).toBe(0);
  });

  // More integration tests added in Task 18 once SkillDesigner has the chips.
});

describe("getOfficeTierCap", () => {
  it("returns common at L1", () => {
    const state = { officeLevel: 1 } as GameStore;
    expect(getOfficeTierCap(state)).toBe("common");
  });
  it("returns magic at L3", () => {
    const state = { officeLevel: 3 } as GameStore;
    expect(getOfficeTierCap(state)).toBe("magic");
  });
  it("returns legendary at L40+", () => {
    const state = { officeLevel: 100 } as GameStore;
    expect(getOfficeTierCap(state)).toBe("legendary");
  });
});

describe("getClassUnlocked", () => {
  it("generalist always unlocked", () => {
    const state = { purchasedNodes: {} } as GameStore;
    expect(getClassUnlocked(state, "generalist")).toBe(true);
  });
  it("goldsmith requires class_goldsmith capability", () => {
    const state = { purchasedNodes: {} } as GameStore;
    expect(getClassUnlocked(state, "goldsmith")).toBe(false);
  });
});
