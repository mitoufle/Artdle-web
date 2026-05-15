export interface DesignResearchEffect {
  id: string;
  kind: string;
  value: number;
}

export interface DesignResearch {
  id: string;
  name: string;
  durationSeconds: number;
  effects: ReadonlyArray<DesignResearchEffect>;
}

export interface DesignTier {
  tier: number;
  label: string;
  examCost: number;
  researches: ReadonlyArray<DesignResearch>;
}

export type DesignFile = ReadonlyArray<DesignTier>;

export const EMPTY_DESIGN: DesignFile = [];
