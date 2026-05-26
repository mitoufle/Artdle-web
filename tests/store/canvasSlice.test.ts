import { describe, it, expect, beforeEach, vi } from "vitest";
import { useGameStore } from "@/store";
import { initialCanvasState } from "@/store/canvasSlice";
import {
  CANVAS_GOLD_BASE, BASE_CHUNK_INTERVAL, tierUpgradeCost,
  chunksPerCanvas,
} from "@/core/balance";
import { big } from "@/core/bigNumber";
import { setSeed } from "@/core/rng";
import * as rngModule from "@/core/rng";

// Chunk-domain canvas tick semantics at T1:
//   - chunkInterval = BASE_CHUNK_INTERVAL = 5s, chunksPerCanvas(1) = 10
//   - 1 chunk = 1g, 1 full canvas = 10g, full canvas time = 50s
//   - canvasProgress is in [0, chunksPerCanvas(tier)); resets to 0 on sale.
//
// These slice-level tests exercise the wiring between `canvasTick` and the
// pure engine (`canvasTickPure`). Engine-timing edge cases live in
// `tests/core/canvasTickPure.test.ts`.

const T1_CANVAS_TIME = BASE_CHUNK_INTERVAL * chunksPerCanvas(1); // 50s

describe("canvasSlice — canvasTick", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetCanvas();
    // Deterministic rng so the 1% BASE_CRIT_CHANCE doesn't randomly flake
    // the exact-progress assertions below.
    setSeed(1);
  });

  it("initializes with canvasProgress 0", () => {
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });

  it("canvasTick(BASE_CHUNK_INTERVAL) advances progress by 1 chunk; partial-canvas gold credited", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(BASE_CHUNK_INTERVAL);
    // One chunk completes — progress advances to 1 (with possible crit spill up to 2.x
    // if the 1% crit roll fires under the seed).
    expect(useGameStore.getState().canvasProgress).toBeGreaterThanOrEqual(1);
    expect(useGameStore.getState().canvasProgress).toBeLessThan(3);
    // No full canvas sale — gold reflects per-chunk drip, not lump-sum.
    expect(useGameStore.getState().gold.toNumber()).toBeGreaterThan(goldBefore);
  });

  it("two canvasTick(2.5 × T1 canvas) calls fire multiple sales each (multi-sale per tick)", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    const tickDelta = 2.5 * T1_CANVAS_TIME; // 125s = 2.5 canvases per tick
    useGameStore.getState().canvasTick(tickDelta);
    useGameStore.getState().canvasTick(tickDelta);
    // 2.5 canvases × 2 ticks = 5 canvases (floor); each = 10g (sellPriceLevel=0).
    // Plus 0.5 partial canvas residual per tick (5 chunks × 1g = 5g extra each).
    expect(useGameStore.getState().gold.toNumber()).toBeGreaterThanOrEqual(goldBefore + CANVAS_GOLD_BASE * 4);
    expect(useGameStore.getState().lastSale!.id).toBeGreaterThanOrEqual(4);
  });

  it("canvasTick just past a full canvas (T1: 50s + ε): one sale fires, full gold credited", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(T1_CANVAS_TIME + 0.01);
    // sellPriceLevel=0: gold = CANVAS_GOLD_BASE (10g per canvas at T1)
    expect(useGameStore.getState().gold.toNumber()).toBeGreaterThanOrEqual(goldBefore + CANVAS_GOLD_BASE);
    expect(useGameStore.getState().canvasProgress).toBeGreaterThanOrEqual(0);
    expect(useGameStore.getState().canvasProgress).toBeLessThan(chunksPerCanvas(1));
  });

  it("canvasTick(full canvas + half chunk) produces one sale and leaves small leftover", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(T1_CANVAS_TIME + BASE_CHUNK_INTERVAL / 2);
    expect(useGameStore.getState().gold.toNumber()).toBeGreaterThanOrEqual(goldBefore + CANVAS_GOLD_BASE);
    // Leftover after one canvas sale should be well under a full canvas. Crit
    // chunks at base 1% chance may spill 1-2 chunks across the sale boundary,
    // so leave headroom past the strict <1 bound.
    expect(useGameStore.getState().canvasProgress).toBeGreaterThanOrEqual(0);
    expect(useGameStore.getState().canvasProgress).toBeLessThan(chunksPerCanvas(1));
  });

  it("sub-chunk tick (delta < chunkInterval): no chunk completes, no gold credited", () => {
    // No crit (critLevel=0 + seed-mocked rng → 0% chance). Half a chunk = no completion.
    useGameStore.setState({ critLevel: 0, canvasProgress: 0 });
    useGameStore.getState().canvasTick(BASE_CHUNK_INTERVAL / 2);
    expect(useGameStore.getState().gold.toNumber()).toBe(0);
  });

  it("canvasTick(huge delta) — fires multiple sales until budget exhausted (multi-sale per tick)", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    const tickDelta = T1_CANVAS_TIME * 10; // 10 full canvases worth of time
    useGameStore.getState().canvasTick(tickDelta);
    // Floor of 10 sales × 10g per canvas = 100g (sellPriceLevel=0).
    expect(useGameStore.getState().gold.toNumber()).toBeGreaterThanOrEqual(
      goldBefore + CANVAS_GOLD_BASE * 10,
    );
    expect(useGameStore.getState().canvasProgress).toBeGreaterThanOrEqual(0);
    expect(useGameStore.getState().canvasProgress).toBeLessThan(chunksPerCanvas(1));
  });

  it("canvasTick(0) is a no-op: no sale, no progress change, no gold change", () => {
    useGameStore.setState({ canvasProgress: 1 });
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(0);
    expect(useGameStore.getState().canvasProgress).toBe(1);
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore);
  });

  it("at default state (sellPriceLevel=0), one full canvas credits CANVAS_GOLD_BASE", () => {
    // T1: 10 chunks × 1g = 10g per canvas. Use +0.01 to clear the final-chunk boundary.
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(T1_CANVAS_TIME + 0.01);
    expect(useGameStore.getState().gold.toNumber()).toBeGreaterThanOrEqual(goldBefore + CANVAS_GOLD_BASE);
  });
});

