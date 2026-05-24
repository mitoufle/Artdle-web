import { big, type Big } from "@/core/bigNumber";
import {
  canvasGold, canvasTime,
  COMBO_DECAY_PER_LINK, comboBonusFactor, comboEffectiveChance,
} from "@/core/balance";
import {
  getCanvasGoldMultiplier, getCanvasSpeedMultiplier,
  getCritChance, getCritChunks, getComboBaseChance, getCanvasSize, getComboDecayReduction,
} from "@/core/multipliers";
import { getSketchGridDim } from "@/components/painting/canvasArt";
import { rng } from "@/core/rng";
import {
  addCurrency, trackSaleGoldPure, awardOfficeXpPure,
  incrementStatPure, patchRunStatsPure, type DraftState,
} from "@/core/pureMutations";

const MAX_SALES_PER_TICK = 1000;

/**
 * Canvas-paint tick. Steps in INTEGER chunk units to avoid floating-point
 * drift that previously caused the loop to re-roll bonus chunks at near-zero
 * timeBudget cost (inflating the visible crit rate ~5x).
 *
 * Each iteration crosses one PAID chunk boundary (consumes chunkTime from
 * timeBudget) and rolls crit once. A successful roll instantly paints
 * `getCritChunks(draft)` BONUS chunks at no timeBudget cost. Bonus chunks
 * don't re-roll; the chain is finite.
 *
 * To guarantee the player sees at least (1 + bonus) cells flash on every
 * crit, the roll is skipped on the canvas's last chunk (where a sale fires
 * in the same iteration and would wipe critChunks before the next render).
 */
