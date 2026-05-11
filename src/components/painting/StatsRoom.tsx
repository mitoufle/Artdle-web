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
  getSizeMultiplier,
} from "@/core/multipliers";
import {
  SELL_PRICE_PER_LEVEL,
  SPEED_PER_LEVEL,
  CRIT_PER_LEVEL,
  COMBO_PER_LEVEL,
  SIZE_GOLD_PER_LEVEL,
  SIZE_TIME_PER_LEVEL,
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
  sizeLevel: number;
  itemContribution: number;
  workerContribution: number;
  sizeMult: number;
  effectiveGoldPct: number;
  effectiveTimePct: number;
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
  const sizeMult = getSizeMultiplier(state);
  const rainbowFactor = getRainbowMultiplier(state);
  const sizeFactor = 1 + SIZE_GOLD_PER_LEVEL * sizeMult * state.sizeLevel;

  const sellMultiplicatives: Array<{ source: string; factor: number }> = [];
  if (rainbowFactor > 1) sellMultiplicatives.push({ source: "Rainbow", factor: rainbowFactor });
  if (state.sizeLevel > 0) sellMultiplicatives.push({ source: "Size factor", factor: sizeFactor });

  const effectiveGold = goldTotal * sizeFactor;

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
  const sizeMult = getSizeMultiplier(state);
  const itemContribution = getEquippedContribution(state, "+size%");
  const workerContribution = getOfficeContribution(state, "+size%").toNumber();
  return {
    name: "Size",
    sizeLevel: state.sizeLevel,
    itemContribution,
    workerContribution,
    sizeMult,
    effectiveGoldPct: SIZE_GOLD_PER_LEVEL * sizeMult * state.sizeLevel,
    effectiveTimePct: SIZE_TIME_PER_LEVEL * sizeMult * state.sizeLevel,
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
          <span className={styles.blockTotal}>Lv {size.sizeLevel} × {fmtMult(size.sizeMult)}</span>
        </header>
        <ul className={styles.lines}>
          <li className={styles.line}>
            <span className={styles.source}>Canvas size level</span>
            <span className={styles.value}>{size.sizeLevel}</span>
          </li>
          <li className={styles.line}>
            <span className={styles.source}>Items (→ mult)</span>
            <span className={styles.value}>+{fmtPct(size.itemContribution)}</span>
          </li>
          <li className={styles.line}>
            <span className={styles.source}>Workers (→ mult)</span>
            <span className={styles.value}>+{fmtPct(size.workerContribution)}</span>
          </li>
          <li className={styles.line}>
            <span className={styles.source}>Effective gold/canvas</span>
            <span className={styles.value}>+{fmtPct(size.effectiveGoldPct)}</span>
          </li>
          <li className={styles.line}>
            <span className={styles.source}>Effective time/canvas</span>
            <span className={styles.value}>+{fmtPct(size.effectiveTimePct)}</span>
          </li>
        </ul>
      </article>
    </section>
  );
}
