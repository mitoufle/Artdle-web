import { rng } from "@/core/rng";
import {
  OFFICE_CLASSES,
  ALL_CLASS_IDS,
  GENERALIST_CLASS_WEIGHT,
  SPECIALIST_CLASS_WEIGHT,
} from "@/config/officeClasses";
import type { ClassId } from "@/config/officeClasses";
import { hasCapability } from "@/store/skillTreeSlice";
import type { GameStore } from "@/store";

/**
 * Roll the class for a new candidate worker.
 * Generalist is always in the pool (weight 3). Each specialist class is
 * added at weight 1 when its capability gate is satisfied.
 */
export function rollWorkerClass(state: GameStore): ClassId {
  const pool: Array<{ id: ClassId; weight: number }> = [];

  for (const id of ALL_CLASS_IDS) {
    const config = OFFICE_CLASSES[id];
    if (config.capability !== null && !hasCapability(state, config.capability)) continue;
    const weight = id === "generalist" ? GENERALIST_CLASS_WEIGHT : SPECIALIST_CLASS_WEIGHT;
    pool.push({ id, weight });
  }

  const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
  const r = rng() * totalWeight;
  let acc = 0;
  for (const entry of pool) {
    acc += entry.weight;
    if (r < acc) return entry.id;
  }
  return pool[pool.length - 1]!.id;
}
