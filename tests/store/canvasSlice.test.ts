import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { initialCanvasState } from "@/store/canvasSlice";
import { CANVAS_GOLD_BASE } from "@/core/balance";
import { big } from "@/core/bigNumber";
import { setSeed } from "@/core/rng";

describe("canvasSlice — canvasTick", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetCanvas();
  });

  it("initializes with canvasProgress 0", () => {
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });

  it("canvasTick(1) advances progress to 1 (< tier-1 paint time of 2s); gold unchanged", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(1);
    expect(useGameStore.getState().canvasProgress).toBe(1);
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore);
  });

  it("two canvasTick(5) calls fire multiple sales each (effectiveTime ≈ 1.905s, multi-sale per tick)", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(5);
    useGameStore.getState().canvasTick(5);
    // 5s / ~1.905s = 2.6 sales per tick → 2 sales per tick = 4 total over 2 ticks.
    // Expect at least 4 × 11g = 44g earned.
    expect(useGameStore.getState().gold.toNumber()).toBeGreaterThanOrEqual(goldBefore + CANVAS_GOLD_BASE * 1.1 * 4);
    // lastSale.id reflects total sales across both ticks (>= 4).
    expect(useGameStore.getState().lastSale!.id).toBeGreaterThanOrEqual(4);
  });

  it("canvasTick at exact effective threshold (sizeLevel=0, speedLevel=1 → ~1.905s): one sale, progress = 0", () => {
    // effectiveTime = canvasTime(0) / getCanvasSpeedMultiplier = 2 / 1.05 ≈ 1.905s
    const effTime = 2 / 1.05;
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(effTime);
    // sizeLevel=0, sellPriceLevel=1: gold = 10 × (1 + 0.10 × 1) = 11
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(goldBefore + CANVAS_GOLD_BASE * 1.1, 9);
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });

  it("canvasTick(effectiveTime + 0.5) carries 0.5s leftover", () => {
    // effectiveTime = 2 / 1.05 ≈ 1.905s
    const effTime = 2 / 1.05;
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(effTime + 0.5); // leftover = 0.5 < effectiveTime
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(goldBefore + CANVAS_GOLD_BASE * 1.1, 9);
    expect(useGameStore.getState().canvasProgress).toBeCloseTo(0.5, 9);
  });

  it("crit canvas (forced) paints ~10× faster than non-crit (regression: crit-throttle bug)", () => {
    // Non-crit: canvasProgress=0.001 bypasses the initial RNG roll. effectiveTime ≈ 1.905s.
    // 0.25s is far less than 1.905s — no sale should fire.
    useGameStore.setState({ critLevel: 0, isCritThisCanvas: false, canvasProgress: 0.001 });
    useGameStore.getState().canvasTick(0.25);
    expect(useGameStore.getState().gold.toNumber()).toBe(0);

    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetRunCurrencies();

    // Forced crit: same 0.25s tick >> crit time (≈ 0.190s), so canvas completes.
    useGameStore.setState({ critLevel: 0, isCritThisCanvas: true, canvasProgress: 0.001 });
    useGameStore.getState().canvasTick(0.25);
    expect(useGameStore.getState().gold.toNumber()).toBeGreaterThan(0);
  });

  it("canvasTick(huge delta) — fires multiple sales until budget exhausted (multi-sale per tick)", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(100); // ~52 sales worth (100 / 1.905)
    // Floor of 100 / 1.905 = 52 sales. Each sale ≈ 11g, so total ≈ 572g.
    const expectedSales = Math.floor(100 / (2 / 1.05));
    expect(useGameStore.getState().gold.toNumber()).toBeGreaterThanOrEqual(
      goldBefore + CANVAS_GOLD_BASE * 1.1 * expectedSales,
    );
    // Progress carries the small leftover from the last partial canvas.
    expect(useGameStore.getState().canvasProgress).toBeGreaterThanOrEqual(0);
    expect(useGameStore.getState().canvasProgress).toBeLessThan(2 / 1.05);
  });

  it("canvasTick(0) is a no-op: no sale, no progress change, no gold change", () => {
    useGameStore.setState({ canvasProgress: 1 });
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(0);
    expect(useGameStore.getState().canvasProgress).toBe(1);
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore);
  });

  it("at default state (sizeLevel=0, sellPriceLevel=1), one sale credits CANVAS_GOLD_BASE × 1.1", () => {
    // sizeLevel=0 → canvasGold base = 10; sellPriceLevel=1 adds +10% → total 11
    const effTime = 2 / 1.05;
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(effTime);
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(goldBefore + CANVAS_GOLD_BASE * 1.1, 9);
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

  it("a sale sets lastSale to {id: 1, amount: CANVAS_GOLD_BASE × 1.1} (sizeLevel=0, sellPriceLevel=1)", () => {
    const effTime = 2 / 1.05;
    useGameStore.getState().canvasTick(effTime); // sizeLevel=0, effectiveTime ≈ 1.905s
    const ls = useGameStore.getState().lastSale;
    expect(ls).not.toBeNull();
    expect(ls!.id).toBe(1);
    // sizeLevel=0, sellPriceLevel=1: gold = 10 × 1.10 = 11
    expect(ls!.amount.toNumber()).toBeCloseTo(CANVAS_GOLD_BASE * 1.1, 9);
  });

  it("two sales increment lastSale.id from 1 to 2", () => {
    const effTime = 2 / 1.05;
    useGameStore.getState().canvasTick(effTime);
    expect(useGameStore.getState().lastSale!.id).toBe(1);
    useGameStore.getState().canvasTick(effTime);
    expect(useGameStore.getState().lastSale!.id).toBe(2);
  });

  it("clearLastSale() resets lastSale to null", () => {
    const effTime = 2 / 1.05;
    useGameStore.getState().canvasTick(effTime);
    expect(useGameStore.getState().lastSale).not.toBeNull();
    useGameStore.getState().clearLastSale();
    expect(useGameStore.getState().lastSale).toBeNull();
  });

  it("clearLastSale() does not affect canvasProgress or gold", () => {
    const effTime = 2 / 1.05;
    useGameStore.getState().canvasTick(effTime + 0.5); // leftover = 0.5s
    const goldBefore = useGameStore.getState().gold.toNumber();
    const progressBefore = useGameStore.getState().canvasProgress;
    useGameStore.getState().clearLastSale();
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore);
    expect(useGameStore.getState().canvasProgress).toBe(progressBefore);
  });

  it("a no-op tick (delta=0) does not advance lastSale", () => {
    const effTime = 2 / 1.05;
    useGameStore.getState().canvasTick(effTime); // first sale → id=1
    useGameStore.getState().canvasTick(0);
    expect(useGameStore.getState().lastSale!.id).toBe(1);
  });

  it("resetCanvas() clears lastSale alongside progress", () => {
    const effTime = 2 / 1.05;
    useGameStore.getState().canvasTick(effTime);
    expect(useGameStore.getState().lastSale).not.toBeNull();
    useGameStore.getState().resetCanvas();
    expect(useGameStore.getState().lastSale).toBeNull();
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });
});

