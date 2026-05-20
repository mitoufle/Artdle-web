import type { DesignAchievement, DesignFile, AchievementCategory } from "./types";

export interface CategoryGroup {
  readonly category: AchievementCategory;
  readonly achievements: ReadonlyArray<DesignAchievement>;
}

/**
 * Groups achievements by category. Categories appear in first-occurrence
 * order (the order in which each category's first achievement appears in
 * the flat input). Achievements within a group are in flat-array order.
 *
 * Empty input → empty output. Empty categories are not represented — only
 * categories with at least one achievement get a group.
 */
export function groupByCategory(design: DesignFile): ReadonlyArray<CategoryGroup> {
  const byCategory = new Map<AchievementCategory, DesignAchievement[]>();
  for (const a of design) {
    const existing = byCategory.get(a.category);
    if (existing) {
      existing.push(a);
    } else {
      byCategory.set(a.category, [a]);
    }
  }
  return Array.from(byCategory.entries()).map(([category, achievements]) => ({
    category,
    achievements,
  }));
}
