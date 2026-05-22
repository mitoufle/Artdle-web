import {
  TAYLORISM_INTERVAL_S, THIRD_HAND_INTERVAL_REDUCTION,
  craftCost, MAX_WORKSHOP_LEVEL, xpToNext,
} from "@/core/balance";
import { getNodeLevel } from "@/store/skillTreeSlice";
import {
  getUnlockedSlotKinds, getMaxInventorySlots,
  TIER_XP, nextItemId, type Item,
} from "@/store/workshopSlice";
import { rollTier, rollAffixes } from "@/core/workshopRoll";
import {
  getAffixMagnitudeBonus, getSchoolAffixMagnitudeMultiplier,
} from "@/core/multipliers";
import { rngPick } from "@/core/rng";
import {
  spendCurrency, incrementStatPure, type DraftState,
} from "@/core/pureMutations";

/**
 * Pure port of `performCraft` (workshopSlice.ts:166). Mutates `draft`.
 * Returns false if the craft can't proceed (cap reached without shredder OR all
 * tiers protected OR insufficient gold). Does NOT call `evaluateAchievements()`
 * — the wrapper handles that.
 */
export function performCraftPure(draft: DraftState): boolean {
  const cap = getMaxInventorySlots(draft);
  const hasShredder = getNodeLevel(draft, "shredder") > 0;
  if (draft.inventory.length >= cap) {
    if (!hasShredder) return false;
    // Has shredder but all items are protected — nothing to kick out.
    if (draft.inventory.every((i) => draft.protectedTiers[i.tier])) return false;
  }
  const cost = craftCost(draft.workshopLevel);
  if (!spendCurrency(draft, "gold", cost)) return false;

  const unlocked = getUnlockedSlotKinds(draft);
  const slot = rngPick(unlocked);
  const tier = rollTier(draft.workshopLevel);
  const affixes = rollAffixes(
    tier,
    draft,
    getAffixMagnitudeBonus(draft),
    getSchoolAffixMagnitudeMultiplier(draft),
  );
  const item: Item = { id: nextItemId(), slot, tier, affixes, fuseCount: 0 };

  let newLevel = draft.workshopLevel;
  let newXp = draft.workshopXp + TIER_XP[item.tier];
  while (newLevel < MAX_WORKSHOP_LEVEL && newXp >= xpToNext(newLevel)) {
    newXp -= xpToNext(newLevel);
    newLevel += 1;
  }
  draft.workshopLevel = newLevel;
  draft.workshopXp = newXp;

  if (draft.inventory.length >= cap) {
    // Kick the oldest unprotected item to make room.
    const kickIdx = draft.inventory.findIndex((i) => !draft.protectedTiers[i.tier]);
    if (kickIdx === -1) {
      // workshopLevel/Xp still applied — matches original behavior.
      return true;
    }
    const trimmed = [
      ...draft.inventory.slice(0, kickIdx),
      ...draft.inventory.slice(kickIdx + 1),
    ];
    draft.inventory = [...trimmed, item];
  } else {
    draft.inventory = [...draft.inventory, item];
  }
  incrementStatPure(draft, "lifetime", "workshopItemsCrafted");
  incrementStatPure(draft, "run", "workshopItemsCrafted");
  return true;
}

/**
 * Pure port of `workshopTick` (workshopSlice.ts:321). Mutates `draft`.
 * Drives Taylorism auto-craft: bumps `autoCraftTimer` by `deltaSeconds`,
 * fires one craft per interval crossed, breaks on first craft failure.
 */
export function workshopTickPure(draft: DraftState, deltaSeconds: number): void {
  if (deltaSeconds <= 0) return;
  const taylorismLevel = getNodeLevel(draft, "taylorsim");
  if (taylorismLevel === 0) return;
  if (!draft.autoCraftEnabled) return;

  const thirdHandLevel = getNodeLevel(draft, "third_hand");
  const interval = TAYLORISM_INTERVAL_S * (1 - THIRD_HAND_INTERVAL_REDUCTION * thirdHandLevel);

  const next = draft.autoCraftTimer + deltaSeconds;
  const grants = Math.floor(next / interval);
  if (grants > 0) {
    for (let i = 0; i < grants; i++) {
      if (!performCraftPure(draft)) break;
    }
  }
  draft.autoCraftTimer = next - grants * interval;
}
