import { useMemo, type JSX } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { craftCost, xpToNext } from "@/core/balance";
import {
  getUnlockedSlotKinds,
  getMaxInventorySlots,
  getFusionTarget,
  getFuseCost,
} from "@/store/workshopSlice";
import type { Item } from "@/store/workshopSlice";
import type { AffixKind, SlotKind } from "@/config/workshopAffixes";
import { ALL_SLOT_KINDS, AFFIX_SYMBOL } from "@/config/workshopAffixes";
import { formatBig } from "@/core/formatter";
import { Hoverable } from "@/ui/widgets/Hoverable";
import {
  computeTierProbabilities,
  ALL_ITEM_TIERS,
  TIER_UNLOCK_LEVEL,
} from "@/core/workshopRoll";
import type { ItemTier } from "@/core/workshopRoll";
import styles from "./WorkshopRoom.module.css";

const TIER_LABEL: Record<ItemTier, string> = {
  normal: "Normal",
  magic: "Magic",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

const SLOT_UNLOCK_NODE: Partial<Record<SlotKind, string>> = {
  palette: "gear_up",
  easel: "forget_pain",
  hat: "painters_hat",
  apron: "painters_apron",
  boots: "painters_boots",
};

// Long-form labels used in hover bodies (tests assert these strings).
const AFFIX_LABEL: Record<AffixKind, (m: number) => string> = {
  "+sell_price%": (m) => `+${m}% sell price`,
  "+speed%": (m) => `+${m}% speed`,
  "+crit_chance%": (m) => `+${m}% crit chance`,
  "+combo_chance%": (m) => `+${m}% combo chance`,
  "+size%": (m) => `+${m}% size`,
};

function itemHoverBody(item: Item, workshopLevel: number, isFusion: boolean): JSX.Element {
  const fuseCost = isFusion ? getFuseCost(item, workshopLevel) : null;
  return (
    <>
      {item.affixes.map((a, i) => (
        <div key={i}>{AFFIX_LABEL[a.kind](a.magnitude)}</div>
      ))}
      {item.fuseCount > 0 && <div>Fused {item.fuseCount}×</div>}
      {isFusion && fuseCost && <div>───</div>}
      {isFusion && fuseCost && <div>Fuse cost: {formatBig(fuseCost)} g</div>}
    </>
  );
}

function craftHoverBody(): JSX.Element {
  const s = useGameStore.getState();
  const level = s.workshopLevel;
  const cost = craftCost(level);
  const probs = computeTierProbabilities(level);
  return (
    <>
      <div>Cost: {formatBig(cost)} g</div>
      <div>───</div>
      {ALL_ITEM_TIERS.map((t) => {
        const unlock = TIER_UNLOCK_LEVEL[t];
        const locked = level < unlock;
        return (
          <div key={t}>
            {TIER_LABEL[t]}: {locked ? `— (unlocks Lv ${unlock})` : (probs[t]! * 100).toFixed(2) + "%"}
          </div>
        );
      })}
    </>
  );
}

function levelHoverBody(): JSX.Element {
  const s = useGameStore.getState();
  return (
    <>
      <div>XP: {s.workshopXp} / {xpToNext(s.workshopLevel)}</div>
      <div>───</div>
      {ALL_ITEM_TIERS.filter((t) => t !== "normal").map((t) => {
        const unlock = TIER_UNLOCK_LEVEL[t];
        return (
          <div key={t}>{TIER_LABEL[t]} at Lv {unlock}{s.workshopLevel >= unlock ? " ✓" : ""}</div>
        );
      })}
    </>
  );
}

export function WorkshopRoom(): JSX.Element {
  const inventory = useGameStore((s) => s.inventory);
  const equipped = useGameStore((s) => s.equipped);
  const gold = useGameStore((s) => s.gold);
  const workshopLevel = useGameStore((s) => s.workshopLevel);
  const workshopXp = useGameStore((s) => s.workshopXp);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const craft = useGameStore((s) => s.craft);
  const equipItem = useGameStore((s) => s.equipItem);
  const unequipSlot = useGameStore((s) => s.unequipSlot);
  const discard = useGameStore((s) => s.discard);
  const fuseItem = useGameStore((s) => s.fuseItem);

  const helperState = { purchasedNodes } as unknown as GameStore;
  const unlockedSlots = useMemo(
    () => getUnlockedSlotKinds(helperState),
    [purchasedNodes],
  );
  const maxSlots = useMemo(
    () => getMaxInventorySlots(helperState),
    [purchasedNodes],
  );
  const hasShredder = (purchasedNodes.shredder ?? 0) > 0;

  const cost = craftCost(workshopLevel);
  const xpMax = xpToNext(workshopLevel);
  const xpPct = Math.max(0, Math.min(100, (workshopXp / xpMax) * 100));
  const canCraft = gold.gte(cost) && (inventory.length < maxSlots || hasShredder);

  const fusionTargetMap = useMemo(() => {
    const map = new Map<string, Item | null>();
    for (const item of inventory) {
      map.set(item.id, getFusionTarget(item, equipped));
    }
    return map;
  }, [inventory, equipped]);

  // For each equipped slot: first inventory item whose fusion target is that slot.
  const slotFusionMap = useMemo(() => {
    const map = new Map<SlotKind, { candidate: Item; canFuse: boolean }>();
    for (const item of inventory) {
      const target = fusionTargetMap.get(item.id);
      if (!target || map.has(item.slot)) continue;
      map.set(item.slot, {
        candidate: item,
        canFuse: gold.gte(getFuseCost(target, workshopLevel)),
      });
    }
    return map;
  }, [inventory, fusionTargetMap, gold, workshopLevel]);

  return (
    <section className={styles.room} aria-label="Workshop room">
      <Hoverable
        as="div"
        title={`Workshop Lv ${workshopLevel}`}
        body={() => levelHoverBody()}
        footer="Higher tiers drop more XP."
      >
        <header className={styles.header} data-testid="workshop-level-header">
          <h2 className={styles.title}>Workshop</h2>
          <div className={styles.levelStrip}>
            <span className={styles.levelLabel}>Lv {workshopLevel}</span>
            <div className={styles.xpBar}>
              <div className={styles.xpFill} style={{ width: `${xpPct}%` }} />
            </div>
            <span className={styles.xpReadout}>{workshopXp} / {xpMax}</span>
          </div>
        </header>
      </Hoverable>

      <section className={styles.craftStation}>
        <Hoverable
          title="Craft Item"
          body={() => craftHoverBody()}
          footer="Craft consumes gold. Higher tiers award more XP."
        >
          <button
            type="button"
            className={styles.craftBtn}
            disabled={!canCraft}
            onClick={() => craft()}
            data-testid="craft-button"
          >
            Craft · {formatBig(cost)} g
          </button>
        </Hoverable>
      </section>

      <section className={styles.section}>
        <div className={styles.subhead}>
          Equipped <span className={styles.count}>{Object.keys(equipped).length}/{unlockedSlots.length}</span>
        </div>
        <div className={styles.equippedGrid}>
          {ALL_SLOT_KINDS.map((slot) => {
            const isUnlocked = unlockedSlots.includes(slot);
            const item = equipped[slot];
            const unlockNode = SLOT_UNLOCK_NODE[slot];

            if (!isUnlocked) {
              return (
                <Hoverable
                  key={slot}
                  as="div"
                  title={`${slot} (locked)`}
                  body={unlockNode ? `Purchase "${unlockNode}" in the skill tree to unlock.` : ""}
                >
                  <div className={styles.lockedSlot}>
                    <span>{slot}</span>
                    <span>🔒</span>
                  </div>
                </Hoverable>
              );
            }

            if (!item) {
              return (
                <div key={slot} data-testid={`slot-${slot}`}>
                  <Hoverable
                    as="div"
                    title={`${slot} (empty)`}
                    body="Equip an item from your inventory."
                  >
                    <div className={styles.emptySlot} aria-label={slot}>
                      <span className={styles.slotLabel}>—</span>
                    </div>
                  </Hoverable>
                </div>
              );
            }

            const fusionEntry = slotFusionMap.get(slot) ?? null;
            const hasFusion = fusionEntry !== null;
            const canFuse = fusionEntry?.canFuse ?? false;

            return (
              <Hoverable
                key={slot}
                as="div"
                title={hasFusion ? `${TIER_LABEL[item.tier]} ${slot} — FUSION READY` : `${TIER_LABEL[item.tier]} ${slot} — equipped`}
                body={() => itemHoverBody(item, workshopLevel, hasFusion)}
                footer={
                  hasFusion
                    ? (canFuse ? "Click to fuse." : "Not enough gold — click to unequip.")
                    : "Click to unequip."
                }
              >
                <button
                  type="button"
                  className={`${styles.itemSquare}${hasFusion && canFuse ? ` ${styles.equippedFusion}` : ""}`}
                  data-tier={item.tier}
                  onClick={() => (hasFusion && canFuse) ? fuseItem(fusionEntry!.candidate.id) : unequipSlot(slot)}
                  data-testid={hasFusion && canFuse ? `slot-fuse-${slot}` : `slot-unequip-${slot}`}
                >
                  <span className={styles.tierTag}>{TIER_LABEL[item.tier]}</span>
                  <span className={styles.slotLabel}>{slot}</span>
                  {item.affixes.slice(0, 2).map((a, i) => (
                    <span key={i} className={styles.affixLine}>{AFFIX_SYMBOL[a.kind]} +{a.magnitude}%</span>
                  ))}
                  {item.affixes.length > 2 && (
                    <span className={styles.affixLine}>+{item.affixes.length - 2} more</span>
                  )}
                </button>
              </Hoverable>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.subhead}>
          Inventory <span className={styles.count}>{inventory.length}/{maxSlots}</span>
        </div>
        {inventory.length === 0 ? (
          <div className={styles.empty}>Empty — click Craft to roll an item.</div>
        ) : (
          <div className={styles.inventoryGrid}>
            {inventory.map((item) => (
              <div
                key={item.id}
                className={styles.itemCell}
                data-testid={`inventory-item-${item.id}`}
              >
                <Hoverable
                  title={`${TIER_LABEL[item.tier]} ${item.slot}`}
                  body={() => itemHoverBody(item, workshopLevel, false)}
                  footer="Left-click to equip · right-click to discard."
                >
                  <button
                    type="button"
                    className={styles.itemSquare}
                    data-tier={item.tier}
                    onClick={() => equipItem(item.id)}
                    onContextMenu={(e) => { e.preventDefault(); discard(item.id); }}
                    data-testid={`inventory-equip-${item.id}`}
                  >
                    <span className={styles.tierTag}>{TIER_LABEL[item.tier]}</span>
                    <span className={styles.slotLabel}>{item.slot}</span>
                    {item.affixes.slice(0, 2).map((a, i) => (
                      <span key={i} className={styles.affixLine}>{AFFIX_SYMBOL[a.kind]} +{a.magnitude}%</span>
                    ))}
                    {item.affixes.length > 2 && (
                      <span className={styles.affixLine}>+{item.affixes.length - 2} more</span>
                    )}
                  </button>
                </Hoverable>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
