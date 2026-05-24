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
 * Canvas-paint tick. Steps per PAID chunk: each iteration crosses one chunk
 * boundary that consumed chunkTime from timeBudget, and rolls crit once.
 * A successful roll adds `getCritChunks(draft)` BONUS chunks of progress
 * instantly (no timeBudget cost). Bonus chunks themselves don't re-roll.
 */
export function canvasTickPure(draft: DraftState, deltaSeconds: number): void {
  if (deltaSeconds <= 0) return;

  let progress = draft.canvasProgress;
  let chain = draft.comboChain;
  let critChunks: Record<number, true> = { ...draft.critChunks };
  let lastSaleId = draft.lastSale?.id ?? 0;
  let lastSaleAmount: Big | null = null;

  let timeBudget = deltaSeconds;
  let sales = 0;

  // Stat accumulators — committed after the loop.
  let localCritStreak = draft.statsRun.currentCritStreak;
  let localMaxCritStreak = draft.statsRun.maxCritStreak;
  let localMaxCombo = draft.statsRun.maxComboChain;
  let critChunksThisTick = 0;
  let salesThisTick = 0;
  let tickGoldTotal = big(0);

  while (timeBudget > 0 && sales < MAX_SALES_PER_TICK) {
    const size = getCanvasSize(draft);
    const baseTime = canvasTime(size, draft.canvasTier);
    const speedMult = getCanvasSpeedMultiplier(draft);
    const effectiveTime = baseTime / speedMult;

    const chunkCount = getSketchGridDim(draft.canvasTier) ** 2;
    const chunkTime = effectiveTime / chunkCount;

    const currentChunkIndex = Math.floor(progress / chunkTime);
    const nextChunkBoundary = (currentChunkIndex + 1) * chunkTime;
    const timeToNextChunk = nextChunkBoundary - progress;

    if (timeBudget < timeToNextChunk) {
      // Not enough time to finish this chunk; just advance progress.
      progress += timeBudget;
      timeBudget = 0;
      break;
    }

    // Cross a PAID chunk boundary.
    progress = nextChunkBoundary;
    timeBudget -= timeToNextChunk;

    // Roll crit on this paid chunk.
    if (rng() < getCritChance(draft)) {
      const bonus = getCritChunks(draft);
      // Cap bonus so it doesn't overshoot this canvas.
      const remainingChunks = chunkCount - (currentChunkIndex + 1);
      const appliedBonus = Math.min(bonus, remainingChunks);

      // Mark trigger + bonus chunks as crit-painted (for gold flash).
      critChunks[currentChunkIndex] = true;
      for (let i = 1; i <= appliedBonus; i++) {
        critChunks[currentChunkIndex + i] = true;
      }
      progress += appliedBonus * chunkTime;

      const totalCritChunks = 1 + appliedBonus;
      critChunksThisTick += totalCritChunks;
      localCritStreak += totalCritChunks;
      if (localCritStreak > localMaxCritStreak) localMaxCritStreak = localCritStreak;
    } else {
      localCritStreak = 0;
    }

    if (progress >= effectiveTime) {
      // Sale.
      progress = 0;
      sales += 1;
      salesThisTick += 1;

      const goldMult = getCanvasGoldMultiplier(draft);
      const baseGold = canvasGold(size, goldMult, draft.canvasTier);
      const gain = baseGold.mul(comboBonusFactor(chain));

      addCurrency(draft, "gold", gain);
      trackSaleGoldPure(draft, gain);
      awardOfficeXpPure(draft, gain);

      tickGoldTotal = tickGoldTotal.add(gain);
      if (chain > localMaxCombo) localMaxCombo = chain;

      // Roll combo for the chain decision (after pay-out).
      const baseChance = getComboBaseChance(draft);
      const decay = Math.max(0, COMBO_DECAY_PER_LINK - getComboDecayReduction(draft));
      const effChance = comboEffectiveChance(baseChance, chain, decay);
      chain = (rng() < effChance) ? chain + 1 : 0;

      lastSaleId += 1;
      lastSaleAmount = gain;

      // Reset per-canvas crit-paint set.
      critChunks = {};
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
