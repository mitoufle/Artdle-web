import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { canvasTickPure, PLAYER_ID } from "@/core/canvasTickPure";
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
    statsRun: { canvasesSold: 0, critsLanded: 0, goldEarned: big(0), currentCritStreak: 0, maxCritStreak: 0, maxComboChain: 0 } as DraftState["statsRun"],
    statsLifetime: { canvasesSold: 0, critsLanded: 0, maxComboChain: 0 } as DraftState["statsLifetime"],
    ...overrides,
  } as DraftState;
}

function worker(stats: Partial<DraftState["roster"][number]["stats"]> = {}) {
  const w = createWorker();
  return { ...w, stats: { ...w.stats, ...stats } };
}

describe("canvasTickPure — playerOnly (manual click-to-paint)", () => {
  beforeEach(() => vi.spyOn(rngModule, "rng").mockReturnValue(0.999)); // no crit, no combo
  afterEach(() => vi.restoreAllMocks());

  it("advances the player one chunk WITHOUT touching worker clocks or worker strokes", () => {
    const w = worker({ speed: 1 });
    w.strokesThisRun = 7;
    const d = makeDraft({
      roster: [w],
      // worker has 1.0s already accumulated toward its next stroke
      painterClocks: { [PLAYER_ID]: 0, [w.id]: 1.0 },
    });

    canvasTickPure(d, BASE_CHUNK_INTERVAL, { playerOnly: true });

    // Player painted exactly one chunk.
    expect(d.canvasProgress).toBe(1);
    // Worker did NOT stroke (no gold-bearing participation) ...
    expect(d.roster[0]!.strokesThisRun).toBe(7);
    // ... and its clock is preserved at its prior value — NOT advanced (the bug)
    // and NOT dropped/reset to 0 (the clock-merge bug).
    expect(d.painterClocks[w.id]).toBe(1.0);
  });

  it("for contrast: the normal (multi-painter) tick DOES advance the worker clock", () => {
    const w = worker({ speed: 1 });
    const d = makeDraft({
      roster: [w],
      painterClocks: { [PLAYER_ID]: 0, [w.id]: 1.0 },
    });

    // Advance by less than one stroke interval so nobody fires; clocks just move.
    canvasTickPure(d, 0.5);

    expect(d.painterClocks[w.id]).toBeCloseTo(1.5, 9);
  });
});
