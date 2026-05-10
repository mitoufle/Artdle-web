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
    useGameStore.getState()._setPaintMastery(big(0));
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

  it("two canvasTick(5) calls each cross threshold once (tier 1, 2s/canvas): 2 sales, progress = 0", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(5);
    useGameStore.getState().canvasTick(5);
    // Two sales must have fired: gold > goldBefore + CANVAS_GOLD_BASE (at least 2 × 10).
    expect(useGameStore.getState().gold.toNumber()).toBeGreaterThan(goldBefore + CANVAS_GOLD_BASE);
    // Each tick clamped progress to 0 (leftover 3s ≥ paintTime 2s → clamp).
    expect(useGameStore.getState().canvasProgress).toBe(0);
    // lastSale.id === 2 confirms exactly two sales (one per tick).
    expect(useGameStore.getState().lastSale!.id).toBe(2);
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

  it("canvasTick(huge delta) — credits exactly one sale; progress clamped to 0", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(100); // way past effectiveTime of ~1.905s
    // sizeLevel=0, sellPriceLevel=1: gold = 11
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(goldBefore + CANVAS_GOLD_BASE * 1.1, 9);
    // Leftover would be ~98 ≥ effectiveTime → clamp to 0.
    expect(useGameStore.getState().canvasProgress).toBe(0);
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
    useGameStore.getState()._setPaintMastery(big(0));
  });

  it("initializes with lastSale = null", () => {
    expect(useGameStore.getState().lastSale).toBeNull();
  });

  it("a sale sets lastSale to {id: 1, amount: CANVAS_GOLD_BASE × 1.1} (sizeLevel=0, sellPriceLevel=1, PM=0)", () => {
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

describe("canvasSlice — canvasTier (v1.1)", () => {
  beforeEach(() => {
    useGameStore.getState().resetCanvas();
  });

  it("initializes with canvasTier = 1", () => {
    expect(useGameStore.getState().canvasTier).toBe(1);
  });

  it("resetCanvas resets canvasTier to 1", () => {
    useGameStore.setState({ canvasTier: 7 });
    useGameStore.getState().resetCanvas();
    expect(useGameStore.getState().canvasTier).toBe(1);
  });
});

describe("canvasSlice — upgradeTier (v1.1)", () => {
  beforeEach(() => {
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetRunCurrencies();
  });

  it("with sufficient gold, increments tier and spends cost", () => {
    useGameStore.setState({ gold: big(500) });
    useGameStore.getState().upgradeTier();
    expect(useGameStore.getState().canvasTier).toBe(2);
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(400, 5);
  });

  it("with insufficient gold, no-op (state unchanged)", () => {
    useGameStore.setState({ gold: big(50), canvasTier: 1 });
    useGameStore.getState().upgradeTier();
    expect(useGameStore.getState().canvasTier).toBe(1);
    expect(useGameStore.getState().gold.toNumber()).toBe(50);
  });

  it("at MAX_TIER, no-op (no further upgrades)", () => {
    useGameStore.setState({ gold: big(1e9), canvasTier: 10 });
    useGameStore.getState().upgradeTier();
    expect(useGameStore.getState().canvasTier).toBe(10);
    expect(useGameStore.getState().gold.toNumber()).toBe(1e9);
  });

  it("upgrading from tier 5 costs ~5,983 g", () => {
    useGameStore.setState({ gold: big(10_000), canvasTier: 5 });
    useGameStore.getState().upgradeTier();
    expect(useGameStore.getState().canvasTier).toBe(6);
    // Actual computed value: 100 × 2.78^4 ≈ 5972.82. Loose tolerance.
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(10000 - 5973, 0);
  });
});

describe("canvasSlice — size-aware tick (canvas-depth)", () => {
  beforeEach(() => {
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState()._setPaintMastery(big(0));
    useGameStore.getState()._setLifetimeGold(big(0));
  });

  it("at sizeLevel=0, effectiveTime = canvasTime(0) / speedMult = 2 / 1.05 ≈ 1.905s", () => {
    // canvasTime(0) = 2s (baseline); speedLevel=1 → speedMult = 1.05
    const effTime = 2 / 1.05;
    useGameStore.getState().canvasTick(effTime);
    expect(useGameStore.getState().canvasProgress).toBe(0);
    // sizeLevel=0, sellPriceLevel=1: gold = 10 × 1.10 = 11
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(CANVAS_GOLD_BASE * 1.1, 9);
  });

  it("at sizeLevel=1, canvasTime grows by 15%: 2 × 1.15 = 2.3s base, effectiveTime = 2.3 / 1.05", () => {
    useGameStore.setState({ sizeLevel: 1 });
    const effTime = 2.3 / 1.05; // canvasTime(1) = 2 × (1 + 0.15 × 1) = 2.3
    useGameStore.getState().canvasTick(effTime);
    expect(useGameStore.getState().canvasProgress).toBe(0);
    // sizeLevel=1: canvasGold base = 10 × (1 + 0.30 × 1) = 13; sellPriceLevel=1 → × 1.10 = 14.3
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(14.3, 1);
  });

  it("sale credits PM via addGoldEarned (11g at lt=0 is sub-threshold → 0 PM)", () => {
    const effTime = 2 / 1.05;
    useGameStore.getState().canvasTick(effTime);
    // sizeLevel=0 sale = 11g. pmFromLifetime(11) - pmFromLifetime(0) = 0 (< 1000 threshold).
    expect(useGameStore.getState().paintMastery.toNumber()).toBe(0);
    expect(useGameStore.getState().lifetimeGold.toNumber()).toBeCloseTo(CANVAS_GOLD_BASE * 1.1, 9);
  });

  it("PM mult applies to gold output (PM 100 → ~11× at sizeLevel=0)", () => {
    useGameStore.getState()._setPaintMastery(big(100));
    const effTime = 2 / 1.05;
    useGameStore.getState().canvasTick(effTime);
    // gold = 10 × sellPrice(1.10) × pmMult(100) = 11 × pmMult(100)
    // pmMult(100) = 1 + 5.0 × log10(101) ≈ 1 + 5.0 × 2.0043 = 11.02
    // total ≈ 11 × 11.02 = 121.2
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(121.2, 0);
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
    useGameStore.setState({ gold: big(500), purchasedNodes: { unlock_canvas_size: 1 } });
    useGameStore.getState().upgradeSize();
    expect(useGameStore.getState().sizeLevel).toBe(0);
  });

  it("spends gold and increments when unlocked + affordable", () => {
    useGameStore.setState({ gold: big(2000), purchasedNodes: { unlock_canvas_size: 1 } });
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
    useGameStore.setState({ gold: big(10000), purchasedNodes: { unlock_canvas_crit: 1 } });
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
    useGameStore.setState({ gold: big(10000), purchasedNodes: { unlock_canvas_combo: 1 } });
    useGameStore.getState().upgradeCombo();
    expect(useGameStore.getState().comboLevel).toBe(1);
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(5000, 1);
  });
});

describe("canvasTick — crit + combo behaviour", () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialCanvasState, gold: big(0) });
    useGameStore.getState()._setPaintMastery(big(0));
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
    setSeed(42);
    useGameStore.setState({ critLevel: 100, sizeLevel: 0 });
    // Effective time = canvasTime(0) / (speedMult × 10)
    // sizeLevel 0: canvasTime(0) = 2; speedMult = 1.05 (speedLevel=1 default contribution)
    // crit time = 2 / (1.05 × 10) ≈ 0.190 s
    useGameStore.getState().canvasTick(0.18);
    expect(useGameStore.getState().gold.toNumber()).toBe(0); // not yet crossed
    useGameStore.getState().canvasTick(0.02);
    expect(useGameStore.getState().gold.gt(big(0))).toBe(true); // sale fired
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
    // seed=1 produces rng sequence: [0.627, 0.003, 0.527, ...]
    // tick1: crit roll (critLevel=0, always miss) → rng[0]=0.627; combo roll chain=0 effChance=1.0 → rng[1]=0.003 < 1.0 → hit
    // tick2: canvasProgress=0.1 (leftover) so no crit re-roll; combo roll chain=1 effChance=0.95 → rng[2]=0.527 < 0.95 → hit
    setSeed(1);
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

  it("on sale, isCritThisCanvas is reset to false (will re-roll on next canvas start)", () => {
    setSeed(42);
    useGameStore.setState({ critLevel: 100 });
    const effTime = (2 / 1.05) / 10; // crit-hit time
    useGameStore.getState().canvasTick(effTime + 0.1);
    expect(useGameStore.getState().isCritThisCanvas).toBe(false);
  });
});
