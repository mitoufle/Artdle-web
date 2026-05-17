import rawAchievements from "./achievementsDesign.json";

export interface AchievementCondition {
  stat: string;
  op: ">=" | ">" | "==" | "<=" | "<";
  value: number;
}

export interface AchievementEffect {
  kind: string;
  value: number;
}

export type AchievementCategory = "canvas" | "workshop" | "ascension" | "school_office" | "secret";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  condition: AchievementCondition;
  effects: ReadonlyArray<AchievementEffect>;
}

export const ACHIEVEMENTS: ReadonlyArray<Achievement> =
  rawAchievements as ReadonlyArray<Achievement>;
