export type AchievementOp = ">=" | ">" | "==" | "<=" | "<";
export type AchievementCategory = "canvas" | "workshop" | "ascension" | "school_office" | "secret";

export interface DesignEffect {
  id: string;  // ephemeral — stripped before saving
  kind: string;
  value: number;
}

export interface DesignCondition {
  stat: string;
  op: AchievementOp;
  value: number;
}

export interface DesignAchievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  condition: DesignCondition;
  effects: ReadonlyArray<DesignEffect>;
}

export type DesignFile = ReadonlyArray<DesignAchievement>;

export const EMPTY_DESIGN: DesignFile = [];
