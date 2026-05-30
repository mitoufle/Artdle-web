import { useMemo, type JSX } from "react";
import { useGameStore } from "@/store";
import type { CanvasMultiplierInputs } from "@/core/multipliers";
import type { AffixKind } from "@/config/workshopAffixes";
import {
  getEquippedContribution,
} from "@/store/workshopSlice";
import {
  getColorTreeContribution,
  getRainbowMultiplier,
  getSkillTreeSpeedContribution,
  getCanvasGoldMultiplier,
  getCanvasSpeedMultiplier,
  getSchoolGoldContribution,
  getAchievementGoldContribution,
  getSchoolSpeedContribution,
  getAchievementSpeedContribution,
  getCritChance,
  getComboBaseChance,
} from "@/core/multipliers";
import {
  SELL_PRICE_PER_LEVEL,
  SPEED_PER_LEVEL,
  CRIT_PER_LEVEL,
  COMBO_PER_LEVEL,
  BASE_CRIT_CHANCE,
  BASE_CRIT_CHUNKS,
  MAX_CRIT_LEVEL,
  tierFactor,
  chunksPerCanvas,
  chunkInterval,
  goldPerChunk,
  canvasGold,
} from "@/core/balance";
import { big } from "@/core/bigNumber";
import { formatBig } from "@/core/formatter";
import { countCapability, getNodeLevel } from "@/store/skillTreeSlice";
import { AFFIX_SYMBOL, AFFIX_COLOR, AFFIX_SYMBOL_SCALE } from "@/config/workshopAffixes";
import type { SlotKind } from "@/store/workshopSlice";
import styles from "./StatsRoom.module.css";

interface BreakdownLine {
  source: string;
  value: number;
}

interface StatBlock {
  name: string;
  kind?: AffixKind;
  iconOverride?: string;
  colorOverride?: string;
  totalLabel: string;
  /** When true, lines render as raw integers (with no "+" prefix), not percent. */
  intLines?: boolean;
  lines: BreakdownLine[];
  multiplicatives?: Array<{ source: string; factor: number }>;
}

