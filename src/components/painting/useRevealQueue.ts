import { useEffect, useReducer, useRef } from "react";

const DRIP_INTERVAL_MS = 50;
const ANIMATION_DURATION_MS = 220;
const CRIT_DURATION_MS = 600;
const MAX_IN_FLIGHT = 8;

export interface InFlightCell {
  cellIndex: number;
  startedAt: number;
  isCrit: boolean;
}

interface QueueState {
  pending: number[]; // cellIndex FIFO
  inFlight: InFlightCell[]; // currently animating, max MAX_IN_FLIGHT
  settled: number[]; // cells whose animation finished (consumer commits them to canvas)
  lastTargetRevealed: number;
  canvasNumber: number;
}

type Action =
  | {
      type: "advance-target";
      targetRevealed: number;
      cellOrder: number[];
      canvasNumber: number;
    }
  | { type: "tick"; now: number; critCells: Record<number, true> }
  | { type: "reset"; canvasNumber: number };

const INITIAL: QueueState = {
  pending: [],
  inFlight: [],
  settled: [],
  lastTargetRevealed: 0,
  canvasNumber: -1,
};

function reducer(state: QueueState, action: Action): QueueState {
  switch (action.type) {
    case "advance-target": {
      if (action.canvasNumber !== state.canvasNumber) {
        // Canvas changed — wipe state, then enqueue any cells the engine already considers revealed.
        return {
          pending: action.cellOrder.slice(0, action.targetRevealed),
          inFlight: [],
          settled: [],
          lastTargetRevealed: action.targetRevealed,
          canvasNumber: action.canvasNumber,
        };
      }
      if (action.targetRevealed <= state.lastTargetRevealed) return state;
      const newCells = action.cellOrder.slice(
        state.lastTargetRevealed,
        action.targetRevealed,
      );
      return {
        ...state,
        pending: [...state.pending, ...newCells],
        lastTargetRevealed: action.targetRevealed,
      };
    }
    case "tick": {
      // 1. Graduate any in-flight cells whose duration is up.
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
      // 2. Promote pending cells into in-flight while there's room.
      // The tick is a poll, not the event source: a cell promoted on this
      // tick has effectively been animating since the start of the bucket
      // (one DRIP_INTERVAL_MS ago). Recording `startedAt = now - DRIP_INTERVAL_MS`
      // means graduation lines up with multiples of the bucket boundary —
      // e.g. with duration=220ms a cell promoted at t=50 graduates at t=250
      // (age = 200 + 50 bucket-credit = 250 >= 220), not t=300.
      const nextPending = [...state.pending];
      const nextInFlight = [...stillFlying];
      while (nextInFlight.length < MAX_IN_FLIGHT && nextPending.length > 0) {
        const cellIndex = nextPending.shift()!;
        nextInFlight.push({
          cellIndex,
          startedAt: action.now - DRIP_INTERVAL_MS,
          isCrit: action.critCells[cellIndex] === true,
        });
      }
      if (
        nextPending.length === state.pending.length &&
        nextInFlight.length === state.inFlight.length &&
        newlySettled.length === 0
      ) {
        // Nothing changed — return the same state to avoid re-renders.
        return state;
      }
      return {
        ...state,
        pending: nextPending,
        inFlight: nextInFlight,
        settled:
          newlySettled.length > 0
            ? [...state.settled, ...newlySettled]
            : state.settled,
      };
    }
    case "reset": {
      return {
        pending: [],
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
  /** Increments on each canvas sale — drives the per-canvas reset. */
  canvasNumber: number;
  /** Map of cellIndex -> true for cells whose pop-in should use the longer crit animation duration. */
  critCells: Record<number, true>;
}

interface UseRevealQueueResult {
  inFlight: InFlightCell[];
  settled: number[];
  pending: number[];
}

/**
 * Buffers engine reveal events so that no matter how big a single tick's
 * reveal burst (e.g. a crit paints 50 chunks at once), the UI never has more
 * than MAX_IN_FLIGHT cells animating simultaneously. Excess cells drip-feed
 * into the in-flight pool one per `DRIP_INTERVAL_MS`. Each in-flight cell
 * graduates to `settled` after its animation duration — the consumer commits
 * settled cells to the long-lived canvas at that point.
 *
 * Why setInterval instead of requestAnimationFrame: tests need to drive the
 * timer deterministically via vi.useFakeTimers(). Real-time smoothness is
 * fine at 50ms — that's well below the 220ms animation duration.
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
    });
  }, [targetRevealed, canvasNumber]);

  useEffect(() => {
    const id = setInterval(() => {
      dispatch({
        type: "tick",
        now: performance.now(),
        critCells: critCellsRef.current,
      });
    }, DRIP_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return {
    inFlight: state.inFlight,
    settled: state.settled,
    pending: state.pending,
  };
}
