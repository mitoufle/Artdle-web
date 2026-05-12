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
 * v1.x tree config: 6 stages with variable parts per stage (1/2/2/3/3/4).
 * Ratios match the v1.0 curve (×10 cost+rate between stages, ×5 within stage).
 * Names lock the first six entries of the long-term 25-stage roadmap; see
 * docs/superpowers/specs/2026-05-12-inspiration-tree-expansion-design.md.
 */
export const TREE_STAGES: ReadonlyArray<TreeStageConfig> = [
  {
    id: "tiny-sprout",
    name: "Tiny Sprout",
    unlockThreshold: 0,
    parts: [
      { id: "cotyledon", name: "Cotyledon", baseCost: 10, rate: 0.1 },
    ],
  },
  {
    id: "bud",
    name: "Bud",
    unlockThreshold: 5,
    parts: [
      { id: "tendril", name: "Tendril", baseCost: 100, rate: 1 },
      { id: "budtip", name: "Bud Tip", baseCost: 500, rate: 5 },
    ],
  },
  {
    id: "leaflet",
    name: "Leaflet",
    unlockThreshold: 12,
    parts: [
      { id: "vein", name: "Vein", baseCost: 1_000, rate: 10 },
      { id: "leaflet", name: "Leaflet", baseCost: 5_000, rate: 50 },
    ],
  },
  {
    id: "sapling",
    name: "Sapling",
    unlockThreshold: 25,
    parts: [
      { id: "twig", name: "Twig", baseCost: 10_000, rate: 100 },
      { id: "branch", name: "Branch", baseCost: 50_000, rate: 500 },
      { id: "leaf", name: "Leaf", baseCost: 250_000, rate: 2_500 },
    ],
  },
  {
    id: "whisperleaf",
    name: "Whisperleaf",
    unlockThreshold: 50,
    parts: [
      { id: "softbough", name: "Soft Bough", baseCost: 100_000, rate: 5_000 },
      { id: "quietleaf", name: "Quiet Leaf", baseCost: 500_000, rate: 25_000 },
      { id: "faintvein", name: "Faint Vein", baseCost: 2_500_000, rate: 125_000 },
    ],
  },
  {
    id: "verdant-shoot",
    name: "Verdant Shoot",
    unlockThreshold: 100,
    parts: [
      { id: "greenshoot", name: "Greenshoot", baseCost: 1_000_000, rate: 250_000 },
      { id: "lushbough",  name: "Lush Bough",  baseCost: 5_000_000, rate: 1_250_000 },
      { id: "vividleaf",  name: "Vivid Leaf",  baseCost: 25_000_000, rate: 6_250_000 },
      { id: "stalk",      name: "Stalk",       baseCost: 125_000_000, rate: 31_250_000 },
    ],
  },
];
