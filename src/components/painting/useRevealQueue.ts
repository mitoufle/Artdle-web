import { useEffect, useReducer, useRef } from "react";

const TICK_INTERVAL_MS = 50;
const ANIMATION_DURATION_MS = 220;
const CRIT_DURATION_MS = 600;

export interface InFlightCell {
  cellIndex: number;
  startedAt: number;
  isCrit: boolean;
}

/** Canvas identity — any value that changes when the rendered canvas changes.
 *  CanvasStage passes `${tier}-${canvasNumber}` so a tier-up resets too. */
type CanvasId = number | string;

interface QueueState {
  inFlight: InFlightCell[];
  settled: number[];
  lastTargetRevealed: number;
  canvasNumber: CanvasId;
}

type Action =
  | {
      type: "advance-target";
      targetRevealed: number;
      cellOrder: number[];
      canvasNumber: CanvasId;
      critCells: Record<number, true>;
      now: number;
    }
  | { type: "tick"; now: number }
  | { type: "reset"; canvasNumber: CanvasId };

const INITIAL: QueueState = {
  inFlight: [],
  settled: [],
  lastTargetRevealed: 0,
  canvasNumber: -1,
};

function reducer(state: QueueState, action: Action): QueueState {
  switch (action.type) {
    case "advance-target": {
      const isCanvasReset = action.canvasNumber !== state.canvasNumber;
      const fromIdx = isCanvasReset ? 0 : state.lastTargetRevealed;
      if (!isCanvasReset && action.targetRevealed <= state.lastTargetRevealed) {
        return state;
      }
      const newCellIndices = action.cellOrder.slice(fromIdx, action.targetRevealed);
      const newInFlight: InFlightCell[] = newCellIndices.map((cellIndex) => ({
        cellIndex,
        startedAt: action.now,
        isCrit: action.critCells[cellIndex] === true,
      }));
      return {
        inFlight: isCanvasReset ? newInFlight : [...state.inFlight, ...newInFlight],
        settled: isCanvasReset ? [] : state.settled,
        lastTargetRevealed: action.targetRevealed,
        canvasNumber: action.canvasNumber,
      };
    }
    case "tick": {
      const stillFlying: InFlightCell[] = [];
      const newlySettled: number[] = [];
      for (const cell of state.inFlight) {
        const duration = cell.isCrit ? CRIT_DURATION_MS : ANIMATION_DURATION_MS;
        if (action.now - cell.startedAt >= duration) {
          newlySettled.push(cell.cellIndex);
        } else {
          stillFlying.push(cell);
        }
      }
      if (newlySettled.length === 0) return state;
      return {
        ...state,
        inFlight: stillFlying,
        settled: [...state.settled, ...newlySettled],
      };
    }
    case "reset": {
      return {
        inFlight: [],
        settled: [],
        lastTargetRevealed: 0,
        canvasNumber: action.canvasNumber,
      };
    }
  }
}

interface UseRevealQueueArgs {
  /** Engine-reported reveal count (= `floor(progressPct * totalCells)`). */
  targetRevealed: number;
  /** Permutation of [0..totalCells) — the order cells should reveal in for this canvas. */
  cellOrder: number[];
  /** Canvas identity — changes on each canvas sale AND on tier-up; drives the
   *  per-canvas reset. CanvasStage passes `${tier}-${canvasNumber}`. */
  canvasNumber: CanvasId;
  /** Map of LAYOUT cellIndex -> true for cells whose pop-in should use the
   *  longer crit animation duration. CanvasStage builds this by translating
   *  engine chunk indices through cellOrder. */
  critCells: Record<number, true>;
}

interface UseRevealQueueResult {
  inFlight: InFlightCell[];
  settled: number[];
}

/**
 * Tracks the per-canvas reveal animation lifecycle.
 *
 * When `targetRevealed` advances, every newly-revealed cell is pushed to
 * `inFlight` IMMEDIATELY — no drip, no in-flight cap. A burst of crit chunks
 * therefore lights up all its cells in the same frame, matching the engine's
 * "trigger + N bonus" semantics. Cells graduate from `inFlight` to `settled`
 * once their per-cell duration elapses (220ms regular, 600ms crit). The
 * consumer (CanvasStage) commits settled cells into the long-lived <canvas>
 * via drawImage and then drops the in-flight DOM nodes.
 *
 * Why setInterval instead of requestAnimationFrame: tests need to drive the
 * timer deterministically via vi.useFakeTimers().
 */
export function useRevealQueue({
  targetRevealed,
  cellOrder,
  canvasNumber,
  critCells,
}: UseRevealQueueArgs): UseRevealQueueResult {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const cellOrderRef = useRef(cellOrder);
  cellOrderRef.current = cellOrder;
  const critCellsRef = useRef(critCells);
  critCellsRef.current = critCells;

  useEffect(() => {
    dispatch({
      type: "advance-target",
      targetRevealed,
      cellOrder: cellOrderRef.current,
      canvasNumber,
      critCells: critCellsRef.current,
      now: performance.now(),
    });
  }, [targetRevealed, canvasNumber]);

  useEffect(() => {
    const id = setInterval(() => {
      dispatch({ type: "tick", now: performance.now() });
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return {
    inFlight: state.inFlight,
    settled: state.settled,
  };
}
