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

  // Multipliers are invariant over a single tick (no input field they read
  // changes mid-tick), so hoist them out of the per-chunk hot path. At T8+
  // canvases can have 1000+ chunks per tick during catch-up; recomputing
  // these inside the loop would be a real regression.
  const goldMult = getCanvasGoldMultiplier(draft);
  const perChunkBase = goldPerChunk(draft.sellPriceLevel, goldMult, draft.canvasTier);
  const critChance = getCritChance(draft);
  const critChunksPerCrit = getCritChunks(draft);

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
    const gain = perChunkBase.mul(comboBonusFactor(chain));

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
    if (!isLastChunkOfCanvas && rng() < critChance) {
      critChunks[completedChunkIndex] = true;

      payChunk(completedChunkIndex);

      // Bonus chunks intentionally SPILL across canvas boundaries — no crit
      // benefit is wasted. payChunk resets progress to 0 when a canvas
      // completes, so the next iteration paints chunk 0 of the new canvas.
      let bonusLeft = critChunksPerCrit;
      while (bonusLeft > 0 && sales < MAX_SALES_PER_TICK) {
        const bonusIndex = Math.floor(progress);
        critChunks[bonusIndex] = true;
        progress = bonusIndex + 1;
        payChunk(bonusIndex);
        bonusLeft -= 1;
      }

      const totalCritChunks = 1 + critChunksPerCrit;
      critChunksThisTick += totalCritChunks;
      localCritStreak += totalCritChunks;
      if (localCritStreak > localMaxCritStreak) localMaxCritStreak = localCritStreak;
    } else {
      payChunk(completedChunkIndex);
      if (!isLastChunkOfCanvas) localCritStreak = 0;
    }
  }

  if (salesThisTick > 0 || critChunksThisTick > 0 || tickGoldTotal.gt(0)) {
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
