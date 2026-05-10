import type { JSX } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { craftCost, xpToNext } from "@/core/balance";
import { getUnlockedSlotKinds, getMaxInventorySlots } from "@/store/workshopSlice";
import { formatBig } from "@/core/formatter";
import type { Item, ItemTier } from "@/store/workshopSlice";
import type { AffixKind } from "@/config/workshopAffixes";
import { Hoverable } from "@/ui/widgets/Hoverable";
import {
  computeTierProbabilities,
  ALL_ITEM_TIERS,
  TIER_UNLOCK_LEVEL,
} from "@/core/workshopRoll";
import styles from "./WorkshopRoom.module.css";

const TIER_LABEL: Record<ItemTier, string> = {
  normal: "Normal",
  magic: "Magic",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

const AFFIX_LABEL: Record<AffixKind, (m: number) => string> = {
  "+sell_price%": (m) => `+${m}% sell price`,
  "+speed%": (m) => `+${m}% speed`,
  "+crit_chance%": (m) => `+${m}% crit chance`,
  "+combo_chance%": (m) => `+${m}% combo chance`,
  "+size%": (m) => `+${m}% size`,
};

function affixHoverBody(affixes: Item["affixes"]): JSX.Element {
  return (
    <>
      {affixes.map((a, i) => (
        <div key={i}>{AFFIX_LABEL[a.kind](a.magnitude)}</div>
      ))}
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
            {TIER_LABEL[t]}: {locked ? "—" : (probs[t] * 100).toFixed(2) + "%"}
            {locked ? `  (unlocks Lv ${unlock})` : ""}
          </div>
        );
      })}
    </>
  );
}

function levelHoverBody(): JSX.Element {
  const s = useGameStore.getState();
  const lvl = s.workshopLevel;
  const xp = s.workshopXp;
  return (
    <>
      <div>XP: {xp} / {xpToNext(lvl)}</div>
      <div>───</div>
      <div>Tier unlocks:</div>
      {ALL_ITEM_TIERS.filter((t) => t !== "normal").map((t) => {
        const unlock = TIER_UNLOCK_LEVEL[t];
        return <div key={t}>{TIER_LABEL[t]} at Lv {unlock}{lvl >= unlock ? " ✓" : ""}</div>;
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

  const helperState = { purchasedNodes } as unknown as GameStore;
  const unlockedSlots = getUnlockedSlotKinds(helperState);
  const maxSlots = getMaxInventorySlots(helperState);
  const hasShredder = (purchasedNodes.shredder ?? 0) > 0;
  const cost = craftCost(workshopLevel);
  const xpMax = xpToNext(workshopLevel);
  const xpPct = Math.max(0, Math.min(100, (workshopXp / xpMax) * 100));

  // Shredder lets the craft proceed when inventory is full (oldest gets shredded).
  const canCraft = gold.gte(cost) && (inventory.length < maxSlots || hasShredder);

  return (
    <section className={styles.room} aria-label="Workshop room">
      <Hoverable
        as="div"
        title={() => `Workshop Lv ${useGameStore.getState().workshopLevel}`}
        body={() => levelHoverBody()}
        footer="+1 XP per craft."
      >
        <header className={styles.header} data-testid="workshop-level-header">
          <h2 className={styles.title}>Workshop</h2>
          <div className={styles.levelStrip}>
            <span className={styles.levelLabel}>Lv {workshopLevel}</span>
            <div className={styles.xpBar}>
              <div className={styles.xpFill} style={{ width: `${xpPct}%` }} />
            </div>
            <span className={styles.xpReadout}>
              {workshopXp} / {xpMax}
            </span>
          </div>
        </header>
      </Hoverable>

      <section className={styles.craftStation}>
        <Hoverable
          title="Craft Item"
          body={() => craftHoverBody()}
          footer="Craft consumes gold + 1 XP."
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
          Equipped{" "}
          <span className={styles.count}>
            {Object.keys(equipped).length}/{unlockedSlots.length}
          </span>
        </div>
        <ul className={styles.list}>
          {unlockedSlots.map((slot) => (
            <li key={slot} className={styles.row} data-testid={`slot-${slot}`}>
              {equipped[slot] ? (
                <Hoverable
                  title={() => {
                    const eq = useGameStore.getState().equipped[slot];
                    return eq ? `${TIER_LABEL[eq.tier]} ${slot} — equipped` : `${slot}`;
                  }}
                  body={() => {
                    const eq = useGameStore.getState().equipped[slot];
                    return eq ? affixHoverBody(eq.affixes) : "";
                  }}
                  footer="Click to unequip."
                >
                  <button
                    type="button"
                    className={styles.itemBtn}
                    data-tier={equipped[slot]!.tier}
                    onClick={() => unequipSlot(slot)}
                    data-testid={`slot-unequip-${slot}`}
                  >
                    <span className={styles.tierTag}>{TIER_LABEL[equipped[slot]!.tier]}</span>
                    <span className={styles.slotBadge}>{slot}</span>
                    <ItemAffixList affixes={equipped[slot]!.affixes} />
                  </button>
                </Hoverable>
              ) : (
                <Hoverable
                  as="div"
                  title={`${slot} (empty)`}
                  body="Equip an item from your inventory."
                >
                  <div className={styles.emptySlot}>(empty)</div>
                </Hoverable>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <div className={styles.subhead}>
          Inventory <span className={styles.count}>{inventory.length}/{maxSlots}</span>
        </div>
        {inventory.length === 0 ? (
          <div className={styles.empty}>Empty — click Craft to roll an item.</div>
        ) : (
          <ul className={styles.list}>
            {inventory.map((item) => (
              <li
                key={item.id}
                className={styles.row}
                data-testid={`inventory-item-${item.id}`}
                data-tier={item.tier}
              >
                <Hoverable
                  title={() => `${TIER_LABEL[item.tier]} ${item.slot}`}
                  body={() => affixHoverBody(item.affixes)}
                  footer="Click to equip."
                >
                  <button
                    type="button"
                    className={styles.itemBtn}
                    data-tier={item.tier}
                    onClick={() => equipItem(item.id)}
                    data-testid={`inventory-equip-${item.id}`}
                  >
                    <span className={styles.tierTag}>{TIER_LABEL[item.tier]}</span>
                    <span className={styles.slotBadge}>{item.slot}</span>
                    <ItemAffixList affixes={item.affixes} />
                  </button>
                </Hoverable>
                <button
                  type="button"
                  className={styles.discardBtn}
                  onClick={() => discard(item.id)}
                  data-testid={`inventory-discard-${item.id}`}
                  aria-label={`Discard ${item.id}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function ItemAffixList({ affixes }: { affixes: Item["affixes"] }): JSX.Element {
  return (
    <ul className={styles.affixList}>
      {affixes.map((a, i) => (
        <li key={i} className={styles.affixRow}>
          {a.kind} {a.magnitude}%
        </li>
      ))}
    </ul>
  );
}
