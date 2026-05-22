import { big, type Big } from "@/core/bigNumber";
import {
  canvasGold, canvasTime,
  CRIT_SPEED_FACTOR, COMBO_DECAY_PER_LINK, comboBonusFactor, comboEffectiveChance,
} from "@/core/balance";
import {
  getCanvasGoldMultiplier, getCanvasSpeedMultiplier, getPmMultiplier,
  getCritChance, getComboBaseChance, getCanvasSize, getComboDecayReduction,
  getCritGoldBonus,
} from "@/core/multipliers";
import { rng } from "@/core/rng";
import {
  addCurrency, trackSaleGoldPure, awardOfficeXpPure,
  incrementStatPure, patchRunStatsPure, type DraftState,
} from "@/core/pureMutations";

const MAX_SALES_PER_TICK = 1000;

export function canvasTickPure(draft: DraftState, deltaSeconds: number): void {
  if (deltaSeconds <= 0) return;

  let progress = draft.canvasProgress;
  let critFlag = draft.isCritThisCanvas;
  let chain = draft.comboChain;
  let lastSaleId = draft.lastSale?.id ?? 0;
  let lastSaleAmount: Big | null = null;

  // Roll crit at the start of every new canvas (covers the very first tick).
  if (progress === 0) critFlag = rng() < getCritChance(draft);

  let timeBudget = deltaSeconds;
  let sales = 0;

  // Stat accumulators — committed after the loop to avoid per-sale work.
  let localCritStreak = draft.statsRun.currentCritStreak;
  let localMaxCritStreak = draft.statsRun.maxCritStreak;
  let localMaxCombo = draft.statsRun.maxComboChain;
  let critsThisTick = 0;
  let salesThisTick = 0;
  let tickGoldTotal = big(0);

  while (timeBudget > 0 && sales < MAX_SALES_PER_TICK) {
    const size = getCanvasSize(draft);
    const baseTime = canvasTime(size);
    const speedMult = getCanvasSpeedMultiplier(draft);
    const critFactor = critFlag ? CRIT_SPEED_FACTOR : 1;
    const effectiveTime = baseTime / (speedMult * critFactor);

    const remainingForThisCanvas = effectiveTime - progress;
    if (timeBudget < remainingForThisCanvas) {
      // Not enough time to finish this canvas — just advance progress.
      progress += timeBudget;
      timeBudget = 0;
      break;
    }

    // Finish this canvas — fire a sale.
    timeBudget -= remainingForThisCanvas;
    progress = 0;
    sales += 1;

    const critGoldMult = critFlag ? (1 + getCritGoldBonus(draft)) : 1;
    const goldMult = getCanvasGoldMultiplier(draft) * getPmMultiplier(draft) * critGoldMult;
    const baseGold = canvasGold(size, goldMult);
    // Apply combo bonus from PRIOR chain state — chain mutation happens AFTER pay-out.
    const gain = baseGold.mul(comboBonusFactor(chain));

    addCurrency(draft, "gold", gain);
    trackSaleGoldPure(draft, gain);
    awardOfficeXpPure(draft, gain);

    salesThisTick += 1;
    tickGoldTotal = tickGoldTotal.add(gain);
    if (critFlag) {
      critsThisTick += 1;
      localCritStreak += 1;
      if (localCritStreak > localMaxCritStreak) localMaxCritStreak = localCritStreak;
    } else {
      localCritStreak = 0;
    }
    if (chain > localMaxCombo) localMaxCombo = chain;

    // Roll combo for the chain decision (after sale paid out).
    const baseChance = getComboBaseChance(draft);
    const decay = Math.max(0, COMBO_DECAY_PER_LINK - getComboDecayReduction(draft));
    const effChance = comboEffectiveChance(baseChance, chain, decay);
    chain = (rng() < effChance) ? chain + 1 : 0;

    // Roll crit for the NEXT canvas.
    critFlag = rng() < getCritChance(draft);
    lastSaleId += 1;
    lastSaleAmount = gain;
  }

  if (salesThisTick > 0) {
    incrementStatPure(draft, "lifetime", "canvasesSold", salesThisTick);
    incrementStatPure(draft, "lifetime", "critsLanded", critsThisTick);
    if (localMaxCombo > draft.statsLifetime.maxComboChain) {
      incrementStatPure(draft, "lifetime", "maxComboChain", localMaxCombo - draft.statsLifetime.maxComboChain);
    }
    incrementStatPure(draft, "run", "canvasesSold", salesThisTick);
    incrementStatPure(draft, "run", "critsLanded", critsThisTick);
    patchRunStatsPure(draft, {
      currentCritStreak: localCritStreak,
      maxCritStreak: localMaxCritStreak,
      maxComboChain: localMaxCombo,
      goldEarned: draft.statsRun.goldEarned.add(tickGoldTotal),
    });
  }

  draft.canvasProgress = progress;
  draft.isCritThisCanvas = critFlag;
  draft.comboChain = chain;
  if (lastSaleAmount !== null) {
    draft.lastSale = { id: lastSaleId, amount: lastSaleAmount };
  }
}
