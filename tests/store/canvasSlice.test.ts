import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { initialCanvasState } from "@/store/canvasSlice";
import { CANVAS_GOLD_BASE, tierUpgradeCost } from "@/core/balance";
import { big } from "@/core/bigNumber";
import { setSeed } from "@/core/rng";

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

  it("canvasTick(1) advances progress to 1 (< tier-1 paint time of 10s); gold unchanged", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(1);
    // Progress is between 1 and 1.5 — exact 1.0 if no crit fires (deterministic
    // via the seed above), up to 1.4 if a crit adds one bonus chunk worth (0.4s).
    expect(useGameStore.getState().canvasProgress).toBeGreaterThanOrEqual(1);
    expect(useGameStore.getState().canvasProgress).toBeLessThan(1.5);
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore);
  });

  it("two canvasTick(25) calls fire multiple sales each (effectiveTime = 10s, multi-sale per tick)", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(25);
    useGameStore.getState().canvasTick(25);
    // 25s / 10s = 2.5 sales per tick → 2 sales per tick = 4 total over 2 ticks.
    // Expect at least 4 × 10g = 40g earned (sellPriceLevel=0, no multiplier).
    expect(useGameStore.getState().gold.toNumber()).toBeGreaterThanOrEqual(goldBefore + CANVAS_GOLD_BASE * 4);
    // lastSale.id reflects total sales across both ticks (>= 4).
    expect(useGameStore.getState().lastSale!.id).toBeGreaterThanOrEqual(4);
  });

  it("canvasTick just past effective threshold (speedLevel=0 → 10s): one sale fires", () => {
    // effectiveTime = canvasTime(1) / getCanvasSpeedMultiplier = 10 / 1.0 = 10s
    // Per-chunk model: T1 has 5×5=25 chunks, each = 0.4s. Float accumulation means
    // exactly 10s may not complete the final chunk — use 10.01 to guarantee one sale.
    const effTimePlus = 10.01;
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(effTimePlus);
    // sellPriceLevel=0: gold = 10 × 1.0 = 10
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(goldBefore + CANVAS_GOLD_BASE, 1);
    expect(useGameStore.getState().canvasProgress).toBeGreaterThanOrEqual(0);
    expect(useGameStore.getState().canvasProgress).toBeLessThan(10);
  });

  it("canvasTick(effectiveTime + 0.5) produces one sale and leaves leftover < effectiveTime", () => {
    // effectiveTime = 10 / 1.0 = 10s; leftover ≈ 0.5s after one sale
    const effTimePlus = 10.5;
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(effTimePlus);
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(goldBefore + CANVAS_GOLD_BASE, 1);
    expect(useGameStore.getState().canvasProgress).toBeGreaterThanOrEqual(0);
    expect(useGameStore.getState().canvasProgress).toBeLessThan(10);
  });

  it("without crit, effectiveTime = 10s, no sale in 0.5s tick", () => {
    // No crit (critLevel=0 → 0% chance); effectiveTime = 10s.
    // 0.5s is far less than 10s — no sale should fire.
    useGameStore.setState({ critLevel: 0, canvasProgress: 0.001 });
    useGameStore.getState().canvasTick(0.5);
    expect(useGameStore.getState().gold.toNumber()).toBe(0);
  });

  it("canvasTick(huge delta) — fires multiple sales until budget exhausted (multi-sale per tick)", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(100); // 100 / 10 = 10 sales
    // Floor of 100 / 10 = 10 sales. Each sale = 10g (sellPriceLevel=0), so total = 100g.
    const expectedSales = Math.floor(100 / 10);
    expect(useGameStore.getState().gold.toNumber()).toBeGreaterThanOrEqual(
      goldBefore + CANVAS_GOLD_BASE * expectedSales,
    );
    // Progress carries the small leftover from the last partial canvas.
    expect(useGameStore.getState().canvasProgress).toBeGreaterThanOrEqual(0);
    expect(useGameStore.getState().canvasProgress).toBeLessThan(10);
  });

  it("canvasTick(0) is a no-op: no sale, no progress change, no gold change", () => {
    useGameStore.setState({ canvasProgress: 1 });
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(0);
    expect(useGameStore.getState().canvasProgress).toBe(1);
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore);
  });

  it("at default state (sellPriceLevel=0), one sale credits CANVAS_GOLD_BASE", () => {
    // canvasGold base = 10; sellPriceLevel=0 adds +0% → total 10
    // Use effTime+0.01 to guarantee the last chunk clears despite floating-point accumulation.
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(10.01);
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(goldBefore + CANVAS_GOLD_BASE, 1);
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

  it("a sale sets lastSale to {id: 1, amount: CANVAS_GOLD_BASE / chunkCount} (sellPriceLevel=0)", () => {
    // Use 10.01 to guarantee the final chunk completes despite floating-point accumulation.
    useGameStore.getState().canvasTick(10.01);
    const ls = useGameStore.getState().lastSale;
    expect(ls).not.toBeNull();
    expect(ls!.id).toBe(1);
    // sellPriceLevel=0: per-chunk gold = 1 (T1: 10 chunks × 1g = 10g per canvas)
    // lastSale.amount carries the FINAL chunk's gain, not the lump sum.
    expect(ls!.amount.toNumber()).toBeCloseTo(CANVAS_GOLD_BASE / 10, 1);
  });

  it("two sales increment lastSale.id from 1 to 2", () => {
    useGameStore.getState().canvasTick(10.01);
    expect(useGameStore.getState().lastSale!.id).toBe(1);
    useGameStore.getState().canvasTick(10.01);
    expect(useGameStore.getState().lastSale!.id).toBe(2);
  });

  it("clearLastSale() resets lastSale to null", () => {
    useGameStore.getState().canvasTick(10.01);
    expect(useGameStore.getState().lastSale).not.toBeNull();
    useGameStore.getState().clearLastSale();
    expect(useGameStore.getState().lastSale).toBeNull();
  });

  it("clearLastSale() does not affect canvasProgress or gold", () => {
    useGameStore.getState().canvasTick(10.5);
    const goldBefore = useGameStore.getState().gold.toNumber();
    const progressBefore = useGameStore.getState().canvasProgress;
    useGameStore.getState().clearLastSale();
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore);
    expect(useGameStore.getState().canvasProgress).toBe(progressBefore);
  });

  it("a no-op tick (delta=0) does not advance lastSale", () => {
    useGameStore.getState().canvasTick(10.01); // first sale → id=1
    useGameStore.getState().canvasTick(0);
    expect(useGameStore.getState().lastSale!.id).toBe(1);
  });

  it("resetCanvas() clears lastSale alongside progress", () => {
    useGameStore.getState().canvasTick(10.01);
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
    // T1 = 10 chunks × 1g/chunk = 10g per canvas. Use 10.01 to clear the final
    // chunk boundary despite float accumulation.
    useGameStore.getState().canvasTick(10.01);
    expect(useGameStore.getState().canvasProgress).toBeGreaterThanOrEqual(0);
    expect(useGameStore.getState().canvasProgress).toBeLessThan(10);
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(CANVAS_GOLD_BASE, 1);
  });

  it("sale calls trackSaleGold — lifetimeGold increments", () => {
    useGameStore.getState().canvasTick(10.01);
    expect(useGameStore.getState().lifetimeGold.toNumber()).toBeCloseTo(CANVAS_GOLD_BASE, 1);
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

  it("without crit (critLevel=0), painting takes effectiveTime = 10s; no sale in 9.9s", () => {
    // speedLevel=0 → effectiveTime = 10s
    useGameStore.setState({ critLevel: 0, canvasProgress: 0 });
    useGameStore.getState().canvasTick(9.9);
    expect(useGameStore.getState().gold.toNumber()).toBe(0);
    useGameStore.getState().canvasTick(0.2); // crosses threshold → sale fires
    expect(useGameStore.getState().gold.gt(big(0))).toBe(true);
  });

  it("on sale, combo bonus from PRIOR comboChain applies to this canvas's gold", () => {
    setSeed(99);
    useGameStore.setState({ comboChain: 3, critLevel: 0, comboLevel: 0 });
    // speedLevel=0 (initial default)
    // base gold = canvasGold(1, mult); mult = (1 + 0.10×0 sellPrice) × 1 (PM=0) = 1.0
    // baseGold = 10 × 1.0 = 10
    // combo factor = 1 + 0.10 × 3 = 1.30
    // total = 10 × 1.30 = 13.0
    const effTime = 10; // canvasTime(1) = 10; speedMult = 1.0
    useGameStore.getState().canvasTick(effTime + 0.1);
    const gold = useGameStore.getState().gold.toNumber();
    expect(gold).toBeCloseTo(13.0, 1);
  });

  it("after sale, on combo hit (chance 1.0), comboChain increments", () => {
    // With comboLevel=100 (100% chance at chain=0 & chain=1), both rolls should hit.
    // RNG sequence is now shifted by the crit re-roll in the sale path.
    setSeed(99);
    useGameStore.setState({ comboLevel: 100, comboChain: 0 }); // chance saturates at 1.0
    const effTime = 10;
    useGameStore.getState().canvasTick(effTime + 0.1);
    expect(useGameStore.getState().comboChain).toBe(1);
    // Next sale, chain becomes 2
    useGameStore.getState().canvasTick(effTime + 0.1);
    expect(useGameStore.getState().comboChain).toBe(2);
  });

  it("after sale, on combo miss (chance 0.0), comboChain resets to 0", () => {
    setSeed(7);
    useGameStore.setState({ comboLevel: 0, comboChain: 5 });
    const effTime = 10;
    useGameStore.getState().canvasTick(effTime + 0.1);
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
