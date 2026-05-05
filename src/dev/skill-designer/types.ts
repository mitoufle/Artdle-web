export type StackingMode = "additive" | "multiplicative";

export interface DesignNode {
  id: string;
  name: string;
  description: string;
  numericEffect: string;
  parentIds: ReadonlyArray<string>;
  stacking: StackingMode;
  maxLevel: number;
  costs: ReadonlyArray<number>;
  position: { x: number; y: number } | null;
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
