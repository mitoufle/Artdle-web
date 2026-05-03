import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { CANVAS_GOLD_BASE } from "@/core/balance";
import { big } from "@/core/bigNumber";

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

  it("canvasTick(canvasTime(tier)) at exact threshold (tier 1, 2s): one sale, progress = 0", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(2);
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore + CANVAS_GOLD_BASE);
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });

  it("canvasTick(paintTime + 0.5) carries 0.5s leftover at tier 1", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(2.5); // tier 1 paint time = 2; leftover = 0.5 < 2
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore + CANVAS_GOLD_BASE);
    expect(useGameStore.getState().canvasProgress).toBeCloseTo(0.5, 9);
  });

  it("canvasTick(huge delta) — credits exactly one sale; progress clamped to 0", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(100); // way past tier 1's 2s
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore + CANVAS_GOLD_BASE);
    // Leftover would be 98 ≥ paintTime → clamp to 0.
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });

  it("canvasTick(0) is a no-op: no sale, no progress change, no gold change", () => {
    useGameStore.setState({ canvasProgress: 1 });
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(0);
    expect(useGameStore.getState().canvasProgress).toBe(1);
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore);
  });

  it("with multipliers returning 1 (default state), one sale credits exactly CANVAS_GOLD_BASE at tier 1", () => {
    const goldBefore = useGameStore.getState().gold.toNumber();
    useGameStore.getState().canvasTick(2);
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore + CANVAS_GOLD_BASE);
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

  it("a sale sets lastSale to {id: 1, amount: CANVAS_GOLD_BASE big} (tier 1, PM=0)", () => {
    useGameStore.getState().canvasTick(2); // tier 1, paint time = 2s
    const ls = useGameStore.getState().lastSale;
    expect(ls).not.toBeNull();
    expect(ls!.id).toBe(1);
    expect(ls!.amount.toNumber()).toBe(CANVAS_GOLD_BASE);
  });

  it("two sales increment lastSale.id from 1 to 2", () => {
    useGameStore.getState().canvasTick(2); // tier 1, paint time = 2s
    expect(useGameStore.getState().lastSale!.id).toBe(1);
    useGameStore.getState().canvasTick(2);
    expect(useGameStore.getState().lastSale!.id).toBe(2);
  });

  it("clearLastSale() resets lastSale to null", () => {
    useGameStore.getState().canvasTick(2);
    expect(useGameStore.getState().lastSale).not.toBeNull();
    useGameStore.getState().clearLastSale();
    expect(useGameStore.getState().lastSale).toBeNull();
  });

  it("clearLastSale() does not affect canvasProgress or gold", () => {
    useGameStore.getState().canvasTick(2.5); // tier 1 paint time = 2; leftover = 0.5
    const goldBefore = useGameStore.getState().gold.toNumber();
    const progressBefore = useGameStore.getState().canvasProgress;
    useGameStore.getState().clearLastSale();
    expect(useGameStore.getState().gold.toNumber()).toBe(goldBefore);
    expect(useGameStore.getState().canvasProgress).toBe(progressBefore);
  });

  it("a no-op tick (delta=0) does not advance lastSale", () => {
    useGameStore.getState().canvasTick(2); // first sale → id=1
    useGameStore.getState().canvasTick(0);
    expect(useGameStore.getState().lastSale!.id).toBe(1);
  });

  it("resetCanvas() clears lastSale alongside progress", () => {
    useGameStore.getState().canvasTick(2);
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

describe("canvasSlice — tier-aware tick (v1.1)", () => {
  beforeEach(() => {
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState()._setPaintMastery(big(0));
  });

  it("at tier 1, completes in 2 seconds", () => {
    expect(useGameStore.getState().canvasTier).toBe(1);
    useGameStore.getState().canvasTick(2);
    // exactly one sale fires: progress resets to 0
    expect(useGameStore.getState().canvasProgress).toBe(0);
    // gold credited: BASE × 1² × 1 = 10
    expect(useGameStore.getState().gold.toNumber()).toBe(10);
  });

  it("at tier 5, completes in 10 seconds, gold = 250", () => {
    useGameStore.setState({ canvasTier: 5 });
    useGameStore.getState().canvasTick(10);
    expect(useGameStore.getState().gold.toNumber()).toBe(250);
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });

  it("at tier 10, completes in 20 seconds, gold = 1000", () => {
    useGameStore.setState({ canvasTier: 10 });
    useGameStore.getState().canvasTick(20);
    expect(useGameStore.getState().gold.toNumber()).toBe(1000);
  });

  it("sale increments paintMastery by tier² (tier 5 → +25 PM)", () => {
    useGameStore.setState({ canvasTier: 5 });
    useGameStore.getState().canvasTick(10);
    expect(useGameStore.getState().paintMastery.toNumber()).toBe(25);
  });

  it("PM mult applies to gold output (PM 100 → ~11× at tier 1)", () => {
    useGameStore.setState({ canvasTier: 1 });
    useGameStore.getState()._setPaintMastery(big(100));
    useGameStore.getState().canvasTick(2);
    // gold = 10 × 1² × 11.0 ≈ 110 (canvasGoldMult = 1, pmMult ≈ 11)
    expect(useGameStore.getState().gold.toNumber()).toBeCloseTo(110, 0);
  });
});

describe("canvasSlice — tick reads canvasTier at threshold-cross (contract pin)", () => {
  beforeEach(() => {
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState()._setPaintMastery(big(0));
  });

  it("uses the canvasTier value at the moment of sale (single tick)", () => {
    // Set tier 5 explicitly; tick at exactly canvasTime(5) = 10s.
    useGameStore.setState({ canvasTier: 5 });
    useGameStore.getState().canvasTick(10);
    // gold = 10 × 25 × 1 = 250 (tier 5 was active at the sale)
    expect(useGameStore.getState().gold.toNumber()).toBe(250);
    // PM = 25 (tier² at tier 5)
    expect(useGameStore.getState().paintMastery.toNumber()).toBe(25);
  });
});
