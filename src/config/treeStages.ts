export interface TreePartConfig {
  /** Stable identifier; used as a key in the slice's `partLevels` record. */
  readonly id: string;
  /** Display name (Phase 4 UI). */
  readonly name: string;
  /** Gold cost at level 0 → 1. Subsequent levels scale by `treePartCost(level, baseCost)`. */
  readonly baseCost: number;
  /** Inspi/sec contribution per level (final = level * rate * multiplier). */
  readonly rate: number;
}

export interface TreeStageConfig {
  readonly id: string;
  readonly name: string;
  /**
   * Total levels required in the PRIOR stage's parts to grow into this stage.
   * Stage 0 has unlockThreshold 0 (always available).
   */
  readonly unlockThreshold: number;
  readonly parts: ReadonlyArray<TreePartConfig>;
}

/**
 * Phase 2 tree config: 3 stages × 2 parts. Numbers are placeholder
 * Phase-6-tunable defaults; the curve (×10 between stages) matches
 * the locked unlockThreshold progression.
 */
export const TREE_STAGES: ReadonlyArray<TreeStageConfig> = [
  {
    id: "seed",
    name: "Seed",
    unlockThreshold: 0,
    parts: [
      { id: "spark", name: "Spark", baseCost: 10, rate: 0.1 },
      { id: "bud", name: "Bud", baseCost: 50, rate: 0.5 },
    ],
  },
  {
    id: "sapling",
    name: "Sapling",
    unlockThreshold: 10,
    parts: [
      { id: "leaf", name: "Leaf", baseCost: 100, rate: 5 },
      { id: "branch", name: "Branch", baseCost: 500, rate: 25 },
    ],
  },
  {
    id: "tree",
    name: "Tree",
    unlockThreshold: 100,
    parts: [
      { id: "bough", name: "Bough", baseCost: 1000, rate: 100 },
      { id: "crown", name: "Crown", baseCost: 5000, rate: 500 },
    ],
  },
] as const;
