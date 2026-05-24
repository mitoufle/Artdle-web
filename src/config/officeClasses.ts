import type { AffixKind } from "@/config/workshopAffixes";

export type ClassId = "generalist" | "goldsmith" | "speedrunner";

export interface WeightRange {
  readonly min: number;
  readonly max: number;
}

export interface OfficeClassConfig {
  readonly id: ClassId;
  /** Capability tag required to unlock this class. `null` = always available. */
  readonly capability: string | null;
  /** Per-AffixKind weight range. Per-worker weight is rolled from this range at hire time. */
  readonly weightRanges: Record<AffixKind, WeightRange>;
}

/** Class roll weights for the 3:1:1 distribution (generalist common, specialists rare). */
export const GENERALIST_CLASS_WEIGHT = 3;
export const SPECIALIST_CLASS_WEIGHT = 1;

export const OFFICE_CLASSES: Record<ClassId, OfficeClassConfig> = {
  generalist: {
    id: "generalist",
    capability: null,
    weightRanges: {
      "+sell_price%":   { min: 0, max: 4 },
      "+speed%":        { min: 0, max: 4 },
      "+size%":         { min: 0, max: 4 },
      "+crit_chunks":   { min: 0, max: 1 },
      "+combo_chance%": { min: 0, max: 4 },
    },
  },
  goldsmith: {
    id: "goldsmith",
    capability: "class_goldsmith",
    weightRanges: {
      "+sell_price%":   { min: 3, max: 7 },
      "+speed%":        { min: 0, max: 2 },
      "+size%":         { min: 1, max: 3 },
      "+crit_chunks":   { min: 0, max: 1 },
      "+combo_chance%": { min: 3, max: 7 },
    },
  },
  speedrunner: {
    id: "speedrunner",
    capability: "class_speedrunner",
    weightRanges: {
      "+sell_price%":   { min: 0, max: 2 },
      "+speed%":        { min: 3, max: 7 },
      "+size%":         { min: 1, max: 3 },
      "+crit_chunks":   { min: 1, max: 2 },
      "+combo_chance%": { min: 0, max: 2 },
    },
  },
};

export const ALL_CLASS_IDS: ReadonlyArray<ClassId> = ["generalist", "goldsmith", "speedrunner"];
