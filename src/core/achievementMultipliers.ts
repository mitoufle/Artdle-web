import { ACHIEVEMENTS } from "@/config/achievementConfig";

export function getAchievementBonus(
  state: { completedAchievements: Record<string, true> },
  kind: string,
): number {
  let total = 0;
  for (const achievement of ACHIEVEMENTS) {
    if (!state.completedAchievements[achievement.id]) continue;
    for (const effect of achievement.effects) {
      if (effect.kind === kind) total += effect.value;
    }
  }
  return total;
}
