import rawTiers from "./schoolResearches.json";

export interface SchoolResearchEffect {
  kind: string;
  value: number;
}

export interface SchoolResearch {
  id: string;
  name: string;
  durationSeconds: number;
  effects: ReadonlyArray<SchoolResearchEffect>;
}

export interface SchoolTier {
  tier: number;
  label: string;
  examCost: number;
  researches: ReadonlyArray<SchoolResearch>;
}

export const SCHOOL_TIERS: ReadonlyArray<SchoolTier> = rawTiers as ReadonlyArray<SchoolTier>;
