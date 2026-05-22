/**
 * Format a number of seconds into a human-readable elapsed time string.
 * Used by catch-up UI components.
 *
 * Examples:
 *   45 → "45s"
 *   90 → "1 min"
 *   720 → "12 min"
 *   3661 → "1h 1min"
 *   90000 → "1d 1h"
 */
export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}min`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return `${d}d ${h}h`;
}
