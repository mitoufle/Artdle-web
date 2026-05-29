import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { canvasTickPure } from "@/core/canvasTickPure";
import { BASE_CHUNK_INTERVAL, CANVAS_GOLD_BASE } from "@/core/balance";
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
    statsRun: { canvasesSold: 0, critsLanded: 0, goldEarned: big(0), currentCritStreak: 0, maxCritStreak: 0, maxComboChain: 0 } as DraftState["statsRun"],
    statsLifetime: { canvasesSold: 0, critsLanded: 0, maxComboChain: 0 } as DraftState["statsLifetime"],
    ...overrides,
  } as DraftState;
}

function worker(stats: Partial<DraftState["roster"][number]["stats"]>) {
  const w = createWorker();
  return { ...w, stats: { ...w.stats, ...stats } };
}

describe("canvasTickPure — multi-painter", () => {
  beforeEach(() => vi.spyOn(rngModule, "rng").mockReturnValue(0.999)); // no crit, no combo
  afterEach(() => vi.restoreAllMocks());

  it("a worker at base speed adds strokes alongside the player (canvas fills faster)", () => {
    const solo = makeDraft();
    canvasTickPure(solo, BASE_CHUNK_INTERVAL);
    expect(solo.canvasProgress).toBe(1);

    const duo = makeDraft({ roster: [worker({ speed: 1 })] });
    canvasTickPure(duo, BASE_CHUNK_INTERVAL);
    expect(duo.canvasProgress).toBe(2); // two painters → two chunks at the boundary
  });

  it("increments strokesThisRun per worker (not the player)", () => {
    const d = makeDraft({ roster: [worker({ speed: 1 })] });
    canvasTickPure(d, BASE_CHUNK_INTERVAL * 3);
    expect(d.roster[0]!.strokesThisRun).toBeGreaterThanOrEqual(2);
  });

  it("applies workerGoldFactor to sale gold (∏(1+goldPct))", () => {
    const d = makeDraft({ roster: [worker({ speed: 1, goldPct: 0.5 })] });
    canvasTickPure(d, BASE_CHUNK_INTERVAL * 5); // ~10 chunks across 2 painters → 1 T1 canvas
    expect(d.statsRun.canvasesSold).toBe(1);
    expect(d.gold.toNumber()).toBeCloseTo(CANVAS_GOLD_BASE * 1.5, 5); // 15
  });

  it("worker strokes do NOT perturb player crit-streak stats (Phase B: player-only)", () => {
    vi.restoreAllMocks();
    vi.spyOn(rngModule, "rng").mockReturnValue(0.0001); // everyone crits
    const d = makeDraft({ critLevel: 0, roster: [worker({ speed: 1, critChance: 0.5, strokesPerCrit: 1 })] });
    canvasTickPure(d, BASE_CHUNK_INTERVAL * 2);
    // critsLanded counts ONLY player crit chunks (player base = 1 trigger + 1 bonus = 2 per crit).
    expect(d.statsRun.critsLanded).toBeGreaterThan(0);
    expect(d.statsRun.critsLanded % 2).toBe(0); // multiple of player's per-crit count; no worker contribution
  });

  it("the completing painter's combo base drives the chain (witnessed by combo gold)", () => {
    // Worker has 100% combo base, player 0%. Witness via gold: with NO combo every
    // sale pays exactly CANVAS_GOLD_BASE (=10 at T1, workerGoldFactor 1 since goldPct 0),
    // so gold > canvasesSold × 10 iff a sale fired at chain > 0 — only the worker's
    // combo base can cause that here. (Interleave-proof; comboChain/maxComboChain can't witness it.)
    vi.restoreAllMocks();
    vi.spyOn(rngModule, "rng").mockReturnValue(0.4); // no crit (0.4<0.01 false); combo 0.4<~1.0 → chain grows
    const d = makeDraft({ critLevel: 0, comboLevel: 0, roster: [worker({ speed: 5, comboChance: 1.0 })] });
    canvasTickPure(d, BASE_CHUNK_INTERVAL * 6);
    expect(d.statsRun.canvasesSold).toBeGreaterThanOrEqual(2);
    expect(d.gold.toNumber()).toBeGreaterThan(d.statsRun.canvasesSold * 10);
  });
});
