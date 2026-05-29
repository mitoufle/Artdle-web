/** The five worker stats, in the order they should display everywhere. */
export const WORKER_STAT_KEYS = ["goldPct", "speed", "critChance", "strokesPerCrit", "comboChance"] as const;
export type WorkerStatKey = (typeof WORKER_STAT_KEYS)[number];

/** Short human label per stat (used by the office card rows). */
export const WORKER_STAT_LABELS: Record<WorkerStatKey, string> = {
  goldPct: "Gold",
  speed: "Speed",
  critChance: "Crit",
  strokesPerCrit: "Strokes/crit",
  comboChance: "Combo",
};

const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;

/** Absolute display of a stat value (office stat sheet). */
export function formatWorkerStatAbsolute(key: WorkerStatKey, value: number): string {
  switch (key) {
    case "goldPct":
      return `+${Math.round(value * 100)}%`;       // additive gold bonus
    case "speed":
      return `×${value.toFixed(2)}`;                 // stroke-rate multiplier
    case "critChance":
    case "comboChance":
      return pct(value);                            // probabilities, 1 decimal
    case "strokesPerCrit":
      return `${value}`;                            // integer
  }
}

/** A level-up increment for one stat: e.g. "+3% gold", "+1 stroke/crit".
 *  Returns null when the stat did not change. */
export function formatWorkerStatDelta(key: WorkerStatKey, before: number, after: number): string | null {
  if (after === before) return null;
  if (key === "strokesPerCrit") {
    return `+${after - before} stroke/crit`;
  }
  // The four fractional stats roll in whole percentage points (WORKER_PCT_INCREMENTS).
  const pp = Math.round((after - before) * 100);
  const noun: Record<Exclude<WorkerStatKey, "strokesPerCrit">, string> = {
    goldPct: "gold", speed: "speed", critChance: "crit", comboChance: "combo",
  };
  return `+${pp}% ${noun[key as Exclude<WorkerStatKey, "strokesPerCrit">]}`;
}