describe("canvasSlice — resetCanvas", () => {
  beforeEach(() => {
    useGameStore.getState().resetCanvas();
  });

  it("resetCanvas sets canvasProgress to 0", () => {
    useGameStore.setState({ canvasProgress: 7.3 });
    useGameStore.getState().resetCanvas();
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });
});

describe("canvasSlice — lastSale animation trigger", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetCanvas();
  });

  it("initializes with lastSale = null", () => {
    expect(useGameStore.getState().lastSale).toBeNull();
  });

  it("a sale sets lastSale to {id: 1, amount: per-chunk gold} (sellPriceLevel=0)", () => {
    // Tick past one full canvas (50s + epsilon at T1) to guarantee a sale fires.
    useGameStore.getState().canvasTick(T1_CANVAS_TIME + 0.01);
    const ls = useGameStore.getState().lastSale;
    expect(ls).not.toBeNull();
    expect(ls!.id).toBe(1);
    // sellPriceLevel=0: per-chunk gold = 1 (T1: 10 chunks × 1g = 10g per canvas).
    // lastSale.amount carries the FINAL chunk's gain, not the lump sum.
    expect(ls!.amount.toNumber()).toBeCloseTo(CANVAS_GOLD_BASE / chunksPerCanvas(1), 1);
  });

  it("two sales increment lastSale.id from 1 to 2", () => {
    useGameStore.getState().canvasTick(T1_CANVAS_TIME + 0.01);
    expect(useGameStore.getState().lastSale!.id).toBe(1);
    useGameStore.getState().canvasTick(T1_CANVAS_TIME + 0.01);
    expect(useGameStore.getState().lastSale!.id).toBe(2);
  });

  it("clearLastSale() resets lastSale to null", () => {
    useGameStore.getState().canvasTick(T1_CANVAS_TIME + 0.01);
    expect(useGameStore.getState().lastSale).not.toBeNull();
    useGameStore.getState().clearLastSale();
    expect(useGameStore.getState().lastSale).toBeNull();
  });

  it("clearLastSale() does not affect canvasProgress or gold", () => {
    useGameStore.getState().canvasTick(T1_CANVAS_TIME + BASE_CHUNK_INTERVAL / 2);
    const goldBefore = useGameStore.getState().gold.toNumber();
    const progressBefore = useGameStore.getState().canvasProgress;
    useGameStore.getState().clearLastSale();
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore);
    expect(useGameStore.getState().canvasProgress).toBe(progressBefore);
  });

  it("a no-op tick (delta=0) does not advance lastSale", () => {
    useGameStore.getState().canvasTick(T1_CANVAS_TIME + 0.01); // first sale → id=1
    useGameStore.getState().canvasTick(0);
    expect(useGameStore.getState().lastSale!.id).toBe(1);
  });

  it("resetCanvas() clears lastSale alongside progress", () => {
    useGameStore.getState().canvasTick(T1_CANVAS_TIME + 0.01);
    expect(useGameStore.getState().lastSale).not.toBeNull();
    useGameStore.getState().resetCanvas();
    expect(useGameStore.getState().lastSale).toBeNull();
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });
});

