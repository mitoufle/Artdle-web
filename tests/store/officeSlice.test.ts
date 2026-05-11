import { describe, it, expect, beforeEach } from "vitest";
import { initialOfficeState, getRosterCap, getQueueCap, getOfficeTierCap, getClassUnlocked, getHireCost } from "@/store/officeSlice";
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

describe("tickOffice — trickle", () => {
  beforeEach(() => {
    useGameStore.setState({
      queue: [],
      trickleTimer: 0,
    });
  });

  it("at queue cap 0, no trickling occurs even when timer is overdue", () => {
    useGameStore.setState({
      purchasedNodes: {},
      officeLevel: 5,
      queue: [],
      trickleTimer: 999,
    });
    useGameStore.getState().tickOffice(10);
    expect(useGameStore.getState().queue.length).toBe(0);
  });
});

describe("getHireCost", () => {
  it("computes cost from tier, affix sum, and office level", () => {
    const state = { officeLevel: 0 } as GameStore;
    const candidate = {
      id: "x", class: "generalist" as const, tier: "common" as const,
      affixes: [{ kind: "+sell_price%" as const, magnitude: 5 }],
    };
    const cost = getHireCost(state, candidate);
    // common min-roll → tierBase × 1 × 1.10^0 = 100
    expect(cost.toNumber()).toBeCloseTo(100, 4);
  });
});

describe("hireFromQueue", () => {
  it("returns false if no roster slots available", () => {
    useGameStore.setState({
      purchasedNodes: {},
      queue: [{ id: "c1", class: "generalist" as const, tier: "common" as const, affixes: [{ kind: "+sell_price%" as const, magnitude: 10 }] }],
    });
    expect(useGameStore.getState().hireFromQueue("c1")).toBe(false);
    expect(useGameStore.getState().roster.length).toBe(0);
  });
});

describe("rejectFromQueue", () => {
  it("removes the candidate from the queue", () => {
    useGameStore.setState({
      queue: [
        { id: "c1", class: "generalist" as const, tier: "common" as const, affixes: [] },
        { id: "c2", class: "generalist" as const, tier: "common" as const, affixes: [] },
      ],
    });
    expect(useGameStore.getState().rejectFromQueue("c1")).toBe(true);
    expect(useGameStore.getState().queue.length).toBe(1);
    expect(useGameStore.getState().queue[0].id).toBe("c2");
  });
});

describe("fireWorker", () => {
  it("removes the worker from the roster", () => {
    useGameStore.setState({
      roster: [
        { id: "w1", class: "generalist" as const, tier: "common" as const, level: 5, xp: big(0), affixes: [] },
      ],
    });
    expect(useGameStore.getState().fireWorker("w1")).toBe(true);
    expect(useGameStore.getState().roster.length).toBe(0);
  });
});

describe("ascend integration — resetOffice wipes run-state, preserves meta", () => {
  it("ascending wipes queue + roster but keeps office.level + office.xp", () => {
    useGameStore.setState({
      inspiration: big(10000),
      officeLevel: 5,
      officeXp: big(123),
      queue: [{ id: "c1", class: "generalist" as const, tier: "common" as const, affixes: [] }],
      roster: [{ id: "w1", class: "generalist" as const, tier: "common" as const, level: 3, xp: big(50), affixes: [] }],
      trickleTimer: 10,
    });
    useGameStore.getState().performAscend();

    const s = useGameStore.getState();
    expect(s.officeLevel).toBe(5);
    expect(s.officeXp.eq(big(123))).toBe(true);
    expect(s.queue).toEqual([]);
    expect(s.roster).toEqual([]);
    expect(s.trickleTimer).toBe(0);
  });
});
