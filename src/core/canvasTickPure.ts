import { big, type Big } from "@/core/bigNumber";
import {
  canvasGold, chunksPerCanvas, chunkInterval,
  COMBO_DECAY_PER_LINK, comboBonusFactor, comboEffectiveChance,
} from "@/core/balance";
import {
  getCanvasGoldMultiplier, getCanvasSpeedMultiplier,
  getCritChance, getCritChunks, getComboBaseChance, getComboDecayReduction,
  getWorkerGoldFactor,
} from "@/core/multipliers";
import { rng } from "@/core/rng";
import {
  addCurrency, trackSaleGoldPure,
  incrementStatPure, patchRunStatsPure, type DraftState,
} from "@/core/pureMutations";

/** Cap on canvas-sales resolved in a single tick (catch-up clips at this). */
const MAX_SALES_PER_TICK = 1000;
/** Defensive cap on total strokes per tick (guards a degenerate interval→0). */
const MAX_STROKES_PER_TICK = 1_000_000;

const PLAYER_ID = "player";

/** A painter participating in the shared-canvas tick (player or a worker). */
interface Painter {
  id: string;
  isPlayer: boolean;
  /** Seconds per stroke = chunkInterval(speed). */
  interval: number;
  /** Per-stroke crit probability. */
  critChance: number;
  /** Bonus chunks filled on a crit (integer). */
  critChunks: number;
  /** Combo base chance used when THIS painter completes a sale. */
  comboBase: number;
}

/**
 * Discrete-event multi-painter canvas tick. The player and every worker paint
 * the SHARED canvas, each at its own `interval`. Within `deltaSeconds` we
 * repeatedly advance time to the soonest-stroking painter and apply its stroke.
 *
 * Gold is paid as a single lump on canvas completion (unchanged). Crit bonus
 * chunks spill across canvas boundaries (unchanged). `canvasProgress` is the
 * shared COUNT of completed chunks in the current canvas (integer-valued);
 * each painter's sub-stroke timing lives in `draft.painterClocks`.
 *
 * Phase-B stat rule (LOCKED): crit/combo STREAK stats (currentCritStreak,
 * maxCritStreak, critsLanded, maxComboChain) track the PLAYER only — worker
 * strokes never perturb them. canvasesSold/goldEarned are canvas-level (counted
 * regardless of which painter lands the final chunk).
 */
