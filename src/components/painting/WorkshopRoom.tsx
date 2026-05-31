import { useMemo, useRef, useEffect, useCallback, type JSX } from "react";
import { useGameStore } from "@/store";
import { craftCost, xpToNext } from "@/core/balance";
import {
  getUnlockedSlotKinds,
  getMaxInventorySlots,
  getFusionTarget,
  getFuseCost,
} from "@/store/workshopSlice";
import type { Item } from "@/store/workshopSlice";
import type { AffixKind, SlotKind } from "@/config/workshopAffixes";
import { ALL_SLOT_KINDS, AFFIX_SYMBOL, AFFIX_COLOR, AFFIX_SYMBOL_SCALE } from "@/config/workshopAffixes";
import { formatBig } from "@/core/formatter";
import { Hoverable } from "@/ui/widgets/Hoverable";
import { CurrencyAmount } from "@/ui/widgets/CurrencyAmount";
import { PixelLock } from "@/ui/widgets/PixelLock";
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

const SLOT_PLACEHOLDER: Record<SlotKind, JSX.Element> = {
  brush: (
    <svg viewBox="0 0 40 40" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="30" y1="5" x2="17" y2="27" />
      <line x1="15" y1="26" x2="19" y2="29" />
      <path d="M15 27 Q9 33 12 37 Q17 34 19 29" />
    </svg>
  ),
  palette: (
    <svg viewBox="0 0 40 40" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 7 C29 7 35 13 33 21 C31 29 22 35 14 32 C7 29 6 19 11 13 C14 9 17 7 21 7 Z" />
      <circle cx="20" cy="30" r="3.5" />
      <circle cx="14" cy="16" r="2" fill="currentColor" stroke="none" />
      <circle cx="23" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="29" cy="20" r="2" fill="currentColor" stroke="none" />
    </svg>
  ),
  easel: (
    <svg viewBox="0 0 40 40" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="20" y1="6" x2="7" y2="37" />
      <line x1="20" y1="6" x2="33" y2="37" />
      <line x1="11" y1="26" x2="29" y2="26" />
      <rect x="14" y="8" width="12" height="14" rx="1" />
    </svg>
  ),
  hat: (
    <svg viewBox="0 0 40 40" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <ellipse cx="20" cy="28" rx="16" ry="4.5" />
      <path d="M7 28 C7 16 12 9 20 8 C28 9 33 16 33 28" />
      <circle cx="25" cy="9" r="2" />
    </svg>
  ),
  apron: (
    <svg viewBox="0 0 40 40" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M11 22 L11 36 Q11 38 13 38 L27 38 Q29 38 29 36 L29 22 Z" />
      <path d="M15 22 L15 15 Q15 9 20 9 Q25 9 25 15 L25 22" />
      <line x1="11" y1="22" x2="7" y2="13" />
      <line x1="29" y1="22" x2="33" y2="13" />
    </svg>
  ),
  boots: (
    <svg viewBox="0 0 40 40" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 6 L16 24 Q15 31 20 33 L30 33 L30 30 Q24 30 23 25 L23 6 Z" />
    </svg>
  ),
};

// Long-form labels used in hover bodies (tests assert these strings).
const AFFIX_LABEL: Record<AffixKind, (m: number) => string> = {
  "+sell_price%": (m) => `+${m}% sell price`,
  "+speed%": (m) => `+${m}% speed`,
  "+crit_chunks": (m) => `+${m}% crit strokes`,
  "+combo_chance%": (m) => `+${m}% combo chance`,
};