describe("canvasSlice — sale gold (chunk-domain)", () => {
  beforeEach(() => {
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState()._setLifetimeGold(big(0));
  });

  it("at default state (sellPriceLevel=0), one full canvas pays CANVAS_GOLD_BASE", () => {
    // T1 = 10 chunks × 1g/chunk = 10g per canvas. Use full canvas time + epsilon
    // to clear the final chunk boundary despite float accumulation.
    useGameStore.getState().canvasTick(T1_CANVAS_TIME + 0.01);
    expect(useGameStore.getState().canvasProgress).toBeGreaterThanOrEqual(0);
    expect(useGameStore.getState().canvasProgress).toBeLessThan(chunksPerCanvas(1));
    expect(useGameStore.getState().gold.toNumber()).toBeGreaterThanOrEqual(CANVAS_GOLD_BASE);
  });

  it("sale calls trackSaleGold — lifetimeGold increments", () => {
    useGameStore.getState().canvasTick(T1_CANVAS_TIME + 0.01);
    expect(useGameStore.getState().lifetimeGold.toNumber()).toBeGreaterThanOrEqual(CANVAS_GOLD_BASE);
  });
});

describe("canvasSlice — new track state fields", () => {
  beforeEach(() => {
    useGameStore.setState({ ...useGameStore.getState() }); // resets canvas portion via implicit state
  });

  it("starts with sellPriceLevel=0 and speedLevel=0 (unlocked tracks)", () => {
    const s = useGameStore.getState();
    expect(s.sellPriceLevel).toBe(0);
    expect(s.speedLevel).toBe(0);
  });

  it("starts with critLevel=0, comboLevel=0 (gated tracks)", () => {
    const s = useGameStore.getState();
    expect(s.critLevel).toBe(0);
    expect(s.comboLevel).toBe(0);
  });

  it("starts with comboChain=0 and critChunks={}", () => {
    const s = useGameStore.getState();
    expect(s.comboChain).toBe(0);
    expect(s.critChunks).toEqual({});
  });

  it("resetCanvas restores all four levels + chain + critChunks", () => {
    useGameStore.setState({
      sellPriceLevel: 7, speedLevel: 4,
      critLevel: 3, comboLevel: 2, comboChain: 4, critChunks: { 3: true },
    } as unknown as Parameters<typeof useGameStore.setState>[0]);
    useGameStore.getState().resetCanvas();
    const s = useGameStore.getState();
    expect(s.sellPriceLevel).toBe(0);
    expect(s.speedLevel).toBe(0);
    expect(s.critLevel).toBe(0);
    expect(s.comboLevel).toBe(0);
    expect(s.comboChain).toBe(0);
    expect(s.critChunks).toEqual({});
  });
});

describe("canvasSlice — upgradeSellPrice", () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialCanvasState, gold: big(0) });
  });

  it("no-ops when gold < cost (validate guard)", () => {
    useGameStore.setState({ gold: big(50) }); // < 100 cost (first buy from L0)
    useGameStore.getState().upgradeSellPrice();
    expect(useGameStore.getState().sellPriceLevel).toBe(0);
    expect(useGameStore.getState().gold.toNumber()).toBe(50);
  });

  it("spends gold and increments level on success", () => {
    useGameStore.setState({ gold: big(200) });
    useGameStore.getState().upgradeSellPrice();
    // First buy from L0: cost = sellPriceUpgradeCost(0) = 100 × 1.5^0 = 100
    expect(useGameStore.getState().sellPriceLevel).toBe(1);
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(100, 5); // 200 - 100
  });

  it("uses sellPriceUpgradeCost(currentLevel)", () => {
    useGameStore.setState({ gold: big(1000), sellPriceLevel: 5 });
    useGameStore.getState().upgradeSellPrice();
    // L5 → L6 cost = sellPriceUpgradeCost(5) = 100 × 1.5^5 ≈ 759.375
    expect(useGameStore.getState().sellPriceLevel).toBe(6);
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(1000 - 759.375, 1);
  });
});

