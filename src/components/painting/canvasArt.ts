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
 * Returns the side length of the NxN chunk grid used to reveal the easel
 * sketch for a given canvas tier. T1 = 5 (25 chunks); each subsequent tier
 * approximately doubles the cell count while keeping a square grid:
 * round(5 * sqrt(2)^(tier-1)) -> 5, 7, 10, 14, 20, 28, 40, 57, 80, 113, 160.
 *
 * Square grids per tier mean the click-to-paint mechanic gets progressively
 * finer-grained at higher tiers.
 */
export function getSketchGridDim(tier: number): number {
  const clamped = Math.max(1, tier);
  return Math.round(5 * Math.SQRT2 ** (clamped - 1));
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
