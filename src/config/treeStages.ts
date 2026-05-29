export interface TreePartConfig {
  readonly id: string;
  readonly name: string;
  /** Gold cost at level 0 → 1. Subsequent levels scale by `treePartCost(level, baseCost)`. */
  readonly baseCost: number;
  /** Inspi/sec contribution per level (final = level × rate × milestoneMult(level) × global mult). */
  readonly rate: number;
}

export interface TreeStageConfig {
  readonly id: string;
  readonly name: string;
  /** Total tree inspiration/sec required to grow into this tier. Tier 0 = 0 (always open). */
  readonly unlockInspiPerSec: number;
  readonly parts: ReadonlyArray<TreePartConfig>;
}

/**
 * 10 single-upgrade tiers. Base rate and base cost ramp ×5 per tier; tiers unlock at
 * rising flat inspiration/sec thresholds (×10 ladder). ALL NUMBERS TUNABLE (feel-tested
 * in play); the one-upgrade-per-tier shape + inspi/sec gating are locked.
 * Tier names 7-10 are provisional — reconcile with the long-term roadmap when known.
 */
export const TREE_STAGES: ReadonlyArray<TreeStageConfig> = [
  { id: "tier1",  name: "Tiny Sprout",    unlockInspiPerSec: 0,           parts: [{ id: "u1",  name: "Cotyledon",  baseCost: 10,         rate: 0.1 }] },
  { id: "tier2",  name: "Bud",            unlockInspiPerSec: 5,           parts: [{ id: "u2",  name: "Tendril",    baseCost: 50,         rate: 0.5 }] },
  { id: "tier3",  name: "Leaflet",        unlockInspiPerSec: 50,          parts: [{ id: "u3",  name: "Vein",       baseCost: 250,        rate: 2.5 }] },
  { id: "tier4",  name: "Sapling",        unlockInspiPerSec: 500,         parts: [{ id: "u4",  name: "Twig",       baseCost: 1_250,      rate: 12.5 }] },
  { id: "tier5",  name: "Whisperleaf",    unlockInspiPerSec: 5_000,       parts: [{ id: "u5",  name: "Soft Bough", baseCost: 6_250,      rate: 62.5 }] },
  { id: "tier6",  name: "Verdant Shoot",  unlockInspiPerSec: 50_000,      parts: [{ id: "u6",  name: "Greenshoot", baseCost: 31_250,     rate: 312.5 }] },
  { id: "tier7",  name: "Young Tree",     unlockInspiPerSec: 500_000,     parts: [{ id: "u7",  name: "Limb",       baseCost: 156_250,    rate: 1_562.5 }] },
  { id: "tier8",  name: "Broadleaf",      unlockInspiPerSec: 5_000_000,   parts: [{ id: "u8",  name: "Bough",      baseCost: 781_250,    rate: 7_812.5 }] },
  { id: "tier9",  name: "Elderbough",     unlockInspiPerSec: 50_000_000,  parts: [{ id: "u9",  name: "Heartwood",  baseCost: 3_906_250,  rate: 39_062.5 }] },
  { id: "tier10", name: "Great Oak",      unlockInspiPerSec: 500_000_000, parts: [{ id: "u10", name: "Crown",      baseCost: 19_531_250, rate: 195_312.5 }] },
];