describe("canvasSlice — size-aware tick (canvas-depth)", () => {
  beforeEach(() => {
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState()._setLifetimeGold(big(0));
  });

  it("at sizeLevel=0, size=1, gold = 10 × 1² × 1.10 = 11", () => {
    // canvasTime(size=1) = 2s; speedLevel=1 → speedMult = 1.05
    const effTime = 2 / 1.05;
    useGameStore.getState().canvasTick(effTime);
    expect(useGameStore.getState().canvasProgress).toBe(0);
    // size = 1, sellPriceLevel=1 → gold = 10 × 1 × 1.10 = 11
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(CANVAS_GOLD_BASE * 1.1, 9);
  });

  it("at sizeLevel=1, size = 1.15, gold = 10 × 1.15² × 1.10, time = 2 × 1.15", () => {
    useGameStore.setState({ sizeLevel: 1 });
    const effTime = (2 * 1.15) / 1.05; // canvasTime(1.15) = 2.3 / speedMult
    useGameStore.getState().canvasTick(effTime);
    expect(useGameStore.getState().canvasProgress).toBe(0);
    // size = 1 + 0.15 × 1 = 1.15 ; gold = 10 × 1.15² × 1.10 = 10 × 1.3225 × 1.10 ≈ 14.5475
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(14.5475, 3);
  });

  it("sale calls trackSaleGold — lifetimeGold increments", () => {
    const effTime = 2 / 1.05;
    useGameStore.getState().canvasTick(effTime);
    expect(useGameStore.getState().lifetimeGold.toNumber()).toBeCloseTo(CANVAS_GOLD_BASE * 1.1, 9);
  });
});