function itemHoverBody(
  item: Item,
  workshopLevel: number,
  isFusion: boolean,
  purchasedNodes: Record<string, number | undefined>,
): JSX.Element {
  const fuseCost = isFusion ? getFuseCost(item, workshopLevel, { purchasedNodes }) : null;
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
  const protectedTiers = useGameStore((s) => s.protectedTiers);
  const autoCraftEnabled = useGameStore((s) => s.autoCraftEnabled);
  const craft = useGameStore((s) => s.craft);
  const equipItem = useGameStore((s) => s.equipItem);
  const unequipSlot = useGameStore((s) => s.unequipSlot);
  const discard = useGameStore((s) => s.discard);
  const fuseItem = useGameStore((s) => s.fuseItem);
  const toggleProtected = useGameStore((s) => s.toggleProtected);
  const toggleAutoCraft = useGameStore((s) => s.toggleAutoCraft);

  const hasTaylorism = (purchasedNodes.taylorsim ?? 0) > 0;

  const helperState = { purchasedNodes };
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
  const hasUnprotectedInInventory = inventory.some((item) => !protectedTiers[item.tier]);
  const canCraft = gold.gte(cost) && (inventory.length < maxSlots || (hasShredder && hasUnprotectedInInventory));

  const holdRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; interval: ReturnType<typeof setInterval> | null }>
    ({ timer: null, interval: null });

  const clearHold = useCallback(() => {
    if (holdRef.current.timer) { clearTimeout(holdRef.current.timer); holdRef.current.timer = null; }
    if (holdRef.current.interval) { clearInterval(holdRef.current.interval); holdRef.current.interval = null; }
  }, []);

  useEffect(() => clearHold, [clearHold]);

  const handleCraftPointerDown = useCallback(() => {
    craft();
    holdRef.current.timer = setTimeout(() => {
      holdRef.current.interval = setInterval(() => craft(), 80);
    }, 350);
  }, [craft]);

  const fusionTargetMap = useMemo(() => {
    const map = new Map<string, Item | null>();
    for (const item of inventory) {
      map.set(item.id, getFusionTarget(item, equipped, { purchasedNodes }));
    }
    return map;
  }, [inventory, equipped, purchasedNodes]);

  // For each inventory item that has a fusion target, record the first candidate per slot.
  const slotFusionMap = useMemo(() => {
    const map = new Map<SlotKind, { candidate: Item; canFuse: boolean }>();
    for (const item of inventory) {
      const target = fusionTargetMap.get(item.id);
      if (!target || map.has(item.slot)) continue;
      map.set(item.slot, {
        candidate: item,
        canFuse: gold.gte(getFuseCost(target, workshopLevel, { purchasedNodes })),
      });
    }
    return map;
  }, [inventory, fusionTargetMap, gold, workshopLevel, purchasedNodes]);

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
            onPointerDown={handleCraftPointerDown}
            onPointerUp={clearHold}
            onPointerLeave={clearHold}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); craft(); } }}
            data-testid="craft-button"
          >
            Craft · <CurrencyAmount kind="gold" value={formatBig(cost)} />
          </button>
        </Hoverable>
        {hasTaylorism && (
          <div className={styles.autoCraftRow}>
            <span className={styles.autoCraftLabel}>Auto</span>
            <button
              type="button"
              role="switch"
              aria-checked={autoCraftEnabled}
              className={`${styles.autoCraftToggle}${autoCraftEnabled ? ` ${styles.autoCraftOn}` : ""}`}
              onClick={toggleAutoCraft}
              data-testid="autocraft-toggle"
              title={autoCraftEnabled ? "Auto-craft enabled — click to pause" : "Auto-craft paused — click to resume"}
            />
          </div>
        )}
      </section>

      <section className={styles.filterSection}>
        <Hoverable
          as="div"
          title="Protect Tiers"
          body="When auto-craft needs to free a slot, it will only discard items whose tier is not protected. Toggle a tier button to mark it as safe — protected items are never auto-kicked."
          footer="Items you equip are never discarded regardless of protection."
        >
          <div className={styles.subhead} style={{ cursor: "default" }}>Protect tiers</div>
        </Hoverable>
        <div className={styles.tierFilterRow}>
          {ALL_ITEM_TIERS.map((tier) => {
            const unlockLv = TIER_UNLOCK_LEVEL[tier];
            const locked = workshopLevel < unlockLv;
            const active = protectedTiers[tier] === true;
            return (
              <button
                key={tier}
                type="button"
                data-tier={tier}
                data-active={active}
                className={`${styles.tierFilterBtn}${locked ? ` ${styles.tierFilterLocked}` : ""}`}
                disabled={locked}
                onClick={() => toggleProtected(tier)}
                title={locked ? `Unlocks at Lv ${unlockLv}` : (active ? "Protected — won't be auto-kicked" : "Unprotected — click to protect")}
              >
                {TIER_LABEL[tier]}
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.subhead}>
          Equipped <span className={styles.count}>{Object.keys(equipped).length}/{unlockedSlots.length}</span>
        </div>
        <div className={styles.itemList}>
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
                  <div className={styles.lockedRow}>
                    <span className={styles.itemRowIcon}>{SLOT_PLACEHOLDER[slot]}</span>
                    <span>{slot}</span>
                    <PixelLock size={16} />
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
                    <div className={styles.emptyRow} aria-label={slot}>
                      <span className={styles.itemRowIcon}>{SLOT_PLACEHOLDER[slot]}</span>
                      <span className={styles.slotName}>{slot}</span>
                      <span style={{ color: "var(--ink-3)", fontSize: 10 }}>— empty</span>
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
                body={() => itemHoverBody(item, workshopLevel, hasFusion, purchasedNodes)}
                footer={
                  hasFusion
                    ? (canFuse ? "Click to fuse." : "Not enough gold — click to unequip.")
                    : "Click to unequip."
                }
              >
                <button
                  type="button"
                  className={`${styles.itemRow}${hasFusion && canFuse ? ` ${styles.itemRowFusion}` : ""}`}
                  data-tier={item.tier}
                  onClick={() => (hasFusion && canFuse) ? fuseItem(fusionEntry!.candidate.id) : unequipSlot(slot)}
                  data-testid={hasFusion && canFuse ? `slot-fuse-${slot}` : `slot-unequip-${slot}`}
                >
                  <span className={styles.itemRowIcon}>{SLOT_PLACEHOLDER[slot]}</span>
                  <div className={styles.itemRowMeta}>
                    <span className={styles.tierBadge}>{TIER_LABEL[item.tier]}{item.fuseCount > 0 ? ` +${item.fuseCount}` : ""}</span>
                    <span className={styles.slotName}>{slot}</span>
                  </div>
                  <div className={styles.itemRowAffixes}>
                    {item.affixes.map((a, i) => (
                      <span key={i} className={styles.affixChip}>
                        <span style={{ color: AFFIX_COLOR[a.kind], fontSize: `${11 * AFFIX_SYMBOL_SCALE[a.kind]}px` }}>{AFFIX_SYMBOL[a.kind]}</span>
                        {a.magnitude}%
                      </span>
                    ))}
                  </div>
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
          <div className={styles.inventoryList}>
            {inventory.map((item) => (
              <div
                key={item.id}
                className={styles.itemCell}
                data-testid={`inventory-item-${item.id}`}
              >
                <Hoverable
                  title={`${TIER_LABEL[item.tier]} ${item.slot}`}
                  body={() => itemHoverBody(item, workshopLevel, false, purchasedNodes)}
                  footer="Left-click to equip · right-click to discard."
                >
                  <button
                    type="button"
                    className={styles.itemRow}
                    data-tier={item.tier}
                    onClick={() => equipItem(item.id)}
                    onContextMenu={(e) => { e.preventDefault(); discard(item.id); }}
                    data-testid={`inventory-equip-${item.id}`}
                  >
                    <span className={styles.itemRowIcon}>{SLOT_PLACEHOLDER[item.slot]}</span>
                    <div className={styles.itemRowMeta}>
                      <span className={styles.tierBadge}>{TIER_LABEL[item.tier]}{item.fuseCount > 0 ? ` +${item.fuseCount}` : ""}</span>
                      <span className={styles.slotName}>{item.slot}</span>
                    </div>
                    <div className={styles.itemRowAffixes}>
                      {item.affixes.map((a, i) => (
                        <span key={i} className={styles.affixChip}>
                          <span style={{ color: AFFIX_COLOR[a.kind], fontSize: `${11 * AFFIX_SYMBOL_SCALE[a.kind]}px` }}>{AFFIX_SYMBOL[a.kind]}</span>
                          {a.magnitude}%
                        </span>
                      ))}
                    </div>
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
