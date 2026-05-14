# Workshop Overhaul — Design Spec (2026-05-14)

## Overview

The Workshop currently has five item tiers (normal → legendary) but players rarely see epic or legendary because unlock levels are too high, XP accrues too slowly, and affix magnitudes are flat across all tiers. Items are also static after crafting — they never grow — making the workshop fall behind the Painter's Office as the game progresses.

This spec covers four areas:

1. Tier unlock speed + tier-scaled XP
2. Tier-scaled affix magnitude ranges
3. Fusion mechanic — items grow by absorbing matching drops
4. Three new equipment slots (hat / apron / boots)
5. PoE-style UI overhaul

---

## 1. Tier Unlock Speed & XP

### Tier unlock levels

Lowered to match worker tier unlock levels:

| Tier | Old unlock level | New unlock level |
|---|---|---|
| normal | 1 | 1 |
| magic | 5 | 3 |
| rare | 15 | 8 |
| epic | 35 | 20 |
| legendary | 70 | 40 |

Tier probability curves (`TIER_PROB_RANGES`) are **not changed**.

### XP per craft

XP awarded per craft scales with the rolled item's tier, replacing the flat `XP_PER_CRAFT = 1`:

| Tier | XP |
|---|---|
| normal | 1 |
| magic | 2 |
| rare | 3 |
| epic | 4 |
| legendary | 5 |

This creates a positive feedback loop: crafting higher-tier items levels the workshop faster, unlocking better tiers sooner. The `xpToNext(level)` formula is unchanged; only the XP awarded per craft changes.

A new constant `TIER_XP: Record<ItemTier, number>` replaces `XP_PER_CRAFT` in `balance.ts`. `workshopSlice` reads `TIER_XP[item.tier]` after a craft.

---

## 2. Tier-Scaled Affix Magnitude Ranges

Each tier has a higher magnitude floor and ceiling (flat shift, not multiplier). The Craftsmanship fame node continues to shift both bounds equally on top of these values.

All values are integer percent points.

| Tier | sell% / speed% / size% | crit% | combo% |
|---|---|---|---|
| normal | 5–15 | 2–8 | 5–20 |
| magic | 10–20 | 5–12 | 10–25 |
| rare | 16–28 | 9–17 | 16–32 |
| epic | 25–40 | 14–24 | 24–42 |
| legendary | 38–56 | 21–34 | 36–56 |

`AFFIX_MAGNITUDE_RANGE` in `workshopAffixes.ts` becomes `AFFIX_MAGNITUDE_RANGE: Record<ItemTier, Record<AffixKind, { min: number; max: number }>>`. `rollAffixes` receives the tier and looks up the correct range.

---

## 3. Fusion Mechanic

### Matching condition

Fusion candidacy is **derived state**, not stored — recomputed whenever inventory or equipped state changes (new craft, equip, unequip, discard). An inventory item is a **fusion candidate** for an equipped item if and only if:

- Same number of affixes
- Same set of affix kinds (order irrelevant, exact match)

An inventory item can match at most one equipped item (first match wins if multiple equipped items share the same affix set).

### Fusing

When the player clicks a glowing fusion candidate:

1. A random percentage is rolled independently **per affix** in the range **5%–50%**.
2. That percentage of the drop's affix magnitude is added to the corresponding affix on the equipped item.
3. The drop is destroyed and removed from inventory.
4. A gold cost is charged: `craftCost(workshopLevel) × 2^fuseCount` where `fuseCount` is the number of times this equipped item has already been fused.
5. `fuseCount` on the equipped item increments by 1.

No cap on fusions. The doubling cost is the only limiter.

### Data model changes

`Item` gains two new fields:

```ts
fuseCount: number;        // starts 0; increments on each successful fuse
affixes: Array<Affix>;    // was ReadonlyArray — magnitudes become mutable
```

`Affix.magnitude` becomes mutable (remove `readonly`). Magnitudes on equipped items are updated in-place via a store action `fuseItem(dropId: string): boolean`.

### Save migration

A new save version is required. Migration defaults `fuseCount: 0` on every item in `inventory` and every item in `equipped`. All other state is preserved.

---

## 4. New Equipment Slots

Three new `SlotKind` values: `"hat"`, `"apron"`, `"boots"`. All generic — any affix kind can roll on any slot.

### Fame node unlocks

| Node ID | Slot unlocked | Skill tree position |
|---|---|---|
| `painters_hat` | hat | near `gear_up` |
| `painters_apron` | apron | near `gear_up` |
| `painters_boots` | boots | near `forget_pain` |

`getUnlockedSlotKinds` extended to check the three new nodes.

### Save compatibility

`equipped` is typed as `Partial<Record<SlotKind, Item>>`. New slot kinds absent from an existing save are simply missing — no migration needed.

---

## 5. UI Overhaul

### Item cards

Items are displayed as **72×72 px squares** in both the equipped grid and inventory grid, replacing the current rectangular cards.

### Tier colors

Background tint and border glow applied per tier:

| Tier | Color |
|---|---|
| normal | grey `#9e9e9e` |
| magic | green `#4caf50` |
| rare | blue `#4b8ef1` |
| epic | purple `#b060e0` |
| legendary | orange-red `#e8602c` |

### Layout

**Equipped section:** 6-slot labeled grid (brush / palette / easel / hat / apron / boots). Locked slots (fame node not purchased) show a dimmed placeholder with the node name visible as an InfoPanel hint on hover.

**Inventory section:** Scrollable grid of squares below the equipped section.

**Fusion candidates:** Glowing ring pulse animation in the tier color of the matching equipped item.

### Item detail (InfoPanel)

Hovering any item square pushes to the `hoverInfoSlice`:
- Header: `{tier} {slotKind}` (e.g. "Rare Brush")
- Body: list of affixes with magnitudes; fuse count if > 0
- Footer (fusion candidate only): "Click to fuse — costs {cost} gold"

No new tooltip/popover components. Uses the existing InfoPanel strip.

---

## Out of scope

- Affix kind weighting per slot (all slots remain generic)
- Item set bonuses
- Item trading or transfer between ascensions (items still wipe on ascend)
- Auto-fuse
