import { describe, it, expect } from "vitest";
import { canvasTickPure } from "@/core/canvasTickPure";
import { setSeed } from "@/core/rng";
import { big } from "@/core/bigNumber";
import type { DraftState } from "@/core/pureMutations";

// A solo draft with crit + combo levels high enough to actually exercise the
// crit/combo RNG paths (so the golden numbers are meaningful, not all-zero).
function soloDraft(): DraftState {
  return {
    canvasProgress: 0,
    canvasTier: 2,
    sellPriceLevel: 5, speedLevel: 3, critLevel: 30, comboLevel: 8,
    comboChain: 0,
    critChunks: {},
    painterClocks: {},
    lastSale: null,
    gold: big(0),
    lifetimeGold: big(0),
    equipped: {} as DraftState["equipped"],
    purchasedNodes: {} as DraftState["purchasedNodes"],
    roster: [] as DraftState["roster"],
    completedResearches: {} as DraftState["completedResearches"],
    completedAchievements: {} as DraftState["completedAchievements"],
    workshopLevel: 1,
    statsRun: {
      canvasesSold: 0, critsLanded: 0, goldEarned: big(0),
      currentCritStreak: 0, maxCritStreak: 0, maxComboChain: 0,
    } as DraftState["statsRun"],
    statsLifetime: {
      canvasesSold: 0, critsLanded: 0, maxComboChain: 0,
    } as DraftState["statsLifetime"],
  } as DraftState;
}

function runSolo(totalSeconds: number, step: number, seed = 0xC0FFEE) {
  setSeed(seed);
  const d = soloDraft();
  let t = 0;
  while (t < totalSeconds) {
    const s = Math.min(step, totalSeconds - t);
    canvasTickPure(d, s);
    t += s;
  }
  return {
    gold: d.gold.toNumber(),
    sales: d.statsRun.canvasesSold,
    crits: d.statsRun.critsLanded,
    maxCombo: d.statsRun.maxComboChain,
  };
}

// Placeholder — replaced in Step 2 with the captured values.
const FROZEN_SOLO_600_AT_0_1 = { gold: 1942.5, sales: 11, crits: 116, maxCombo: 1 };

describe("canvasTickPure — solo characterization (frozen golden master)", () => {
  // EQUIVALENCE GATE: these numbers are captured from the CURRENT single-painter
  // tick (Phase A2 HEAD). The Phase B rewrite MUST reproduce them exactly for an
  // empty roster. If the rewrite changes them, either fix the RNG-call order to
  // match, or add the roster.length===0 fast-path (plan Task 4).
  it("reproduces the frozen solo result over 600s at 0.1s steps", () => {
    const r = runSolo(600, 0.1);
    expect(r).toEqual(FROZEN_SOLO_600_AT_0_1);
  });
});

describe("canvasTickPure — step-size invariance (catch-up trustworthiness)", () => {
  // Below the per-tick sales cap, the same total sim time must yield the same
  // result regardless of step size — otherwise catch-up (10s/60s steps) diverges
  // from live play (~16ms steps). The MAX_SALES_PER_TICK cap is the one known
  // exception and is intentionally not exercised here (600s stays under it).
  it("0.1s, 1s, 5s, and 60s steps over 600s all agree", () => {
    const a = runSolo(600, 0.1);
    const b = runSolo(600, 1);
    const c = runSolo(600, 5);
    const e = runSolo(600, 60);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    expect(e).toEqual(a);
  });
});
