/**
 * Round a single coordinate to the nearest multiple of `gridSize`. A non-positive
 * grid size disables snapping (returns the value untouched). Kept in its own module
 * so DesignerCanvas.tsx exports only its component and stays Fast-Refresh-friendly.
 */
export function snapToGrid(value: number, gridSize: number): number {
  if (gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}