export function canvasTickPure(draft: DraftState, deltaSeconds: number): void {
  if (deltaSeconds <= 0) return;

  const chunkCount = chunksPerCanvas(draft.canvasTier);

  // --- Build the painter list (multipliers are invariant across the tick) ---
  const playerInterval = chunkInterval(getCanvasSpeedMultiplier(draft));
  if (playerInterval <= 0) return;
  const painters: Painter[] = [{
    id: PLAYER_ID, isPlayer: true, interval: playerInterval,
    critChance: getCritChance(draft),
    critChunks: getCritChunks(draft),
    comboBase: getComboBaseChance(draft),
  }];
  for (const w of draft.roster) {
    const interval = chunkInterval(w.stats.speed);
    if (interval <= 0) continue;
    painters.push({
      id: w.id, isPlayer: false, interval,
      critChance: w.stats.critChance,
      critChunks: w.stats.strokesPerCrit,
      comboBase: w.stats.comboChance,
    });
  }

  const goldMult = getCanvasGoldMultiplier(draft);
  const workerGoldFactor = getWorkerGoldFactor(draft);
  const baseSaleGold = canvasGold(goldMult, draft.canvasTier).mul(workerGoldFactor);
  const decay = Math.max(0, COMBO_DECAY_PER_LINK - getComboDecayReduction(draft));

  // --- Local mutable run state ---
  let progress = Math.floor(draft.canvasProgress); // sanitize any legacy fraction
  let chain = draft.comboChain;
  let critChunks: Record<number, true> = { ...draft.critChunks };
  let lastSaleId = draft.lastSale?.id ?? 0;
  let lastSaleAmount: Big | null = null;

  const prevClocks = draft.painterClocks ?? {};
  const clocks: Record<string, number> = {};
  for (const p of painters) clocks[p.id] = prevClocks[p.id] ?? 0;
  const workerStrokes: Record<string, number> = {};

  let budget = deltaSeconds;
  let sales = 0;
  let strokes = 0;
  let salesThisTick = 0;
  let critChunksThisTick = 0;       // PLAYER crit chunks only
  let tickGoldTotal = big(0);
  let localCritStreak = draft.statsRun.currentCritStreak;
  let localMaxCritStreak = draft.statsRun.maxCritStreak;
  let localMaxCombo = draft.statsRun.maxComboChain;

  // Fires the canvas-sale when a chunk fills the canvas. `comboBase`/`byPlayer`
  // belong to the painter that completed the chunk.
  const onChunkComplete = (chunkIndex: number, comboBase: number, byPlayer: boolean): void => {
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
    if (byPlayer && chain > localMaxCombo) localMaxCombo = chain;
    const effChance = comboEffectiveChance(comboBase, chain, decay);
    chain = rng() < effChance ? chain + 1 : 0;
  };

  // Terminate on the EVENT, not on `budget > 0`: a painter whose stroke falls at
  // the exact end of the budget (chosenWait == budget — including the
  // click-to-paint boundary `canvasTick(playerInterval)`) must still fire, and
  // simultaneous painters (zero-wait after time advances) must all resolve before
  // we stop. TIME_EPSILON absorbs float fuzz so `4.999… vs 5` can't mis-order.
  const TIME_EPSILON = 1e-9;
  while (sales < MAX_SALES_PER_TICK && strokes < MAX_STROKES_PER_TICK) {
    // Pick the painter whose next stroke comes soonest. Tie-break: player
    // first, then roster order — deterministic for catch-up reproducibility.
    let chosen = painters[0]!;
    let chosenWait = chosen.interval - clocks[chosen.id]!;
    for (let i = 1; i < painters.length; i++) {
      const p = painters[i]!;
      const wait = p.interval - clocks[p.id]!;
      if (wait < chosenWait) { chosen = p; chosenWait = wait; }
    }

    // Next stroke is beyond the remaining budget → advance all clocks and stop.
    if (chosenWait > budget + TIME_EPSILON) {
      for (const p of painters) clocks[p.id]! += budget;
      break;
    }

    // Advance time to the chosen painter's stroke. Resolves zero-wait
    // simultaneity too (chosenWait == 0 leaves budget unchanged; each painter
    // can be zero-wait at most once per instant since it resets to interval).
    for (const p of painters) clocks[p.id]! += chosenWait;
    budget -= chosenWait;
    clocks[chosen.id] = 0;
    strokes += 1;

    const completedChunkIndex = progress;
    progress += 1;
    const isLastChunkOfCanvas = completedChunkIndex + 1 >= chunkCount;

    // Crit is NOT rolled on the canvas's last chunk (so trigger + first bonus
    // stay together — matches the original single-painter behavior).
    if (!isLastChunkOfCanvas && rng() < chosen.critChance) {
      critChunks[completedChunkIndex] = true;
      onChunkComplete(completedChunkIndex, chosen.comboBase, chosen.isPlayer);
      let bonusLeft = chosen.critChunks;
      let filled = 1;
      while (bonusLeft > 0 && sales < MAX_SALES_PER_TICK) {
        const bonusIndex = progress;
        critChunks[bonusIndex] = true;
        progress += 1;
        onChunkComplete(bonusIndex, chosen.comboBase, chosen.isPlayer);
        bonusLeft -= 1;
        filled += 1;
      }
      if (!chosen.isPlayer) {
        workerStrokes[chosen.id] = (workerStrokes[chosen.id] ?? 0) + filled;
      } else {
        const totalCritChunks = 1 + chosen.critChunks;
        critChunksThisTick += totalCritChunks;
        localCritStreak += totalCritChunks;
        if (localCritStreak > localMaxCritStreak) localMaxCritStreak = localCritStreak;
      }
    } else {
      onChunkComplete(completedChunkIndex, chosen.comboBase, chosen.isPlayer);
      if (!chosen.isPlayer) {
        workerStrokes[chosen.id] = (workerStrokes[chosen.id] ?? 0) + 1;
      } else if (!isLastChunkOfCanvas) {
        localCritStreak = 0;
      }
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
  draft.painterClocks = clocks;
  if (Object.keys(workerStrokes).length > 0) {
    draft.roster = draft.roster.map((w) =>
      workerStrokes[w.id]
        ? { ...w, strokesThisRun: w.strokesThisRun + workerStrokes[w.id]! }
        : w,
    );
  }
  if (lastSaleAmount !== null) {
    draft.lastSale = { id: lastSaleId, amount: lastSaleAmount };
  }
}
