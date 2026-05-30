export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const CLUSTER_DEFAULT_SIZE = 600;
const GUTTER = 120;
const COLUMNS = 4;

function overlaps(a: Region, b: Region): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Pick a non-overlapping default region for a new cluster. Scans a coarse grid
 * (CLUSTER_DEFAULT_SIZE + GUTTER cells, COLUMNS wide, row by row) and returns the
 * first cell whose default-sized region clears every existing cluster region.
 * Deterministic.
 */
export function nextClusterRegion(
  existing: ReadonlyArray<{ region: Region }>,
): Region {
  const step = CLUSTER_DEFAULT_SIZE + GUTTER;
  for (let row = 0; row < 1000; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      const candidate: Region = {
        x: col * step,
        y: row * step,
        w: CLUSTER_DEFAULT_SIZE,
        h: CLUSTER_DEFAULT_SIZE,
      };
      if (existing.every((c) => !overlaps(candidate, c.region))) return candidate;
    }
  }
  // Fallback (unreachable in practice): stack below everything.
  const maxBottom = existing.reduce((m, c) => Math.max(m, c.region.y + c.region.h), 0);
  return { x: 0, y: maxBottom + GUTTER, w: CLUSTER_DEFAULT_SIZE, h: CLUSTER_DEFAULT_SIZE };
}