describe("canvasSlice — new track state fields", () => {
  beforeEach(() => {
    useGameStore.setState({ ...useGameStore.getState() }); // resets canvas portion via implicit state
  });

  it("starts with sellPriceLevel=1 and speedLevel=1 (unlocked tracks)", () => {
    const s = useGameStore.getState();
    expect(s.sellPriceLevel).toBe(1);
    expect(s.speedLevel).toBe(1);
  });

  it("starts with sizeLevel=0, critLevel=0, comboLevel=0 (gated tracks)", () => {
    const s = useGameStore.getState();
    expect(s.sizeLevel).toBe(0);
    expect(s.critLevel).toBe(0);
    expect(s.comboLevel).toBe(0);
  });

  it("starts with comboChain=0 and isCritThisCanvas=false", () => {
    const s = useGameStore.getState();
    expect(s.comboChain).toBe(0);
    expect(s.isCritThisCanvas).toBe(false);
  });

  it("resetCanvas restores all five levels + chain + crit flag", () => {
    useGameStore.setState({
      sellPriceLevel: 7, speedLevel: 4, sizeLevel: 5,
      critLevel: 3, comboLevel: 2, comboChain: 4, isCritThisCanvas: true,
    } as Parameters<typeof useGameStore.setState>[0]);
    useGameStore.getState().resetCanvas();
    const s = useGameStore.getState();
    expect(s.sellPriceLevel).toBe(1);
    expect(s.speedLevel).toBe(1);
    expect(s.sizeLevel).toBe(0);
    expect(s.critLevel).toBe(0);
    expect(s.comboLevel).toBe(0);
    expect(s.comboChain).toBe(0);
    expect(s.isCritThisCanvas).toBe(false);
  });
});

describe("canvasSlice — upgradeSellPrice", () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialCanvasState, gold: big(0) });
  });

  it("no-ops when gold < cost (validate guard)", () => {
    useGameStore.setState({ gold: big(100) }); // < 150 cost (first buy from L1)
    useGameStore.getState().upgradeSellPrice();
    expect(useGameStore.getState().sellPriceLevel).toBe(1);
    expect(useGameStore.getState().gold.toNumber()).toBe(100);
  });

  it("spends gold and increments level on success", () => {
    useGameStore.setState({ gold: big(200) });
    useGameStore.getState().upgradeSellPrice();
    // First buy from L1: cost = sellPriceUpgradeCost(1) = 100 × 1.5 = 150
    expect(useGameStore.getState().sellPriceLevel).toBe(2);
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(50, 5); // 200 - 150
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
    useGameStore.setState({ gold: big(100) });
    useGameStore.getState().upgradeSpeed();
    expect(useGameStore.getState().speedLevel).toBe(1);
  });

  it("spends gold and increments level", () => {
    useGameStore.setState({ gold: big(200) });
    useGameStore.getState().upgradeSpeed();
    // First buy from L1: cost = speedUpgradeCost(1) = 100 × 1.5 = 150
    expect(useGameStore.getState().speedLevel).toBe(2);
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(50, 5);
  });
});

