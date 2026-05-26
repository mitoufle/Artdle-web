import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { canvasTickPure } from "@/core/canvasTickPure";
import { BASE_CHUNK_INTERVAL } from "@/core/balance";
import { big } from "@/core/bigNumber";
import * as rngModule from "@/core/rng";
import type { DraftState } from "@/core/pureMutations";

// Minimal stub helper to construct a draft with chunk-domain defaults.
function makeDraft(overrides: Partial<DraftState> = {}): DraftState {
  return {
    canvasProgress: 0,
    canvasTier: 1,
    sellPriceLevel: 0, speedLevel: 0, critLevel: 0, comboLevel: 0,
    comboChain: 0,
    critChunks: {},
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
      canvasesSold: 0, critsLanded: 0,
      maxComboChain: 0,
    } as DraftState["statsLifetime"],
    officeXp: big(0), officeLevel: 1,
    ...overrides,
  } as DraftState;
}

describe("canvasTickPure (chunk-domain)", () => {
  beforeEach(() => {
    // Disable crit/combo for these tests
    vi.spyOn(rngModule, "rng").mockReturnValue(0.999);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("no-op on zero delta", () => {
    const draft = makeDraft();
    canvasTickPure(draft, 0);
    expect(draft.canvasProgress).toBe(0);
  });

  it("advances canvasProgress by delta / chunkInterval", () => {
    const draft = makeDraft();
    canvasTickPure(draft, BASE_CHUNK_INTERVAL); // 1 chunk's worth at speed=1
    expect(draft.canvasProgress).toBeCloseTo(1, 5);
  });

  it("partial chunk progress is preserved as fractional canvasProgress", () => {
    const draft = makeDraft();
    canvasTickPure(draft, BASE_CHUNK_INTERVAL / 2); // half a chunk
    expect(draft.canvasProgress).toBeCloseTo(0.5, 5);
  });

  it("fires a sale on the chunk that completes the canvas at T1 (10 chunks)", () => {
    const draft = makeDraft();
    canvasTickPure(draft, BASE_CHUNK_INTERVAL * 10);
    expect(draft.statsRun.canvasesSold).toBe(1);
    expect(draft.canvasProgress).toBeCloseTo(0, 5); // reset after sale
    expect(draft.lastSale).not.toBeNull();
  });

  it("does NOT credit gold mid-canvas (lump sum at sale only)", () => {
    // T1 takes 10 chunks. After 5 chunks the canvas is half-painted but no
    // gold has been earned — gold is paid as a single sale on chunk 10.
    const draft = makeDraft();
    canvasTickPure(draft, BASE_CHUNK_INTERVAL * 5);
    expect(draft.gold.toNumber()).toBe(0);
    expect(draft.statsRun.canvasesSold).toBe(0);
    expect(draft.canvasProgress).toBeCloseTo(5, 5);
  });

  it("credits full canvas gold once the canvas completes across two ticks", () => {
    const draft = makeDraft();
    canvasTickPure(draft, BASE_CHUNK_INTERVAL * 7); // 7 chunks, still no gold
    expect(draft.gold.toNumber()).toBe(0);
    canvasTickPure(draft, BASE_CHUNK_INTERVAL * 3); // 3 more chunks → sale fires
    expect(draft.gold.toNumber()).toBeCloseTo(10, 5);
    expect(draft.statsRun.canvasesSold).toBe(1);
  });

  it("click-paint: passing exactly chunkInterval advances 1 chunk", () => {
    const draft = makeDraft();
    canvasTickPure(draft, BASE_CHUNK_INTERVAL);
    expect(Math.floor(draft.canvasProgress)).toBe(1);
  });

  it("T2 takes 20 chunks", () => {
    const draft = makeDraft({ canvasTier: 2 });
    canvasTickPure(draft, BASE_CHUNK_INTERVAL * 19);
    expect(draft.statsRun.canvasesSold).toBe(0);
    canvasTickPure(draft, BASE_CHUNK_INTERVAL);
    expect(draft.statsRun.canvasesSold).toBe(1);
  });

  it("statsRun.goldEarned only updates on canvas-sale (matches lump-sum gold)", () => {
    const draft = makeDraft();
    canvasTickPure(draft, BASE_CHUNK_INTERVAL * 5); // 5 chunks, no sale
    expect(draft.statsRun.goldEarned.toNumber()).toBe(0);
    canvasTickPure(draft, BASE_CHUNK_INTERVAL * 5); // 5 more → sale fires
    expect(draft.statsRun.goldEarned.toNumber()).toBeCloseTo(10, 5);
  });
});

describe("canvasTickPure crit", () => {
  beforeEach(() => {
    vi.spyOn(rngModule, "rng").mockReturnValue(0.0001); // always crit
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("crit advances canvas faster (no extra gold mid-canvas)", () => {
    const draft = makeDraft();
    canvasTickPure(draft, BASE_CHUNK_INTERVAL);
    // Trigger chunk (chunk 0) + BASE_CRIT_CHUNKS=1 free bonus chunk = 2 chunks
    // of progress against a 10-chunk T1 canvas. No sale yet, no gold yet.
    expect(draft.canvasProgress).toBeCloseTo(2, 5);
    expect(draft.gold.toNumber()).toBe(0);
    expect(Object.keys(draft.critChunks).length).toBe(2);
  });

  it("crit on second-to-last chunk completes the canvas and fires one sale", () => {
    // Seed progress to chunk 8 of 10 — next chunk paid will be chunk 8 (the
    // 9th, NOT the last; crit can fire). With BASE_CRIT_CHUNKS=1, the bonus
    // (chunk 9) completes the canvas → exactly one sale, one canvas of gold.
    const draft = makeDraft({ canvasProgress: 8 });
    canvasTickPure(draft, BASE_CHUNK_INTERVAL);
    expect(draft.statsRun.canvasesSold).toBe(1);
    expect(draft.gold.toNumber()).toBeCloseTo(10, 5);
  });
});
