import type { JSX } from "react";
import { useGameStore } from "@/store";
import { formatBig } from "@/core/formatter";
import { craftCost, sellPriceUpgradeCost, SIZE_GOLD_PER_LEVEL, SIZE_TIME_PER_LEVEL } from "@/core/balance";
import {
  getCanvasGoldMultiplier,
  getCanvasSpeedMultiplier,
  getInspiMultiplier,
  getTreeUpgradeCostMultiplier,
} from "@/core/multipliers";
import styles from "./ScalingMathPanel.module.css";

export function ScalingMathPanel(): JSX.Element {
  const workshopLevel = useGameStore((s) => s.workshopLevel);
  const sizeLevel = useGameStore((s) => s.sizeLevel);
  const sellPriceLevel = useGameStore((s) => s.sellPriceLevel);
  // Multiplier selectors are stable enough that one-shot reads here are fine —
  // every state change that affects them also bumps workshopLevel/sizeLevel
  // or another root subscription elsewhere in the app, so this panel re-renders
  // on the relevant ticks.
  const state = useGameStore.getState();
  const inspiMult = getInspiMultiplier(state);
  const goldMult = getCanvasGoldMultiplier(state);
  const speedMult = getCanvasSpeedMultiplier(state);
  const bargain = getTreeUpgradeCostMultiplier(state);

  return (
    <aside className={styles.panel} aria-label="Scaling reference">
      <div className={styles.heading}>SCALING</div>

      <section className={styles.section} data-testid="scaling-inspi">
        <div className={styles.label}>Inspi/sec</div>
        <div className={styles.formula}>Σ(level × rate) × {inspiMult.toFixed(2)}×</div>
      </section>

      <section className={styles.section} data-testid="scaling-gold">
        <div className={styles.label}>Canvas Gold</div>
        <div className={styles.formula}>10 × (1 + {SIZE_GOLD_PER_LEVEL} × {sizeLevel}) × {goldMult.toFixed(2)}×</div>
        <div className={styles.note}>colors + items, × rainbow, × PM</div>
      </section>

      <section className={styles.section} data-testid="scaling-paint">
        <div className={styles.label}>Paint Time</div>
        <div className={styles.formula}>2 × (1 + {SIZE_TIME_PER_LEVEL} × {sizeLevel})s ÷ {speedMult.toFixed(2)}×</div>
      </section>

      <section className={styles.section} data-testid="scaling-craft-cost">
        <div className={styles.label}>Craft Cost (workshop Lv {workshopLevel})</div>
        <div className={styles.formula}>= {formatBig(craftCost(workshopLevel))} g</div>
      </section>

      <section className={styles.section} data-testid="scaling-track-cost">
        <div className={styles.label}>Sell Price Upgrade (Lv {sellPriceLevel})</div>
        <div className={styles.formula}>= {formatBig(sellPriceUpgradeCost(sellPriceLevel))} g</div>
      </section>

      <section className={styles.section} data-testid="scaling-tree-cost">
        <div className={styles.label}>Tree Part Cost</div>
        <div className={styles.formula}>base × 1.15^n × {bargain.toFixed(2)}×</div>
      </section>

      <section className={styles.section} data-testid="scaling-fame">
        <div className={styles.label}>Fame on Ascend</div>
        <div className={styles.formula}>max(1, ⌊(log₁₀(inspi)−4)⁵ × 3.2⌋)</div>
        <div className={styles.note}>10k→1 · 100k→3 · 1M→102 · 1B→10,000</div>
      </section>
    </aside>
  );
}
