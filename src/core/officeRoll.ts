import { rng, rngInt } from "@/core/rng";
import {
  OFFICE_CLASSES,
  ALL_CLASS_IDS,
  GENERALIST_CLASS_WEIGHT,
  SPECIALIST_CLASS_WEIGHT,
} from "@/config/officeClasses";
import type { ClassId } from "@/config/officeClasses";
import { hasCapability } from "@/store/skillTreeSlice";
import type { GameStore } from "@/store";
import type { AffixKind } from "@/config/workshopAffixes";

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

const MAX_REROLL_ATTEMPTS = 100;

export type WeightTuple = Record<AffixKind, number>;

/**
 * Roll per-kind sampling weights for a new worker of the given class.
 * For Generalist (range [0, 4] per kind), an all-zero roll is rerolled.
 * For specialists, off-spec ranges have positive minima (e.g., Goldsmith
 * +sell [3,7]) so all-zero is structurally impossible.
 */
export function rollWorkerWeights(classId: ClassId): WeightTuple {
  const ranges = OFFICE_CLASSES[classId].weightRanges;
  for (let attempt = 0; attempt < MAX_REROLL_ATTEMPTS; attempt++) {
    const out: Record<string, number> = {};
    let sum = 0;
    for (const kind of Object.keys(ranges) as ReadonlyArray<AffixKind>) {
      const r = ranges[kind];
      const w = rngInt(r.min, r.max);
      out[kind] = w;
      sum += w;
    }
    if (sum > 0) return out as WeightTuple;
  }
  throw new Error(`rollWorkerWeights: ${MAX_REROLL_ATTEMPTS} consecutive all-zero rolls — class ${classId} ranges may be misconfigured`);
}
