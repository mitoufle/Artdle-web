import { useMemo, type JSX } from "react";
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
  getCanvasSize,
} from "@/core/multipliers";
import {
  SELL_PRICE_PER_LEVEL,
  SPEED_PER_LEVEL,
  CRIT_PER_LEVEL,
  COMBO_PER_LEVEL,
  SIZE_PER_LEVEL,
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
  multiplicatives?: Array<{ source: string; factor: number }>;
}

interface SizeBlock {
  name: "Size";
  size: number;             // total size value (base 1)
  canvasContribution: number;   // SIZE_PER_LEVEL × sizeLevel
  itemContribution: number;
  workerContribution: number;
  goldFactor: number;       // size²
  timeFactor: number;       // size
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
  const size = getCanvasSize(state);
  const sizeGoldFactor = size * size;
  const rainbowFactor = getRainbowMultiplier(state);

  const sellMultiplicatives: Array<{ source: string; factor: number }> = [];
  if (rainbowFactor > 1) sellMultiplicatives.push({ source: "Rainbow", factor: rainbowFactor });
  if (sizeGoldFactor > 1) sellMultiplicatives.push({ source: "Size² factor", factor: sizeGoldFactor });

  const effectiveGold = goldTotal * sizeGoldFactor;

  return [
    {
      name: "Sell Price (gold)",
      totalLabel: fmtMult(effectiveGold),
      lines: [
        { source: "Canvas upgrade", value: SELL_PRICE_PER_LEVEL * state.sellPriceLevel },
        { source: "Skill tree (color)", value: getColorTreeContribution(state) },
        { source: "Items", value: getEquippedContribution(state, "+sell_price%") },
        { source: "Workers", value: getOfficeContribution(state, "+sell_price%").toNumber() },
      ],
      ...(sellMultiplicatives.length > 0 ? { multiplicatives: sellMultiplicatives } : {}),
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
  ];
}

function sizeBlock(state: GameStore): SizeBlock {
  const size = getCanvasSize(state);
  const canvasContribution = SIZE_PER_LEVEL * state.sizeLevel;
  const itemContribution = getEquippedContribution(state, "+size%");
  const workerContribution = getOfficeContribution(state, "+size%").toNumber();
  return {
    name: "Size",
    size,
    canvasContribution,
    itemContribution,
    workerContribution,
    goldFactor: size * size,
    timeFactor: size,
  };
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

  const { blocks, size } = useMemo(() => {
    const helperState = {
      equipped, purchasedNodes, roster,
      sellPriceLevel, speedLevel, sizeLevel, critLevel, comboLevel,
    } as unknown as GameStore;
    return { blocks: statBlocks(helperState), size: sizeBlock(helperState) };
  }, [equipped, purchasedNodes, roster, sellPriceLevel, speedLevel, sizeLevel, critLevel, comboLevel]);

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
            {block.multiplicatives?.map((m) => (
              <li key={m.source} className={styles.line}>
                <span className={styles.source}>{m.source}</span>
                <span className={styles.value}>{fmtMult(m.factor)}</span>
              </li>
            ))}
          </ul>
        </article>
      ))}
      <article className={styles.block}>
        <header className={styles.blockHeader}>
          <span className={styles.blockName}>Size</span>
          <span className={styles.blockTotal}>{fmtMult(size.size)}</span>
        </header>
        <ul className={styles.lines}>
          <li className={styles.line}>
            <span className={styles.source}>Base</span>
            <span className={styles.value}>×1.00</span>
          </li>
          <li className={styles.line}>
            <span className={styles.source}>Canvas upgrade</span>
            <span className={styles.value}>+{fmtPct(size.canvasContribution)}</span>
          </li>
          <li className={styles.line}>
            <span className={styles.source}>Items</span>
            <span className={styles.value}>+{fmtPct(size.itemContribution)}</span>
          </li>
          <li className={styles.line}>
            <span className={styles.source}>Workers</span>
            <span className={styles.value}>+{fmtPct(size.workerContribution)}</span>
          </li>
          <li className={styles.line}>
            <span className={styles.source}>Gold factor (size²)</span>
            <span className={styles.value}>{fmtMult(size.goldFactor)}</span>
          </li>
          <li className={styles.line}>
            <span className={styles.source}>Time factor (size)</span>
            <span className={styles.value}>{fmtMult(size.timeFactor)}</span>
          </li>
        </ul>
      </article>
    </section>
  );
}