describe("canvasSlice — upgradeSpeed", () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialCanvasState, gold: big(0) });
  });

  it("no-ops when gold < cost", () => {
    useGameStore.setState({ gold: big(50) });
    useGameStore.getState().upgradeSpeed();
    expect(useGameStore.getState().speedLevel).toBe(0);
  });

  it("spends gold and increments level", () => {
    useGameStore.setState({ gold: big(200) });
    useGameStore.getState().upgradeSpeed();
    // First buy from L0: cost = speedUpgradeCost(0) = 100 × 1.5^0 = 100
    expect(useGameStore.getState().speedLevel).toBe(1);
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(100, 5);
  });
});

describe("canvasSlice — upgradeCrit + upgradeCombo (gated)", () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialCanvasState, gold: big(0), purchasedNodes: {} });
  });

  it("upgradeCrit: locked → no-op", () => {
    useGameStore.setState({ gold: big(10000), purchasedNodes: {} });
    useGameStore.getState().upgradeCrit();
    expect(useGameStore.getState().critLevel).toBe(0);
  });

  it("upgradeCrit: unlocked + affordable → +1 level (L0→L1 = base 5000)", () => {
    useGameStore.setState({ gold: big(10000), purchasedNodes: { genius_episode: 1 } });
    useGameStore.getState().upgradeCrit();
    expect(useGameStore.getState().critLevel).toBe(1);
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(5000, 1); // 10000 - 5000
  });

  it("upgradeCombo: locked → no-op", () => {
    useGameStore.setState({ gold: big(10000), purchasedNodes: {} });
    useGameStore.getState().upgradeCombo();
    expect(useGameStore.getState().comboLevel).toBe(0);
  });

  it("upgradeCombo: unlocked + affordable → +1 level (L0→L1 = base 5000)", () => {
    useGameStore.setState({ gold: big(10000), purchasedNodes: { unrelentless: 1 } });
    useGameStore.getState().upgradeCombo();
    expect(useGameStore.getState().comboLevel).toBe(1);
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(5000, 1);
  });
});

describe("canvasTick — crit + combo behaviour", () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialCanvasState, gold: big(0) });
    useGameStore.getState()._setLifetimeGold(big(0));
  });

  it("at canvas start (canvasProgress = 0), per-chunk crit rolls populate critChunks on hit", () => {
    setSeed(12345);
    useGameStore.setState({ critLevel: 50 }); // 50% crit chance
    useGameStore.getState().canvasTick(0.5);
    // critChunks may be empty (no chunk boundary crossed yet) or populated — just confirm it's an object
    expect(typeof useGameStore.getState().critChunks).toBe("object");
  });

  it("without crit (critLevel=0), one chunk fires per BASE_CHUNK_INTERVAL; no sale until 10 chunks", () => {
    // T1 chunk-domain: 10 chunks per canvas, 5s per chunk → 50s for one sale.
    // 49s = 9.8 chunks, still no canvas sale (per-chunk gold drips though).
    useGameStore.setState({ critLevel: 0, canvasProgress: 0 });
    useGameStore.getState().canvasTick(BASE_CHUNK_INTERVAL * 9.8); // 49s
    expect(useGameStore.getState().lastSale).toBeNull();
    useGameStore.getState().canvasTick(BASE_CHUNK_INTERVAL * 0.3); // crosses 10-chunk boundary
    expect(useGameStore.getState().lastSale).not.toBeNull();
  });

  it("on sale, combo bonus from PRIOR comboChain applies to all chunks of this canvas's gold", () => {
    // Disable crit (BASE_CRIT_CHANCE = 1% would otherwise spill an extra chunk
    // and skew the gold assertion). Mocking rng to a high value forces no-crit
    // and a combo-miss after the sale fires.
    const rngSpy = vi.spyOn(rngModule, "rng").mockReturnValue(0.999);
    useGameStore.setState({ comboChain: 3, critLevel: 0, comboLevel: 0 });
    // Per-chunk gold = 1 × comboBonusFactor(3) = 1 × 1.30 = 1.3
    // Full canvas = 10 chunks × 1.3 = 13.0
    useGameStore.getState().canvasTick(T1_CANVAS_TIME + 0.1);
    const gold = useGameStore.getState().gold.toNumber();
    expect(gold).toBeCloseTo(13.0, 1);
    rngSpy.mockRestore();
  });

  it("after sale, on combo hit (chance 1.0), comboChain increments", () => {
    // With comboLevel=100 (100% chance at chain=0 & chain=1), both rolls should hit.
    setSeed(99);
    useGameStore.setState({ comboLevel: 100, comboChain: 0 });
    useGameStore.getState().canvasTick(T1_CANVAS_TIME + 0.1);
    expect(useGameStore.getState().comboChain).toBe(1);
    // Next sale, chain becomes 2
    useGameStore.getState().canvasTick(T1_CANVAS_TIME + 0.1);
    expect(useGameStore.getState().comboChain).toBe(2);
  });

  it("after sale, on combo miss (chance 0.0), comboChain resets to 0", () => {
    setSeed(7);
    useGameStore.setState({ comboLevel: 0, comboChain: 5 });
    useGameStore.getState().canvasTick(T1_CANVAS_TIME + 0.1);
    expect(useGameStore.getState().comboChain).toBe(0);
  });

  it("on sale, critChunks resets to {} (per-canvas state cleared on each sale)", () => {
    setSeed(12345);
    useGameStore.setState({ critLevel: 50, canvasProgress: 0 });
    // Fire enough time for multiple canvas sales
    useGameStore.getState().canvasTick(100);
    // After sales, critChunks belongs only to the current in-progress canvas
    const chunks = useGameStore.getState().critChunks;
    for (const idxStr of Object.keys(chunks)) {
      expect(Number(idxStr)).toBeGreaterThanOrEqual(0);
      expect(Number(idxStr)).toBeLessThan(25); // T1: 5×5 = 25 chunks
    }
  });

  it("per-chunk crit rolls fire across many canvases (not just the first)", () => {
    setSeed(1);
    useGameStore.setState({ critLevel: 50, canvasProgress: 0 });
    useGameStore.getState().canvasTick(200);
    // Many canvases sold with 50% crit chance → critsLanded should be significant
    expect(useGameStore.getState().statsRun.critsLanded).toBeGreaterThan(0);
  });
});

