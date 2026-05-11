import type { JSX } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import {
  getEquippedContribution,
} from "@/store/workshopSlice";
import {
  getOfficeContribution,
  getColorTreeContribution,
  getRainbowMultiplier,
  getSkillTreeSpeedContribution,
  getCanvasGoldMultiplier,
  getCanvasSpeedMultiplier,
  getCritChance,
  getComboBaseChance,
  getSizeMultiplier,
} from "@/core/multipliers";
import {
  SELL_PRICE_PER_LEVEL,
  SPEED_PER_LEVEL,
  CRIT_PER_LEVEL,
  COMBO_PER_LEVEL,
  SIZE_GOLD_PER_LEVEL,
} from "@/core/balance";
import styles from "./StatsRoom.module.css";

interface BreakdownLine {
  source: string;
  value: number;
}

interface StatBlock {
  name: string;
  totalLabel: string;
  lines: BreakdownLine[];
  multiplicative?: { source: string; factor: number };
}

function fmtPct(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)}%`;
}

function fmtMult(v: number, digits = 2): string {
  return `×${v.toFixed(digits)}`;
}

function statBlocks(state: GameStore): StatBlock[] {
  const goldTotal = getCanvasGoldMultiplier(state);
  const speedTotal = getCanvasSpeedMultiplier(state);
  const critTotal = getCritChance(state);
  const comboTotal = getComboBaseChance(state);
  const sizeTotal = getSizeMultiplier(state);
  const rainbowFactor = getRainbowMultiplier(state);

  return [
    {
      name: "Sell Price (gold)",
      totalLabel: fmtMult(goldTotal),
      lines: [
        { source: "Canvas upgrade", value: SELL_PRICE_PER_LEVEL * state.sellPriceLevel },
        { source: "Skill tree (color)", value: getColorTreeContribution(state) },
        { source: "Items", value: getEquippedContribution(state, "+sell_price%") },
        { source: "Workers", value: getOfficeContribution(state, "+sell_price%").toNumber() },
      ],
      multiplicative: rainbowFactor > 1
        ? { source: "Rainbow", factor: rainbowFactor }
        : undefined,
    },
    {
      name: "Speed",
      totalLabel: fmtMult(speedTotal),
      lines: [
        { source: "Canvas upgrade", value: SPEED_PER_LEVEL * state.speedLevel },
        { source: "Skill tree", value: getSkillTreeSpeedContribution(state) },
        { source: "Items", value: getEquippedContribution(state, "+speed%") },
        { source: "Workers", value: getOfficeContribution(state, "+speed%").toNumber() },
      ],
    },
    {
      name: "Crit chance",
      totalLabel: fmtPct(critTotal),
      lines: [
        { source: "Canvas upgrade", value: CRIT_PER_LEVEL * state.critLevel },
        { source: "Items", value: getEquippedContribution(state, "+crit_chance%") },
        { source: "Workers", value: getOfficeContribution(state, "+crit_chance%").toNumber() },
      ],
    },
    {
      name: "Combo chance",
      totalLabel: fmtPct(comboTotal),
      lines: [
        { source: "Canvas upgrade", value: COMBO_PER_LEVEL * state.comboLevel },
        { source: "Items", value: getEquippedContribution(state, "+combo_chance%") },
        { source: "Workers", value: getOfficeContribution(state, "+combo_chance%").toNumber() },
      ],
    },
    {
      name: "Size",
      totalLabel: fmtMult(sizeTotal),
      lines: [
        { source: "Canvas upgrade", value: SIZE_GOLD_PER_LEVEL * state.sizeLevel },
        { source: "Items", value: getEquippedContribution(state, "+size%") },
        { source: "Workers", value: getOfficeContribution(state, "+size%").toNumber() },
      ],
    },
  ];
}

export function StatsRoom(): JSX.Element {
  const equipped = useGameStore((s) => s.equipped);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const roster = useGameStore((s) => s.roster);
  const sellPriceLevel = useGameStore((s) => s.sellPriceLevel);
  const speedLevel = useGameStore((s) => s.speedLevel);
  const sizeLevel = useGameStore((s) => s.sizeLevel);
  const critLevel = useGameStore((s) => s.critLevel);
  const comboLevel = useGameStore((s) => s.comboLevel);

  const helperState = {
    equipped, purchasedNodes, roster,
    sellPriceLevel, speedLevel, sizeLevel, critLevel, comboLevel,
  } as unknown as GameStore;

  const blocks = statBlocks(helperState);

  return (
    <section className={styles.room} aria-label="Stats">
      <header className={styles.header}>
        <h2 className={styles.title}>Stats</h2>
        <p className={styles.subtitle}>Aggregated bonuses by source.</p>
      </header>
      {blocks.map((block) => (
        <article key={block.name} className={styles.block}>
          <header className={styles.blockHeader}>
            <span className={styles.blockName}>{block.name}</span>
            <span className={styles.blockTotal}>{block.totalLabel}</span>
          </header>
          <ul className={styles.lines}>
            {block.lines.map((line) => (
              <li key={line.source} className={styles.line}>
                <span className={styles.source}>{line.source}</span>
                <span className={styles.value}>+{fmtPct(line.value)}</span>
              </li>
            ))}
            {block.multiplicative && (
              <li className={styles.line}>
                <span className={styles.source}>{block.multiplicative.source}</span>
                <span className={styles.value}>{fmtMult(block.multiplicative.factor)}</span>
              </li>
            )}
          </ul>
        </article>
      ))}
    </section>
  );
}
