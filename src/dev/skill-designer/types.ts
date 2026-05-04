export interface DesignNode {
  id: string;
  name: string;
  description: string;
  numericEffect: string;
  parentId: string | null;
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
