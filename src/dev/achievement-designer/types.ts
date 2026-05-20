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
  // Raw text the designer typed for the condition. Source of truth for the
  // input field; parsed best-effort into `condition`. Ephemeral — stripped
  // before saving to the config JSON (like DesignEffect.id).
  conditionText?: string;
  effects: ReadonlyArray<DesignEffect>;
}

export type DesignFile = ReadonlyArray<DesignAchievement>;

export const EMPTY_DESIGN: DesignFile = [];

/**
 * Effect kinds the engine knows how to apply (see `core/multipliers.ts` and
 * `core/schoolMultipliers.ts`). The designer lists these in the kind
 * dropdown; effects whose kind is NOT in this list are flagged "custom" and
 * get a free-text input. Keep in sync with the runtime resolver.
 */
export const KNOWN_EFFECT_KINDS = [
  "paint_mastery_flat",
  "canvas_gold_pct",
  "speed_pct",
  "inspi_pct",
] as const;
