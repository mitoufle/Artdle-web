import { describe, it, expect } from "vitest";
import { initialOfficeState } from "@/store/officeSlice";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

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
