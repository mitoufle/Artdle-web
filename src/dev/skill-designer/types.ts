export type StackingMode = "additive" | "multiplicative";

/** Visual prominence on the constellation. Minor = small + dim; Major = big + bright. */
export type NodeKind = "minor" | "major";

export interface DesignNode {
  id: string;
  name: string;
  description: string;
  numericEffect: string;
  parentIds: ReadonlyArray<string>;
  stacking: StackingMode;
  kind: NodeKind;
  maxLevel: number;
  costs: ReadonlyArray<number>;
  /** Capability tags granted when this node is purchased (level ≥ 1). */
  unlocks: ReadonlyArray<string>;
  position: { x: number; y: number } | null;
  /** Which constellation cluster this node belongs to. */
  clusterId: string;
}

export interface DesignFile {
  version: 1;
  title: string;
  designedAt: string;
  nodes: ReadonlyArray<DesignNode>;
}

export const EMPTY_DESIGN: DesignFile = {
  version: 1,
  title: "Untitled draft",
  designedAt: "",
  nodes: [],
};
