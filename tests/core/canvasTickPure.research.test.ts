import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { canvasTickPure } from "@/core/canvasTickPure";
import { BASE_CHUNK_INTERVAL } from "@/core/balance";
import { big } from "@/core/bigNumber";
import { createWorker } from "@/store/officeSlice";
import * as rngModule from "@/core/rng";
import type { DraftState } from "@/core/pureMutations";

function makeDraft(overrides: Partial<DraftState> = {}): DraftState {
  return {
    canvasProgress: 0, canvasTier: 1,
    sellPriceLevel: 0, speedLevel: 0, critLevel: 0, comboLevel: 0,
    comboChain: 0, critChunks: {}, painterClocks: {}, lastSale: null,
    gold: big(0), lifetimeGold: big(0),
    equipped: {} as DraftState["equipped"],
    purchasedNodes: {} as DraftState["purchasedNodes"],
    roster: [] as DraftState["roster"],
    completedResearches: {} as DraftState["completedResearches"],
    completedAchievements: {} as DraftState["completedAchievements"],
    workshopLevel: 1,
    collaborativeStrokeAcc: 0,
    activeResearch: null,
    statsRun: { canvasesSold: 0, critsLanded: 0, goldEarned: big(0), currentCritStreak: 0, maxCritStreak: 0, maxComboChain: 0 } as DraftState["statsRun"],
    statsLifetime: { canvasesSold: 0, critsLanded: 0, maxComboChain: 0 } as DraftState["statsLifetime"],
    ...overrides,
  } as DraftState;
}

function worker(speed: number) {
  const w = createWorker();
  return { ...w, stats: { ...w.stats, speed } };
}

describe("canvasTickPure — School research acceleration", () => {
  beforeEach(() => vi.spyOn(rngModule, "rng").mockReturnValue(0.999)); // no crit/combo
  afterEach(() => vi.restoreAllMocks());

  it("Sponsoring: cuts 1s off the active research per canvas sold", () => {
    const draft = makeDraft({
      purchasedNodes: { Sponsoring: 1 },
      activeResearch: { id: "x", remainingSeconds: 10000 },
    });
    canvasTickPure(draft, BASE_CHUNK_INTERVAL * 60);
    const sold = draft.statsRun.canvasesSold;
    expect(sold).toBeGreaterThan(0);
    expect(draft.activeResearch!.remainingSeconds).toBe(10000 - sold);
  });

  it("Sponsoring: no effect when no research is active", () => {
    const draft = makeDraft({ purchasedNodes: { Sponsoring: 1 }, activeResearch: null });
    canvasTickPure(draft, BASE_CHUNK_INTERVAL * 60);
    expect(draft.activeResearch).toBeNull();
  });

  it("does nothing without the nodes (research untouched)", () => {
    const draft = makeDraft({ activeResearch: { id: "x", remainingSeconds: 500 } });
    canvasTickPure(draft, BASE_CHUNK_INTERVAL * 60);
    expect(draft.activeResearch!.remainingSeconds).toBe(500);
  });

  it("Collaborative Research: every 10 worker-#1 strokes cuts 1s, carrying the remainder", () => {
    const draft = makeDraft({
      roster: [worker(1)],
      purchasedNodes: { collaborative_research: 1 },
      activeResearch: { id: "x", remainingSeconds: 10000 },
    });
    canvasTickPure(draft, BASE_CHUNK_INTERVAL * 100);
    const w1Strokes = draft.roster[0]!.strokesThisRun; // started at 0
    expect(w1Strokes).toBeGreaterThan(10);
    expect(draft.activeResearch!.remainingSeconds).toBe(10000 - Math.floor(w1Strokes / 10));
    expect(draft.collaborativeStrokeAcc).toBe(w1Strokes % 10);
  });

  it("Collaborative Research: the stroke remainder carries across ticks", () => {
    const draft = makeDraft({
      roster: [worker(1)],
      purchasedNodes: { collaborative_research: 1 },
      activeResearch: { id: "x", remainingSeconds: 10000 },
    });
    canvasTickPure(draft, BASE_CHUNK_INTERVAL * 7);
    canvasTickPure(draft, BASE_CHUNK_INTERVAL * 7);
    const totalStrokes = draft.roster[0]!.strokesThisRun;
    // Cumulative reduction must equal floor(total/10) thanks to the carry.
    expect(draft.activeResearch!.remainingSeconds).toBe(10000 - Math.floor(totalStrokes / 10));
    expect(draft.collaborativeStrokeAcc).toBe(totalStrokes % 10);
  });

  it("Sponsoring keeps big-tick == small-tick equivalence (gold + research time)", () => {
    const DELTA = BASE_CHUNK_INTERVAL * 30;
    const seed = { purchasedNodes: { Sponsoring: 1 }, activeResearch: { id: "x", remainingSeconds: 1_000_000 } };

    const bigT = makeDraft(seed);
    canvasTickPure(bigT, DELTA);

    const small = makeDraft(seed);
    for (let i = 0; i < 30; i++) canvasTickPure(small, BASE_CHUNK_INTERVAL);

    expect(small.gold.toNumber()).toBeCloseTo(bigT.gold.toNumber(), 6);
    expect(small.statsRun.canvasesSold).toBe(bigT.statsRun.canvasesSold);
    expect(small.activeResearch!.remainingSeconds).toBe(bigT.activeResearch!.remainingSeconds);
  });
});
