import designJson from "./skillTreeDesign.json";

/** Node identifier. String — typo protection is sacrificed for data-driven config. */
export type SkillNodeId = string;

export type StackingMode = "additive" | "multiplicative";
export type NodeKind = "minor" | "major";

export interface SkillNodeConfig {
  readonly id: SkillNodeId;
  readonly name: string;
  readonly description: string;
  /** Free-form effect text, e.g. "+10% gold per level". Player-facing. */
  readonly numericEffect: string;
  /** Parent node IDs. Empty array = root (child of FAME hub). */
  readonly parentIds: ReadonlyArray<SkillNodeId>;
  /** Per-level costs in fame. `costs.length === maxLevel`. */
  readonly costs: ReadonlyArray<number>;
  readonly maxLevel: number;
  readonly stacking: StackingMode;
  /** Visual prominence on the constellation. Major nodes render bigger + brighter. */
  readonly kind: NodeKind;
}

/**
 * Designed tree, derived from `skillTreeDesign.json` at module load.
 * Re-imported as plain JSON; Vite handles JSON imports natively.
 *
 * To redesign: edit the JSON via the /dev/skill-designer route, then
 * restart the dev server (Vite caches JSON imports).
 */
export const SKILL_NODES: ReadonlyArray<SkillNodeConfig> = designJson.nodes.map(
  (n) => {
    const raw = n as Record<string, unknown>;
    return {
      id: n.id,
      name: n.name,
      description: n.description,
      numericEffect: n.numericEffect,
      parentIds: n.parentIds,
      costs: n.costs,
      maxLevel: n.maxLevel,
      stacking: n.stacking as StackingMode,
      kind: (raw.kind as NodeKind | undefined) ?? "minor",
    };
  },
);

/** Lookup helper. Returns null if id unknown. */
export function getSkillNodeConfig(id: SkillNodeId): SkillNodeConfig | null {
  return SKILL_NODES.find((n) => n.id === id) ?? null;
}
