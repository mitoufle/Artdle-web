import { big, type Big } from "@/core/bigNumber";
import {
  canvasGold, chunksPerCanvas, chunkInterval,
  COMBO_DECAY_PER_LINK, comboBonusFactor, comboEffectiveChance,
} from "@/core/balance";
import {
  getCanvasGoldMultiplier, getCanvasSpeedMultiplier,
  getCritChance, getCritChunks, getComboBaseChance, getComboDecayReduction,
} from "@/core/multipliers";
import { rng } from "@/core/rng";
import {
  addCurrency, trackSaleGoldPure,
  incrementStatPure, patchRunStatsPure, type DraftState,
} from "@/core/pureMutations";

const MAX_SALES_PER_TICK = 1000;

/**
 * Chunk-domain canvas tick. `canvasProgress` is a FLOAT in [0, chunkCount):
 *   floor(canvasProgress) = whole chunks completed (no gold yet)
 *   fractional part       = sub-chunk progress toward the next chunk
 *
 * Gold is paid as a single lump sum when a canvas completes, NOT per chunk.
 * Crit chunks accelerate canvas completion (insert bonus chunks at no time
 * cost) but the gold-earning event is still the canvas-sale on the final
 * chunk. The faster a canvas fills, the sooner the player sees gold.
 */
export function canvasTickPure(draft: DraftState, deltaSeconds: number): void {
  if (deltaSeconds <= 0) return;

  const chunkCount = chunksPerCanvas(draft.canvasTier);
  const speedMult = getCanvasSpeedMultiplier(draft);
  const interval = chunkInterval(speedMult);
  if (interval <= 0) return;

  // Multipliers are invariant over a single tick (no input field they read
  // changes mid-tick). Hoist them; at T8+ a tick can complete many canvases
  // in one catch-up call, and recomputing per-canvas would be a regression.
  const goldMult = getCanvasGoldMultiplier(draft);
  const baseSaleGold = canvasGold(goldMult, draft.canvasTier);
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

  // Called when a chunk completes. If that chunk fills the canvas, fires the
  // canvas-sale (full gold lump + lastSale animation) and resets progress.
  const onChunkComplete = (chunkIndex: number): void => {
    if (chunkIndex + 1 < chunkCount) return;

    const gain = baseSaleGold.mul(comboBonusFactor(chain));
    addCurrency(draft, "gold", gain);
    trackSaleGoldPure(draft, gain);
    tickGoldTotal = tickGoldTotal.add(gain);

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
      onChunkComplete(completedChunkIndex);

      // Bonus chunks intentionally SPILL across canvas boundaries — no crit
      // benefit is wasted. onChunkComplete resets progress to 0 on canvas
      // completion, so the next iteration paints chunk 0 of the new canvas.
      let bonusLeft = critChunksPerCrit;
      while (bonusLeft > 0 && sales < MAX_SALES_PER_TICK) {
        const bonusIndex = Math.floor(progress);
        critChunks[bonusIndex] = true;
        progress = bonusIndex + 1;
        onChunkComplete(bonusIndex);
        bonusLeft -= 1;
      }

      const totalCritChunks = 1 + critChunksPerCrit;
      critChunksThisTick += totalCritChunks;
      localCritStreak += totalCritChunks;
      if (localCritStreak > localMaxCritStreak) localMaxCritStreak = localCritStreak;
    } else {
      onChunkComplete(completedChunkIndex);
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
