import { describe, expect, it } from "vitest";
import { workshopTickPure } from "@/core/workshopTickPure";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

describe("workshopTickPure", () => {
  it("no-op when taylorism not purchased", () => {
    const base = useGameStore.getState();
    const draft = {
      ...base,
      purchasedNodes: {},
      autoCraftTimer: 0,
      inventory: [],
    } as any;
    workshopTickPure(draft, 60);
    expect(draft.autoCraftTimer).toBe(0);
    expect(draft.inventory.length).toBe(0);
  });

  it("no-op when autoCraft disabled", () => {
    const base = useGameStore.getState();
    const draft = {
      ...base,
      purchasedNodes: { taylorsim: 1 },
      autoCraftEnabled: false,
      autoCraftTimer: 0,
      inventory: [],
    } as any;
    workshopTickPure(draft, 60);
    expect(draft.inventory.length).toBe(0);
  });

  it("crafts items when interval crosses and gold suffices", () => {
    const base = useGameStore.getState();
    // "brush" slot is unlocked by default — no extra node needed for slot picking.
    const draft = {
      ...base,
      purchasedNodes: { taylorsim: 1 },
      autoCraftEnabled: true,
      autoCraftTimer: 0,
      gold: big(1_000_000),
      inventory: [],
      equipped: {},
      protectedTiers: {},
      workshopLevel: 1,
      workshopXp: 0,
    } as any;
    workshopTickPure(draft, 60); // 6 intervals at TAYLORISM_INTERVAL_S=10s
    expect(draft.inventory.length).toBeGreaterThan(0);
  });
});
