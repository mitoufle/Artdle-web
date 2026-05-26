import { big, type Big } from "@/core/bigNumber";
import {
  chunksPerCanvas, goldPerChunk, chunkInterval,
  COMBO_DECAY_PER_LINK, comboBonusFactor, comboEffectiveChance,
} from "@/core/balance";
import {
  getCanvasGoldMultiplier, getCanvasSpeedMultiplier,
  getCritChance, getCritChunks, getComboBaseChance, getComboDecayReduction,
} from "@/core/multipliers";
import { rng } from "@/core/rng";
import {
  addCurrency, trackSaleGoldPure, awardOfficeXpPure,
  incrementStatPure, patchRunStatsPure, type DraftState,
} from "@/core/pureMutations";

const MAX_SALES_PER_TICK = 1000;

/**
 * Chunk-domain canvas tick. `canvasProgress` is now a FLOAT in [0, chunkCount):
 *   floor(canvasProgress) = whole chunks completed (gold already paid)
 *   fractional part       = sub-chunk progress toward the next chunk
 *
 * Each tick:
 *   1. Compute chunkInterval from current speed multiplier.
 *   2. Add deltaSeconds / chunkInterval to canvasProgress.
 *   3. For each integer crossed: credit `goldPerChunk` × combo bonus,
 *      roll crit (which may insert bonus chunks at no time cost),
 *      and if the canvas fills, fire the sale event + reset progress.
 *
 * lastSale fires on the chunk that completes a canvas, not as a separate
 * event — so the existing FloatingGoldText animation triggers on the final
 * chunk's payout.
 */
export function canvasTickPure(draft: DraftState, deltaSeconds: number): void {
  if (deltaSeconds <= 0) return;

  const chunkCount = chunksPerCanvas(draft.canvasTier);
  const speedMult = getCanvasSpeedMultiplier(draft);
  const interval = chunkInterval(speedMult);
  if (interval <= 0) return;

  let chain = draft.comboChain;
  let critChunks: Record<number, true> = { ...draft.critChunks };
  let lastSaleId = draft.lastSale?.id ?? 0;
  let lastSaleAmount: Big | null = null;

  let progress = draft.canvasProgress;
  let timeBudget = deltaSeconds;
  let sales = 0;
  let salesThisTick = 0;
  let critChunksThisTick = 0;
  let tickGoldTotal = big(0);
  let localCritStreak = draft.statsRun.currentCritStreak;
  let localMaxCritStreak = draft.statsRun.maxCritStreak;
  let localMaxCombo = draft.statsRun.maxComboChain;

  const payChunk = (chunkIndex: number): void => {
    const goldMult = getCanvasGoldMultiplier(draft);
    const perChunk = goldPerChunk(draft.sellPriceLevel, goldMult, draft.canvasTier);
    const gain = perChunk.mul(comboBonusFactor(chain));

    addCurrency(draft, "gold", gain);
    trackSaleGoldPure(draft, gain);
    awardOfficeXpPure(draft, gain);
    tickGoldTotal = tickGoldTotal.add(gain);

    // The chunk that completes the canvas also fires the lastSale animation
    // and starts a new canvas (combo decision, reset progress).
    if (chunkIndex + 1 >= chunkCount) {
      lastSaleId += 1;
      lastSaleAmount = gain;
      sales += 1;
      salesThisTick += 1;
      progress = 0;
      critChunks = {};

      if (chain > localMaxCombo) localMaxCombo = chain;
      const baseChance = getComboBaseChance(draft);
      const decay = Math.max(0, COMBO_DECAY_PER_LINK - getComboDecayReduction(draft));
      const effChance = comboEffectiveChance(baseChance, chain, decay);
      chain = rng() < effChance ? chain + 1 : 0;
    }
  };

  while (timeBudget > 0 && sales < MAX_SALES_PER_TICK) {
    const TIME_EPSILON = 1e-9;
    const fractionalChunkLeft = (Math.floor(progress) + 1) - progress;
    const timeToNextChunk = fractionalChunkLeft * interval;

    if (timeBudget < timeToNextChunk - TIME_EPSILON) {
      progress += timeBudget / interval;
      timeBudget = 0;
      break;
    }

    // Cross one paid chunk boundary.
    timeBudget -= timeToNextChunk;
    const completedChunkIndex = Math.floor(progress);
    progress = completedChunkIndex + 1;

    // Roll crit (skip on the canvas's last chunk so trigger + first bonus
    // stay together — matches old behavior).
    const isLastChunkOfCanvas = completedChunkIndex + 1 >= chunkCount;
    if (!isLastChunkOfCanvas && rng() < getCritChance(draft)) {
      const bonus = getCritChunks(draft);
      critChunks[completedChunkIndex] = true;

      payChunk(completedChunkIndex);

      let bonusLeft = bonus;
      while (bonusLeft > 0 && sales < MAX_SALES_PER_TICK) {
        const bonusIndex = Math.floor(progress);
        if (bonusIndex >= chunkCount) break;
        critChunks[bonusIndex] = true;
        progress = bonusIndex + 1;
        payChunk(bonusIndex);
        bonusLeft -= 1;
      }

      const totalCritChunks = 1 + bonus;
      critChunksThisTick += totalCritChunks;
      localCritStreak += totalCritChunks;
      if (localCritStreak > localMaxCritStreak) localMaxCritStreak = localCritStreak;
    } else {
      payChunk(completedChunkIndex);
      if (!isLastChunkOfCanvas) localCritStreak = 0;
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

  draft.canvasProgress = progress;
  draft.comboChain = chain;
  draft.critChunks = critChunks;
  if (lastSaleAmount !== null) {
    draft.lastSale = { id: lastSaleId, amount: lastSaleAmount };
  }
}
