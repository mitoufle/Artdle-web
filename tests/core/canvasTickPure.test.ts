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

  it("credits gold per chunk, not per canvas", () => {
    // T1 base: 10 gold per canvas. 5 chunks = 5 gold credited.
    const draft = makeDraft();
    canvasTickPure(draft, BASE_CHUNK_INTERVAL * 5);
    expect(draft.gold.toNumber()).toBeCloseTo(5, 5);
  });

  it("credits full canvas gold across two ticks", () => {
    const draft = makeDraft();
    canvasTickPure(draft, BASE_CHUNK_INTERVAL * 7); // 7 chunks
    canvasTickPure(draft, BASE_CHUNK_INTERVAL * 3); // 3 more chunks → sale
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

  it("statsRun.goldEarned tracks per-chunk drip, not just per-sale", () => {
    const draft = makeDraft();
    canvasTickPure(draft, BASE_CHUNK_INTERVAL * 5); // 5 chunks, no sale yet
    expect(draft.gold.toNumber()).toBeCloseTo(5, 5);
    expect(draft.statsRun.goldEarned.toNumber()).toBeCloseTo(5, 5);
  });
});

describe("canvasTickPure crit", () => {
  beforeEach(() => {
    vi.spyOn(rngModule, "rng").mockReturnValue(0.0001); // always crit
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("crit paints trigger + bonus chunks instantly (free gold)", () => {
    const draft = makeDraft();
    canvasTickPure(draft, BASE_CHUNK_INTERVAL);
    // Trigger chunk (1) + BASE_CRIT_CHUNKS (1) = 2 chunks credited
    expect(draft.gold.toNumber()).toBeCloseTo(2, 5);
    expect(Object.keys(draft.critChunks).length).toBe(2);
  });

  it("bonus chunks spill across canvas boundaries (no crit benefit wasted)", () => {
    // Start at chunk 9 of 10 with always-crit. The trigger rolls on chunk 9
    // (the second-to-last; last-chunk skips crit), so this test relies on
    // T1's last-chunk-no-crit rule by setting up at chunk 8 then paying the
    // critting chunk. We seed progress directly to chunk 8 (so the next
    // paid chunk is chunk 8 — the 9th in 0-indexed, which is NOT the last).
    const draft = makeDraft({ canvasProgress: 8 });
    canvasTickPure(draft, BASE_CHUNK_INTERVAL);
    // Chunk 8 fires crit. Trigger (chunk 8) + 1 bonus (chunk 9 — completes
    // canvas, fires sale, resets progress to 0). With BASE_CRIT_CHUNKS=1
    // the bonus stops after one chunk, having spilled the sale boundary.
    expect(draft.statsRun.canvasesSold).toBe(1);
    expect(draft.gold.toNumber()).toBeCloseTo(2, 5);
  });
});
