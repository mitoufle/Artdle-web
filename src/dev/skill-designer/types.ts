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

export interface DesignCluster {
  id: string;
  name: string;
  theme: string;
  rootNodeId: string;
  region: { x: number; y: number; w: number; h: number };
}

export interface DesignFile {
  version: 1;
  title: string;
  designedAt: string;
  nodes: ReadonlyArray<DesignNode>;
  clusters: ReadonlyArray<DesignCluster>;
}

export const EMPTY_DESIGN: DesignFile = {
  version: 1,
  title: "Untitled draft",
  designedAt: "",
  nodes: [],
  clusters: [],
};
