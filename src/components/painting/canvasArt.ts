/**
 * Canvas art assets per tier, eagerly bundled at build time.
 *
 * Each tier folder (`src/assets/canvas/T{N}`) ships an arbitrary number of
 * sketch / pixel-art PNGs. `getSketchUrl(tier, canvasNumber)` picks one
 * deterministically per canvas — so the same canvas number always shows the
 * same sketch (catch-up sim, achievement re-renders, etc. stay stable).
 *
 * Tier fallback: at tiers past the highest authored folder, we reuse the
 * highest tier's art. Today that's T4 (full-color pixel art) for T5+.
 */

import { chunksPerCanvas, CELL_RENDER_CAP } from "@/core/balance";

const t1Modules = import.meta.glob("@/assets/canvas/T1/*.png", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const t2Modules = import.meta.glob("@/assets/canvas/T2/*.png", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const t3Modules = import.meta.glob("@/assets/canvas/T3/*.png", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const t4Modules = import.meta.glob("@/assets/canvas/T4/*.png", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

const SKETCHES_BY_TIER: Record<number, ReadonlyArray<string>> = {
  1: Object.values(t1Modules),
  2: Object.values(t2Modules),
  3: Object.values(t3Modules),
  4: Object.values(t4Modules),
};

const HIGHEST_AUTHORED_TIER = 4;

/**
 * Deterministic non-linear hash. Used to pick a sketch index and to shuffle
 * the cell-reveal order without consuming the global rng seed.
 */
function hash(a: number, b: number): number {
  let x = (Math.imul(a, 73856093) ^ Math.imul(b, 19349663)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

/**
 * Returns every sketch URL in the given tier's pool. Used by the boot
 * preloader to warm the browser cache so the first canvas paint at that tier
 * doesn't show a flash-of-unstyled cells. Tier > HIGHEST_AUTHORED_TIER falls
 * back to the highest authored tier (matching `getSketchUrl`'s fallback).
 */
export function getTierSketchPool(tier: number): ReadonlyArray<string> {
  const resolvedTier = Math.min(Math.max(1, tier), HIGHEST_AUTHORED_TIER);
  return SKETCHES_BY_TIER[resolvedTier] ?? [];
}

/**
 * Returns the sketch URL for the given canvas. Picks deterministically from
 * the tier's sketch pool using `canvasNumber` as the seed. Falls back to the
 * highest authored tier (T4 today) for tiers > HIGHEST_AUTHORED_TIER.
 *
 * Returns `null` if no sketches are available for the resolved tier (would
 * only happen if a tier folder is empty at build time).
 */
export function getSketchUrl(tier: number, canvasNumber: number): string | null {
  const resolvedTier = Math.min(Math.max(1, tier), HIGHEST_AUTHORED_TIER);
  const pool = SKETCHES_BY_TIER[resolvedTier] ?? [];
  if (pool.length === 0) return null;
  const idx = hash(canvasNumber, 0xa11a17) % pool.length;
  return pool[idx]!;
}

/**
 * Cell layout for the canvas grid at a given tier.
 *
 *  - `cellsRendered = min(chunksPerCanvas(T), CELL_RENDER_CAP)` — visual cap.
 *  - `chunksPerCell = ceil(chunksPerCanvas(T) / cellsRendered)` — at high
 *     tiers one cell-reveal corresponds to multiple engine chunks.
 *  - `(rows, cols)` factor `cellsRendered` into a roughly-landscape grid.
 *
 * Lookup table for cell layouts up to T7 (where the cap is reached):
 *   T1 = 10  → 2×5
 *   T2 = 20  → 4×5
 *   T3 = 40  → 5×8
 *   T4 = 80  → 8×10
 *   T5 = 160 → 10×16
 *   T6 = 320 → 16×20
 *   T7 = 640 → 20×32
 *   T8+ = 640 cells (same 20×32 grid), with chunksPerCell > 1.
 */
export interface CanvasCellLayout {
  readonly rows: number;
  readonly cols: number;
  readonly cellsRendered: number;
  readonly chunksPerCell: number;
}

const CELL_LAYOUT_BY_CELLS: Record<number, { rows: number; cols: number }> = {
  10:  { rows: 2,  cols: 5  },
  20:  { rows: 4,  cols: 5  },
  40:  { rows: 5,  cols: 8  },
  80:  { rows: 8,  cols: 10 },
  160: { rows: 10, cols: 16 },
  320: { rows: 16, cols: 20 },
  640: { rows: 20, cols: 32 },
};

export function getCanvasCellLayout(tier: number): CanvasCellLayout {
  const chunks = chunksPerCanvas(tier);
  const cellsRendered = Math.min(chunks, CELL_RENDER_CAP);
  const chunksPerCell = Math.ceil(chunks / cellsRendered);
  const dims = CELL_LAYOUT_BY_CELLS[cellsRendered];
  if (!dims) {
    // Defensive fallback (should never hit — every value of chunksPerCanvas
    // ≤ CELL_RENDER_CAP comes from the 10*2^(T-1) progression and is in the
    // table above).
    return { rows: 1, cols: cellsRendered, cellsRendered, chunksPerCell };
  }
  return { rows: dims.rows, cols: dims.cols, cellsRendered, chunksPerCell };
}

/**
 * Returns a deterministic permutation of `[0, totalCells)` based on canvasNumber.
 * Each canvas reveals its chunks in a different shuffled order, but the
 * order is stable for that canvas across re-renders / catch-up runs.
 */
export function getCellRevealOrder(canvasNumber: number, totalCells: number): number[] {
  const indices = Array.from({ length: totalCells }, (_, i) => i);
  return indices
    .map((i) => ({ i, h: hash(canvasNumber, i) }))
    .sort((a, b) => a.h - b.h)
    .map(({ i }) => i);
}
