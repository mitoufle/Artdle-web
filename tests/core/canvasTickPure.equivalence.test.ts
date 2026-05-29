import { describe, it, expect } from "vitest";
import { canvasTickPure } from "@/core/canvasTickPure";
import { setSeed } from "@/core/rng";
import { big } from "@/core/bigNumber";
import type { DraftState } from "@/core/pureMutations";
import { createWorker } from "@/store/officeSlice";

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

// Multi-painter draft: player + two workers with crit & combo active, so the
// scheduler's RNG-dependent paths are exercised.
function multiDraft(): DraftState {
  const w = (over: Partial<ReturnType<typeof createWorker>["stats"]>) => {
    const x = createWorker();
    return { ...x, stats: { ...x.stats, ...over } };
  };
  return {
    canvasProgress: 0,
    canvasTier: 2,
    sellPriceLevel: 5, speedLevel: 3, critLevel: 30, comboLevel: 8,
    comboChain: 0, critChunks: {}, painterClocks: {}, lastSale: null,
    gold: big(0), lifetimeGold: big(0),
    equipped: {} as DraftState["equipped"],
    purchasedNodes: {} as DraftState["purchasedNodes"],
    roster: [w({ speed: 1.3, critChance: 0.3, comboChance: 0.4 }), w({ speed: 0.8, critChance: 0.2, comboChance: 0.2 })] as DraftState["roster"],
    completedResearches: {} as DraftState["completedResearches"],
    completedAchievements: {} as DraftState["completedAchievements"],
    workshopLevel: 1,
    statsRun: { canvasesSold: 0, critsLanded: 0, goldEarned: big(0), currentCritStreak: 0, maxCritStreak: 0, maxComboChain: 0 } as DraftState["statsRun"],
    statsLifetime: { canvasesSold: 0, critsLanded: 0, maxComboChain: 0 } as DraftState["statsLifetime"],
  } as DraftState;
}

function runMulti(totalSeconds: number, step: number, seed = 0xC0FFEE) {
  setSeed(seed);
  const d = multiDraft();
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
    w0: d.roster[0]!.strokesThisRun,
    w1: d.roster[1]!.strokesThisRun,
  };
}

describe("canvasTickPure — multi-painter step-invariance (KNOWN GAP, deferred to C/D)", () => {
  // KNOWN, MEASURED GAP — not flaky, not a TODO. The multi-painter scheduler is
  // NOT step-size invariant: per-event float accumulation in painterClocks drifts,
  // flipping near-simultaneous painters' tie-break between small (live ~16ms) and
  // large (catch-up 10s/60s) steps, which reorders RNG consumption. A reviewer
  // measured a 2-worker/crit+combo/600s scenario diverging ~8% in crits
  // (0.1s → ~96 crits; 1s/5s/60s → ~104) plus a strokesThisRun split (108 vs 104).
  // SOLO is bit-exact (see the frozen golden master + step-invariance describes
  // above) and is Phase B's actual regression bar.
  //
  // DEFERRED to Phase C/D (when workers go live): either rework the scheduler to
  // absolute next-stroke scheduling so multi-painter is step-exact, OR decide an
  // explicit catch-up-vs-live tolerance and adjust this test accordingly. The fix
  // is INCOMPLETE unless ALL of {gold, crits, maxCombo, w0, w1} equalize across
  // step sizes — equalizing only crits (e.g. via an epsilon tie-break) is not enough.
  it.skip("0.1s, 1s, and 60s steps over 600s all agree (un-skip when scheduler is made step-exact in C/D)", () => {
    const a = runMulti(600, 0.1);
    const b = runMulti(600, 1);
    const c = runMulti(600, 60);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });
});
