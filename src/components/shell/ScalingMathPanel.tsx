import type { JSX } from "react";
import { useGameStore } from "@/store";
import { formatBig } from "@/core/formatter";
import { craftCost, tierUpgradeCost } from "@/core/balance";
import {
  getCanvasGoldMultiplier,
  getCanvasSpeedMultiplier,
  getInspiMultiplier,
  getTreeUpgradeCostMultiplier,
} from "@/core/multipliers";
import styles from "./ScalingMathPanel.module.css";

export function ScalingMathPanel(): JSX.Element {
  const workshopLevel = useGameStore((s) => s.workshopLevel);
  const canvasTier = useGameStore((s) => s.canvasTier);
  // Multiplier selectors are stable enough that one-shot reads here are fine —
  // every state change that affects them also bumps workshopLevel/canvasTier
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
        <div className={styles.formula}>10 × tier² × {goldMult.toFixed(2)}×</div>
        <div className={styles.note}>colors + items, × rainbow, × PM</div>
      </section>

      <section className={styles.section} data-testid="scaling-paint">
        <div className={styles.label}>Paint Time</div>
        <div className={styles.formula}>tier × 2s ÷ {speedMult.toFixed(2)}×</div>
      </section>

      <section className={styles.section} data-testid="scaling-craft-cost">
        <div className={styles.label}>Craft Cost (workshop Lv {workshopLevel})</div>
        <div className={styles.formula}>= {formatBig(craftCost(workshopLevel))} g</div>
      </section>

      <section className={styles.section} data-testid="scaling-tier-cost">
        <div className={styles.label}>Tier Upgrade Cost (tier {canvasTier})</div>
        <div className={styles.formula}>= {formatBig(tierUpgradeCost(canvasTier))} g</div>
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
