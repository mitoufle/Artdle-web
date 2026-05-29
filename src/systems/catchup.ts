import { ZERO, type Big } from "@/core/bigNumber";
import { useGameStore } from "@/store";
import { cloneGameState } from "@/systems/catchupClone";
import { treeTickPure } from "@/core/treeTickPure";
import { canvasTickPure } from "@/core/canvasTickPure";
import { skillTreeTickPure } from "@/core/skillTreeTickPure";
import { workshopTickPure } from "@/core/workshopTickPure";
import { schoolTickPure } from "@/core/schoolTickPure";

/**
 * Aggregate result of a catch-up simulation. Bigs are deltas
 * (after - baseline); stat counters are integer subtractions.
 */
export interface CatchupResult {
  elapsedSeconds: number;
  goldGained: Big;
  inspiGained: Big;
  canvasesSold: number;
  itemsCrafted: number;
  achievementsUnlocked: string[];
}

/** Tick batch size between cooperative yields to the browser event loop. */
const BATCH_SIZE = 200;

/**
 * Adaptive simulation step (in seconds of simulated game time) chosen
 * from the total elapsed window. Smaller steps are more accurate but
 * slower; larger steps make multi-day catch-ups tractable.
 */
export function chooseDelta(elapsedSeconds: number): number {
  if (elapsedSeconds < 30 * 60) return 0.1;
  if (elapsedSeconds < 60 * 60) return 1;
  if (elapsedSeconds < 24 * 60 * 60) return 10;
  return 60;
}

/** Yield to the browser between batches so the progress UI can repaint. */
function yieldToBrowser(): Promise<void> {
  return new Promise((res) => setTimeout(res, 0));
}

/**
 * Replay `elapsedSeconds` of game time against a draft cloned from the
 * current store, then commit the draft in a single `setState` and run
 * achievements once. `onProgress` is invoked once per BATCH_SIZE-step
 * batch with a monotonically increasing fraction in [0, 1].
 */
export async function runCatchupSimulation(
  elapsedSeconds: number,
  onProgress: (pct: number) => void,
): Promise<CatchupResult> {
  const clampedElapsed = Math.max(0, elapsedSeconds);
  const baseline = useGameStore.getState();

  if (clampedElapsed === 0) {
    return emptyResult(0);
  }

  const draft = cloneGameState(baseline);
  const delta = chooseDelta(clampedElapsed);
  let simulated = 0;

  while (simulated < clampedElapsed) {
    for (let i = 0; i < BATCH_SIZE && simulated < clampedElapsed; i++) {
      const step = Math.min(delta, clampedElapsed - simulated);
      treeTickPure(draft, step);
      canvasTickPure(draft, step);
      skillTreeTickPure(draft, step);
      workshopTickPure(draft, step);
      schoolTickPure(draft, step);
      simulated += step;
    }
    onProgress(simulated / clampedElapsed);
    await yieldToBrowser();
  }

  // Commit the draft, then evaluate achievements once. `evaluateAchievements`
  // reads from the live store and pushes notifications via the live engine,
  // so the draft must be applied before the call.
  useGameStore.setState(draft);
  useGameStore.getState().evaluateAchievements();

  const after = useGameStore.getState();
  const newlyUnlocked = Object.keys(after.completedAchievements).filter(
    (id) => !(id in baseline.completedAchievements),
  );

  return {
    elapsedSeconds: clampedElapsed,
    goldGained: after.gold.sub(baseline.gold),
    inspiGained: after.inspiration.sub(baseline.inspiration),
    canvasesSold: after.statsRun.canvasesSold - baseline.statsRun.canvasesSold,
    itemsCrafted:
      after.statsRun.workshopItemsCrafted - baseline.statsRun.workshopItemsCrafted,
    achievementsUnlocked: newlyUnlocked,
  };
}

function emptyResult(elapsed: number): CatchupResult {
  return {
    elapsedSeconds: elapsed,
    goldGained: ZERO,
    inspiGained: ZERO,
    canvasesSold: 0,
    itemsCrafted: 0,
    achievementsUnlocked: [],
  };
}