export function canvasTickPure(draft: DraftState, deltaSeconds: number): void {
  if (deltaSeconds <= 0) return;

  let chain = draft.comboChain;
  let critChunks: Record<number, true> = { ...draft.critChunks };
  let lastSaleId = draft.lastSale?.id ?? 0;
  let lastSaleAmount: Big | null = null;

  let timeBudget = deltaSeconds;
  let sales = 0;

  let localCritStreak = draft.statsRun.currentCritStreak;
  let localMaxCritStreak = draft.statsRun.maxCritStreak;
  let localMaxCombo = draft.statsRun.maxComboChain;
  let critChunksThisTick = 0;
  let salesThisTick = 0;
  let tickGoldTotal = big(0);

  // Decompose persisted seconds-progress into integer chunk count + sub-chunk
  // residual time. chunkProgress = number of chunks completed in the current
  // canvas (0..chunkCount). subTime = time spent on the NEXT chunk so far.
  const chunkCount = getSketchGridDim(draft.canvasTier) ** 2;
  const initialChunkTime =
    (canvasTime(getCanvasSize(draft), draft.canvasTier) /
      getCanvasSpeedMultiplier(draft)) /
    chunkCount;
  let chunkProgress = Math.max(0, Math.floor(draft.canvasProgress / initialChunkTime));
  if (chunkProgress >= chunkCount) chunkProgress = 0;
  let subTime = Math.max(0, draft.canvasProgress - chunkProgress * initialChunkTime);

  const fireSale = (): void => {
    const size = getCanvasSize(draft);
    const goldMult = getCanvasGoldMultiplier(draft);
    const baseGold = canvasGold(size, goldMult, draft.canvasTier);
    const gain = baseGold.mul(comboBonusFactor(chain));

    addCurrency(draft, "gold", gain);
    trackSaleGoldPure(draft, gain);
    awardOfficeXpPure(draft, gain);

    sales += 1;
    salesThisTick += 1;
    chunkProgress = 0;
    subTime = 0;
    tickGoldTotal = tickGoldTotal.add(gain);
    if (chain > localMaxCombo) localMaxCombo = chain;

    const baseChance = getComboBaseChance(draft);
    const decay = Math.max(0, COMBO_DECAY_PER_LINK - getComboDecayReduction(draft));
    const effChance = comboEffectiveChance(baseChance, chain, decay);
    chain = (rng() < effChance) ? chain + 1 : 0;

    lastSaleId += 1;
    lastSaleAmount = gain;

    critChunks = {};
  };

  while (timeBudget > 0 && sales < MAX_SALES_PER_TICK) {
    // Per-iteration chunkTime (state may shift mid-tick — speed buffs etc.).
    const size = getCanvasSize(draft);
    const baseTime = canvasTime(size, draft.canvasTier);
    const speedMult = getCanvasSpeedMultiplier(draft);
    const chunkTime = (baseTime / speedMult) / chunkCount;

    const timeToNext = Math.max(0, chunkTime - subTime);

    // Epsilon-tolerant: float drift from repeated `timeBudget -= chunkTime`
    // can leave timeBudget short of timeToNext by ~1e-15 per subtraction.
    // Without this, a tick of exactly N * chunkTime fires N-1 sales instead of N.
    const TIME_EPSILON = 1e-9;
    if (timeBudget < timeToNext - TIME_EPSILON) {
      // Not enough time to finish this chunk; carry into next tick.
      subTime += Math.max(0, timeBudget);
      timeBudget = 0;
      break;
    }

    // Cross one PAID chunk boundary.
    timeBudget -= timeToNext;
    subTime = 0;
    chunkProgress += 1;
    const triggerIndex = chunkProgress - 1;
    const isLastChunkOfCanvas = chunkProgress === chunkCount;

    // Roll crit on this paid chunk. Skipped on the canvas's last chunk so
    // the trigger + bonus markers survive long enough to render (otherwise
    // the imminent sale wipes critChunks before the UI sees them).
    if (!isLastChunkOfCanvas && rng() < getCritChance(draft)) {
      const bonus = getCritChunks(draft);
      // Cap bonus at remaining chunks in this canvas; overshoot is wasted.
      const remainingChunks = chunkCount - chunkProgress;
      const appliedBonus = Math.min(bonus, remainingChunks);

      critChunks[triggerIndex] = true;
      for (let i = 1; i <= appliedBonus; i++) {
        critChunks[triggerIndex + i] = true;
      }
      chunkProgress += appliedBonus;

      const totalCritChunks = 1 + appliedBonus;
      critChunksThisTick += totalCritChunks;
      localCritStreak += totalCritChunks;
      if (localCritStreak > localMaxCritStreak) localMaxCritStreak = localCritStreak;
    } else if (!isLastChunkOfCanvas) {
      localCritStreak = 0;
    }

    // Sale check (paid chunk OR bonus chunks may have completed the canvas).
    if (chunkProgress >= chunkCount) {
      fireSale();
    }
  }

  if (salesThisTick > 0 || critChunksThisTick > 0) {
    if (critChunksThisTick > 0) {
      incrementStatPure(draft, "lifetime", "critsLanded", critChunksThisTick);
      incrementStatPure(draft, "run", "critsLanded", critChunksThisTick);
    }
    if (salesThisTick > 0) {
      incrementStatPure(draft, "lifetime", "canvasesSold", salesThisTick);
      incrementStatPure(draft, "run", "canvasesSold", salesThisTick);
      if (localMaxCombo > draft.statsLifetime.maxComboChain) {
        incrementStatPure(draft, "lifetime", "maxComboChain", localMaxCombo - draft.statsLifetime.maxComboChain);
      }
    }
    patchRunStatsPure(draft, {
      currentCritStreak: localCritStreak,
      maxCritStreak: localMaxCritStreak,
      maxComboChain: localMaxCombo,
      goldEarned: draft.statsRun.goldEarned.add(tickGoldTotal),
    });
  }

  // Re-serialize chunkProgress + subTime back to canvasProgress (seconds).
  const finalChunkTime =
    (canvasTime(getCanvasSize(draft), draft.canvasTier) /
      getCanvasSpeedMultiplier(draft)) /
    chunkCount;
  draft.canvasProgress = chunkProgress * finalChunkTime + subTime;
  draft.comboChain = chain;
  draft.critChunks = critChunks;
  if (lastSaleAmount !== null) {
    draft.lastSale = { id: lastSaleId, amount: lastSaleAmount };
  }
}