function fmtPct(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)}%`;
}

function fmtMult(v: number, digits = 2): string {
  return `×${v.toFixed(digits)}`;
}

/**
 * Effective additional chunks contributed by equipped items: their +crit_chunks
 * magnitudes are read as a PERCENT of BASE_CRIT_CHUNKS (socks x1.5 on boots).
 * Mirrors the items branch of `getCritChunks` in multipliers.ts.
 */
function critChunksFromItems(state: CanvasMultiplierInputs): number {
  const hasSocks = getNodeLevel(state, "socks") > 0;
  let itemPct = 0;
  for (const entry of Object.entries(state.equipped)) {
    const [slot, item] = entry as [SlotKind, { affixes: readonly { kind: string; magnitude: number }[] } | undefined];
    if (!item) continue;
    const slotMult = hasSocks && slot === "boots" ? 1.5 : 1.0;
    for (const affix of item.affixes) {
      if (affix.kind === "+crit_chunks") itemPct += (affix.magnitude / 100) * slotMult;
    }
  }
  return BASE_CRIT_CHUNKS * itemPct;
}

function statBlocks(state: CanvasMultiplierInputs): StatBlock[] {
  const goldTotal = getCanvasGoldMultiplier(state);
  const speedTotal = getCanvasSpeedMultiplier(state);
  const critTotal = getCritChance(state);
  const comboTotal = getComboBaseChance(state);
  const chunksItems = critChunksFromItems(state);
  // The chunk that triggers the crit is also painted by the crit, so it counts
  // toward what the player sees advance per crit (Trigger + Base + Items).
  const TRIGGER_CHUNK = 1;
  const chunksTotal = TRIGGER_CHUNK + BASE_CRIT_CHUNKS + chunksItems;
  const rainbowFactor = getRainbowMultiplier(state);

  // Size² multiplicative is gone with the chunk-domain rework — Rainbow is the
  // only remaining multiplicative on the sell-price block.
  const sellMultiplicatives: Array<{ source: string; factor: number }> = [];
  if (rainbowFactor > 1) sellMultiplicatives.push({ source: "Rainbow", factor: rainbowFactor });

  // Hide contributors that grant 0 — keeps locked/unowned features out of view
  // until they actually start contributing (no spoilers).
  const nonZero = (lines: BreakdownLine[]): BreakdownLine[] => lines.filter((l) => l.value > 0);

  return [
    {
      name: "Sell Price (gold)",
      kind: "+sell_price%" as AffixKind,
      totalLabel: fmtMult(goldTotal),
      lines: nonZero([
        { source: "Canvas upgrade", value: SELL_PRICE_PER_LEVEL * state.sellPriceLevel },
        { source: "Skill tree (color)", value: getColorTreeContribution(state) },
        { source: "Items", value: getEquippedContribution(state, "+sell_price%") },
        { source: "School", value: getSchoolGoldContribution(state) },
        { source: "Achievements", value: getAchievementGoldContribution(state) },
      ]),
      ...(sellMultiplicatives.length > 0 ? { multiplicatives: sellMultiplicatives } : {}),
    },
    {
      name: "Speed",
      kind: "+speed%" as AffixKind,
      totalLabel: fmtMult(speedTotal),
      lines: nonZero([
        { source: "Canvas upgrade", value: SPEED_PER_LEVEL * state.speedLevel },
        { source: "Skill tree", value: getSkillTreeSpeedContribution(state) },
        { source: "Items", value: getEquippedContribution(state, "+speed%") },
        { source: "School", value: getSchoolSpeedContribution(state) },
        { source: "Achievements", value: getAchievementSpeedContribution(state) },
      ]),
    },
    {
      name: "Crit chance (per stroke)",
      iconOverride: "✦",
      colorOverride: "#e85c5c",
      totalLabel: fmtPct(critTotal),
      lines: nonZero([
        { source: "Base", value: BASE_CRIT_CHANCE },
        { source: "Canvas upgrade", value: CRIT_PER_LEVEL * Math.min(state.critLevel, MAX_CRIT_LEVEL) },
        { source: "Skill tree", value: countCapability(state, "crit_chance") * 0.01 },
        // Items + Workers no longer contribute to crit chance — that's now crit_chunks (separate stat).
      ]),
    },
    {
      name: "Combo chance",
      kind: "+combo_chance%" as AffixKind,
      totalLabel: fmtPct(comboTotal),
      lines: nonZero([
        { source: "Canvas upgrade", value: COMBO_PER_LEVEL * state.comboLevel },
        { source: "Items", value: getEquippedContribution(state, "+combo_chance%") },
      ]),
    },
    {
      name: "Strokes per crit",
      iconOverride: "⚡",
      colorOverride: "#ffaf3a",
      totalLabel: `${chunksTotal.toFixed(chunksTotal % 1 === 0 ? 0 : 1)}`,
      intLines: true,
      lines: nonZero([
        { source: "Trigger", value: TRIGGER_CHUNK },
        { source: "Bonus (base)", value: BASE_CRIT_CHUNKS },
        // Items scale the base by a percent; show that % in the label, with the
        // resolved chunk contribution as the value (keeps the block a count stat).
        { source: chunksItems > 0 ? `Items (+${Math.round((chunksItems / BASE_CRIT_CHUNKS) * 100)}%)` : "Items", value: chunksItems },
      ]),
    },
  ];
}

/**
 * Chunk-domain canvas summary. Replaces the old "Canvas Tier" block (which
 * exposed only the raw tier multipliers) with the rolled-up metrics players
 * actually reason about: chunks per canvas, per-chunk interval, per-chunk and
 * per-canvas gold, and gold-per-second at base.
 *
 * No "Upgrade costs ×N" row — the chunk-domain rework decoupled within-tier
 * track costs from the tier index (costTierFactor was dropped from the four
 * surviving *UpgradeCost functions).
 */
function CanvasBlock({ helperState, tier }: { helperState: CanvasMultiplierInputs; tier: number }): JSX.Element {
  const chunks = chunksPerCanvas(tier);
  const speedMult = getCanvasSpeedMultiplier(helperState);
  const interval = chunkInterval(speedMult);
  const goldMult = getCanvasGoldMultiplier(helperState);
  const perChunk = goldPerChunk(helperState.sellPriceLevel, goldMult, tier);
  const perCanvas = canvasGold(goldMult, tier);
  const gps = interval > 0 ? perChunk.toNumber() / interval : 0;

  return (
    <article className={styles.block}>
      <header className={styles.blockHeader}>
        <span className={styles.blockName}>Canvas</span>
        <span className={styles.blockTotal}>T{tier}</span>
      </header>
      <ul className={styles.lines}>
        <li className={styles.line}>
          <span className={styles.source}>Strokes per canvas</span>
          <span className={styles.value}>{chunks}</span>
        </li>
        <li className={styles.line}>
          <span className={styles.source}>Interval per stroke</span>
          <span className={styles.value}>{interval.toFixed(2)}s</span>
        </li>
        <li className={styles.line}>
          <span className={styles.source}>Gold per stroke</span>
          <span className={styles.value}>{formatBig(perChunk)}</span>
        </li>
        <li className={styles.line}>
          <span className={styles.source}>Gold per canvas</span>
          <span className={styles.value}>{formatBig(perCanvas)}</span>
        </li>
        <li className={styles.line}>
          <span className={styles.source}>GPS at base</span>
          <span className={styles.value}>{formatBig(big(gps))}/s</span>
        </li>
        <li className={styles.line}>
          <span className={styles.source}>Base gold multiplier</span>
          <span className={styles.value}>×{tierFactor(tier)}</span>
        </li>
      </ul>
    </article>
  );
}

export function StatsRoom(): JSX.Element {
  const equipped = useGameStore((s) => s.equipped);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const sellPriceLevel = useGameStore((s) => s.sellPriceLevel);
  const speedLevel = useGameStore((s) => s.speedLevel);
  const critLevel = useGameStore((s) => s.critLevel);
  const comboLevel = useGameStore((s) => s.comboLevel);

  const canvasTier = useGameStore((s) => s.canvasTier);
  const completedResearches = useGameStore((s) => s.completedResearches);
  const completedAchievements = useGameStore((s) => s.completedAchievements);
  const { blocks, helperState } = useMemo(() => {
    const helperState: CanvasMultiplierInputs = {
      equipped, purchasedNodes, canvasTier,
      sellPriceLevel, speedLevel, critLevel, comboLevel,
      completedResearches,
      completedAchievements,
    };
    return { blocks: statBlocks(helperState), helperState };
  }, [equipped, purchasedNodes, canvasTier, sellPriceLevel, speedLevel, critLevel, comboLevel, completedResearches, completedAchievements]);

  // Hide entire blocks that have no contributors and no multiplicatives — keeps
  // locked mechanics (Crit/Combo before their skill nodes are bought) out of
  // view. The Sell Price and Speed blocks always have a baseline Canvas-upgrade
  // contribution (sellPriceLevel/speedLevel default to 1) so they never hide.
  const visibleBlocks = blocks.filter(
    (b) => b.lines.length > 0 || (b.multiplicatives?.length ?? 0) > 0,
  );

  return (
    <section className={styles.room} aria-label="Stats">
      <header className={styles.header}>
        <h2 className={styles.title}>Stats</h2>
        <p className={styles.subtitle}>Aggregated bonuses by source.</p>
      </header>
      <CanvasBlock helperState={helperState} tier={canvasTier} />
      {visibleBlocks.map((block) => (
        <article key={block.name} className={styles.block}>
          <header className={styles.blockHeader}>
            <span className={styles.blockName}>
              <span style={{
                color: block.colorOverride ?? (block.kind ? AFFIX_COLOR[block.kind] : "var(--ink-2)"),
                fontSize: `${13 * (block.kind ? AFFIX_SYMBOL_SCALE[block.kind] : 1.0)}px`,
              }}>
                {block.iconOverride ?? (block.kind ? AFFIX_SYMBOL[block.kind] : "?")}
              </span>{" "}{block.name}
            </span>
            <span className={styles.blockTotal}>{block.totalLabel}</span>
          </header>
          <ul className={styles.lines}>
            {block.lines.map((line) => (
              <li key={line.source} className={styles.line}>
                <span className={styles.source}>{line.source}</span>
                <span className={styles.value}>
                  {block.intLines
                    ? `+${line.value.toFixed(line.value % 1 === 0 ? 0 : 1)}`
                    : `+${fmtPct(line.value)}`}
                </span>
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
    </section>
  );
}