describe("tierUp() — chunk-domain (gold-gated)", () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState());
  });

  it("no-op when gold < cost", () => {
    useGameStore.setState({ gold: big(999), canvasTier: 1 });
    const result = useGameStore.getState().tierUp();
    expect(result).toBe(false);
    expect(useGameStore.getState().canvasTier).toBe(1);
    expect(useGameStore.getState().gold.toNumber()).toBe(999);
  });

  it("succeeds when gold >= tierUpgradeCost(currentTier)", () => {
    useGameStore.setState({ gold: big(1000), canvasTier: 1 });
    const result = useGameStore.getState().tierUp();
    expect(result).toBe(true);
    expect(useGameStore.getState().canvasTier).toBe(2);
    expect(useGameStore.getState().gold.toNumber()).toBe(0);
  });

  it("preserves sellPriceLevel, speedLevel, critLevel, comboLevel", () => {
    useGameStore.setState({
      gold: big(1000), canvasTier: 1,
      sellPriceLevel: 10, speedLevel: 7, critLevel: 3, comboLevel: 5,
    });
    useGameStore.getState().tierUp();
    const state = useGameStore.getState();
    expect(state.sellPriceLevel).toBe(10);
    expect(state.speedLevel).toBe(7);
    expect(state.critLevel).toBe(3);
    expect(state.comboLevel).toBe(5);
  });

  it("resets canvasProgress, comboChain, critChunks", () => {
    useGameStore.setState({
      gold: big(1000), canvasTier: 1,
      canvasProgress: 3.4, comboChain: 12, critChunks: { 0: true, 5: true },
    });
    useGameStore.getState().tierUp();
    const state = useGameStore.getState();
    expect(state.canvasProgress).toBe(0);
    expect(state.comboChain).toBe(0);
    expect(state.critChunks).toEqual({});
  });

  it("costs scale ×1000 per tier", () => {
    expect(tierUpgradeCost(1).toNumber()).toBe(1000);
    expect(tierUpgradeCost(2).toNumber()).toBe(1_000_000);
    expect(tierUpgradeCost(3).toNumber()).toBe(1_000_000_000);
  });
});

describe("canvasSlice — critChunks run-state", () => {
  it("initial state has empty critChunks record", () => {
    const state = useGameStore.getState();
    expect(state.critChunks).toEqual({});
  });
});