describe("canvasSlice — upgradeSize (gated)", () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialCanvasState, gold: big(0), purchasedNodes: {} });
  });

  it("no-ops when track is locked (no skill-tree node)", () => {
    useGameStore.setState({ gold: big(10000), purchasedNodes: {} });
    useGameStore.getState().upgradeSize();
    expect(useGameStore.getState().sizeLevel).toBe(0);
    expect(useGameStore.getState().gold.toNumber()).toBe(10000);
  });

  it("no-ops when gold < cost (even if unlocked)", () => {
    useGameStore.setState({ gold: big(500), purchasedNodes: { size_matters: 1 } });
    useGameStore.getState().upgradeSize();
    expect(useGameStore.getState().sizeLevel).toBe(0);
  });

  it("spends gold and increments when unlocked + affordable", () => {
    useGameStore.setState({ gold: big(2000), purchasedNodes: { size_matters: 1 } });
    useGameStore.getState().upgradeSize();
    // L0 → L1: cost = sizeUpgradeCost(0) = 1000 × 1.5^0 = 1000
    expect(useGameStore.getState().sizeLevel).toBe(1);
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(1000, 1);
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

  it("at canvas start (canvasProgress = 0), rolls crit and stores in isCritThisCanvas", () => {
    setSeed(1);
    useGameStore.setState({ critLevel: 50 }); // 50% crit chance
    useGameStore.getState().canvasTick(0.1);
    const flag = useGameStore.getState().isCritThisCanvas;
    expect(typeof flag).toBe("boolean");
  });

  it("crit canvas paints in time / 10 (CRIT_SPEED_FACTOR)", () => {
    // canvasProgress=0.001 bypasses the initial RNG roll; isCritThisCanvas=true forces crit.
    // sizeLevel 0: canvasTime(0) = 2; speedMult = 1.05 → crit time = 2/(1.05×10) ≈ 0.190s
    // remaining = 0.190 - 0.001 = 0.189s
    useGameStore.setState({ critLevel: 0, sizeLevel: 0, isCritThisCanvas: true, canvasProgress: 0.001 });
    useGameStore.getState().canvasTick(0.18); // 0.18 < 0.189 → not yet done
    expect(useGameStore.getState().gold.toNumber()).toBe(0);
    useGameStore.getState().canvasTick(0.02); // 0.18 + 0.02 > 0.189 → sale fires
    expect(useGameStore.getState().gold.gt(big(0))).toBe(true);
  });

  it("on sale, combo bonus from PRIOR comboChain applies to this canvas's gold", () => {
    setSeed(99);
    useGameStore.setState({ comboChain: 3, critLevel: 0, comboLevel: 0 });
    // sizeLevel=0, speedLevel=1 (initial defaults)
    // base gold = canvasGold(0, mult); mult = (1 + 0.10×1 sellPrice) × 1 (PM=0) = 1.10
    // baseGold = 10 × 1.10 = 11
    // combo factor = 1 + 0.10 × 3 = 1.30
    // total = 11 × 1.30 = 14.30
    const baseTime = 2; // canvasTime(0)
    const speedMult = 1.05; // 1 + 0.05 * 1 (speedLevel=1 default)
    const effTime = baseTime / speedMult;
    useGameStore.getState().canvasTick(effTime + 0.1);
    const gold = useGameStore.getState().gold.toNumber();
    expect(gold).toBeCloseTo(14.30, 1);
  });

  it("after sale, on combo hit (chance 1.0), comboChain increments", () => {
    // With comboLevel=100 (100% chance at chain=0 & chain=1), both rolls should hit.
    // RNG sequence is now shifted by the crit re-roll in the sale path.
    setSeed(99);
    useGameStore.setState({ comboLevel: 100, comboChain: 0 }); // chance saturates at 1.0
    const effTime = 2 / 1.05;
    useGameStore.getState().canvasTick(effTime + 0.1);
    expect(useGameStore.getState().comboChain).toBe(1);
    // Next sale, chain becomes 2
    useGameStore.getState().canvasTick(effTime + 0.1);
    expect(useGameStore.getState().comboChain).toBe(2);
  });

  it("after sale, on combo miss (chance 0.0), comboChain resets to 0", () => {
    setSeed(7);
    useGameStore.setState({ comboLevel: 0, comboChain: 5 });
    const effTime = 2 / 1.05;
    useGameStore.getState().canvasTick(effTime + 0.1);
    expect(useGameStore.getState().comboChain).toBe(0);
  });

  it("on sale, isCritThisCanvas is re-rolled immediately in the sale path (not deferred)", () => {
    // canvasProgress=0.001 bypasses the initial roll; isCritThisCanvas=true forces this canvas to crit.
    // After the sale, the sale path re-rolls with critLevel=0 (0% chance) → guaranteed false.
    // If the re-roll were deferred, the flag would still be true from the initial setState.
    useGameStore.setState({ critLevel: 0, isCritThisCanvas: true, canvasProgress: 0.001 });
    const effTime = (2 / 1.05) / 10; // crit time ≈ 0.190s
    useGameStore.getState().canvasTick(effTime + 0.1);
    expect(useGameStore.getState().isCritThisCanvas).toBe(false);
  });

  it("rolls crit on EACH new canvas, not just the first (regression: leftover>0 used to skip the roll)", () => {
    setSeed(1);
    // critLevel=100 → effective crit ~87.5% (soft-capped). Most canvases are crits
    // (≈0.19s each), so many sales fire in 5s — proving rolls happen per canvas.
    useGameStore.setState({ critLevel: 100, canvasProgress: 0.001, isCritThisCanvas: true });

    const dt = 0.25; // larger than crit canvas time, ensures leftover > 0 each sale

    for (let i = 0; i < 20; i++) {
      useGameStore.getState().canvasTick(dt);
    }

    // Many crits firing → substantial gold (would be negligible if rolls were skipped)
    expect(useGameStore.getState().gold.toNumber()).toBeGreaterThan(50);
  });
});
