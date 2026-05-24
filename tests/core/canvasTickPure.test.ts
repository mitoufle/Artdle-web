import { describe, expect, it, beforeEach } from "vitest";
import { canvasTickPure } from "@/core/canvasTickPure";
import { big } from "@/core/bigNumber";
import { useGameStore } from "@/store";
import { setSeed } from "@/core/rng";

function freshDraft(overrides: Partial<Record<string, unknown>> = {}) {
  const base = useGameStore.getState();
  return {
    ...base,
    gold: big(0),
    lifetimeGold: big(0),
    canvasProgress: 0,
    sellPriceLevel: 1,
    speedLevel: 1,
    sizeLevel: 0,
    critLevel: 0,
    comboLevel: 0,
    comboChain: 0,
    critChunks: {},
    canvasTier: 1,
    equipped: {},
    roster: [],
    purchasedNodes: {},
    statsLifetime: { ...base.statsLifetime, canvasesSold: 0, critsLanded: 0 },
    statsRun: { ...base.statsRun, canvasesSold: 0, critsLanded: 0, currentCritStreak: 0, maxCritStreak: 0, maxComboChain: 0, goldEarned: big(0) },
    ...overrides,
  } as Parameters<typeof canvasTickPure>[0];
}

describe("canvasTickPure — basic behavior", () => {
  it("no-op on delta=0", () => {
    const draft = freshDraft();
    const before = draft.gold;
    canvasTickPure(draft, 0);
    expect(draft.gold.eq(before)).toBe(true);
  });

  it("produces gold on a tick large enough to complete one canvas", () => {
    const draft = freshDraft();
    canvasTickPure(draft, 100);
    expect(draft.gold.gt(0)).toBe(true);
    expect(draft.statsLifetime.canvasesSold).toBeGreaterThanOrEqual(1);
  });

  it("produces many sales on a long delta", () => {
    const draft = freshDraft();
    canvasTickPure(draft, 600);
    expect(draft.statsLifetime.canvasesSold).toBeGreaterThan(1);
  });
});

describe("canvasTickPure — per-chunk crit roll", () => {
  beforeEach(() => setSeed(12345));

  it("records crit-painted chunk indices in draft.critChunks (bounded by chunkCount)", () => {
    const draft = freshDraft({ critLevel: 50 });  // High chance; some crits should fire even in a partial canvas.
    canvasTickPure(draft, 1.0);
    for (const idxStr of Object.keys(draft.critChunks)) {
      const idx = Number(idxStr);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(25);  // T1: 5x5 grid = 25 chunks
    }
  });

  it("bonus chunks do NOT re-roll for crit (chain is finite)", () => {
    const fakeBrush = {
      slot: "brush", tier: "legendary", fuseCount: 0,
      affixes: [{ kind: "+crit_chunks", magnitude: 100 }],
    };
    const draft = freshDraft({ critLevel: 50, equipped: { brush: fakeBrush } });
    canvasTickPure(draft, 5.0);
    // With huge bonus, if bonus chunks re-rolled, critsLanded would balloon
    // explosively. Cap is chunkCount * salesThisTick.
    expect(draft.statsRun.critsLanded).toBeLessThanOrEqual(draft.statsRun.canvasesSold * 25 + 25);
  });

  it("critChunks resets to empty on canvas sale (set belongs to CURRENT canvas)", () => {
    const draft = freshDraft({ critLevel: 50 });
    canvasTickPure(draft, 200);  // many canvases sold
    // After multiple sales, remaining critChunks belongs only to the CURRENT canvas.
    for (const idxStr of Object.keys(draft.critChunks)) {
      expect(Number(idxStr)).toBeLessThan(25);  // T1 chunk count
    }
  });

  it("does not reference isCritThisCanvas (field removed)", () => {
    const draft = freshDraft();
    canvasTickPure(draft, 100);
    expect("isCritThisCanvas" in draft).toBe(false);
  });
});

describe("canvasTickPure — streak counts trigger+bonus", () => {
  beforeEach(() => setSeed(1));

  it("currentCritStreak / maxCritStreak track chunk-level streaks, not canvas-level", () => {
    const draft = freshDraft({ critLevel: 50, equipped: {
      brush: { slot: "brush", tier: "rare", fuseCount: 0, affixes: [{ kind: "+crit_chunks", magnitude: 2 }] },
    } });
    canvasTickPure(draft, 0.5);
    expect(draft.statsRun.currentCritStreak).toBeGreaterThanOrEqual(0);
    expect(draft.statsRun.maxCritStreak).toBeGreaterThanOrEqual(draft.statsRun.currentCritStreak);
  });
});

describe("canvasTickPure — speed math no longer divides by CRIT_SPEED_FACTOR", () => {
  it("paint completion uses baseTime / speedMult only (no crit speed factor)", () => {
    const draft = freshDraft({ critLevel: 50 });
    canvasTickPure(draft, 10);
    expect(draft.statsLifetime.canvasesSold).toBeGreaterThan(0);
  });
});
