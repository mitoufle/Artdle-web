import { rng, rngInt } from "@/core/rng";
import {
  OFFICE_CLASSES,
  ALL_CLASS_IDS,
  GENERALIST_CLASS_WEIGHT,
  SPECIALIST_CLASS_WEIGHT,
} from "@/config/officeClasses";
import type { ClassId } from "@/config/officeClasses";
import { hasCapability, getCanvasTrackUnlocked } from "@/store/skillTreeSlice";
import type { CanvasTrackId } from "@/store/skillTreeSlice";
import type { GameStore } from "@/store";
import { AFFIX_KINDS, AFFIX_MAGNITUDE_RANGE } from "@/config/workshopAffixes";
import type { AffixKind } from "@/config/workshopAffixes";
import { OFFICE_TIER_AFFIX_COUNT } from "@/core/balance";
import type { WorkerTier } from "@/core/balance";
import type { Affix } from "@/core/workshopRoll";

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

const KIND_TO_TRACK: Record<AffixKind, CanvasTrackId> = {
  "+sell_price%": "sell_price",
  "+speed%": "speed",
  "+crit_chance%": "crit",
  "+combo_chance%": "combo",
  "+size%": "size",
};

function availableKinds(state: GameStore): ReadonlyArray<AffixKind> {
  return AFFIX_KINDS.filter((k) => getCanvasTrackUnlocked(state, KIND_TO_TRACK[k]));
}

function weightedPick(pool: ReadonlyArray<AffixKind>, weights: WeightTuple): AffixKind {
  let total = 0;
  for (const k of pool) total += weights[k];
  if (total <= 0) {
    return pool[Math.floor(rng() * pool.length)]!;
  }
  const r = rng() * total;
  let acc = 0;
  for (const k of pool) {
    acc += weights[k];
    if (r < acc) return k;
  }
  return pool[pool.length - 1]!;
}

export function rollWorkerAffixes(
  weights: WeightTuple,
  tier: WorkerTier,
  state: GameStore,
): ReadonlyArray<Affix> {
  const count = OFFICE_TIER_AFFIX_COUNT[tier];
  const pool = availableKinds(state);
  if (pool.length === 0) throw new Error("rollWorkerAffixes: empty affix pool");
  const out: Affix[] = [];
  for (let i = 0; i < count; i++) {
    const kind = weightedPick(pool, weights);
    const range = AFFIX_MAGNITUDE_RANGE[kind];
    const magnitude = rngInt(range.min, range.max);
    out.push({ kind, magnitude });
  }
  return out;
}
