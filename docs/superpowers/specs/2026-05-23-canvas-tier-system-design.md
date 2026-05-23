# Canvas Tier System — Design

**Date:** 2026-05-23
**Status:** Approved (pending review of this spec)

## Concept

The canvas gains a tier dimension (T1, T2, T3, …) on top of its five upgrade tracks (sell_price, speed, size, crit, combo). Tier-up is a within-run prestige loop: it wipes all five tracks back to L0, scales every relevant knob by ×10 (base gold, per-level effects, upgrade costs) and ×2 (base time), and bumps the canvas tier counter. The tier is open-ended; the system has no hard cap.

Tier is independent of `sizeLevel`. The cosmetic stage name (Sketch/Apprentice/Journeyman/…) becomes tier-keyed instead of size-keyed.

## Motivation

Today the canvas system has three structural problems:

1. **"Tier" is mislabeled.** `STAGE_NAMES` in `src/components/painting/CanvasStage.tsx` is keyed by `sizeLevel` and rendered as `"Tier {sizeLevel}"`. Buying a size upgrade renames the canvas to a higher "tier," conflating two unrelated concepts.
2. **Inconsistent starting levels.** `sellPriceLevel` and `speedLevel` default to `1`. The other three tracks (size, crit, combo) default to `0`. The L1 default is arbitrary — there is no L0 in the UI and the first upgrade is labeled "Lv 1 → Lv 2."
3. **Sell-price returns flatten fast.** `sellPriceUpgradeCost(L) = 100 × 1.5^L`, effect = `+10%` additive per level. At L1 the player spends 150 g for a +9% real gold increase. At L30 the player spends ~19 M for a +2.4% real gold increase — cost-per-marginal-gain has grown ~500×. Players stop investing.

The tier system addresses all three:
- A real tier counter (independent of size) drives the cosmetic name.
- All five tracks default to `L0` under the new system.
- Per-level effects scale ×10 per tier, so a fresh tier's L1 always feels meaningful regardless of how far the player pushed the previous tier.

## State changes

Add to `CanvasState` in `src/store/canvasSlice.ts`:

```ts
canvasTier: number; // T1+, default 1, reset to 1 on ascend
```

Change defaults in `initialCanvasState`:

```ts
sellPriceLevel: 0, // was 1
speedLevel: 0,     // was 1
sizeLevel: 0,
critLevel: 0,
comboLevel: 0,
canvasTier: 1,     // new
```

## Tier-up gate and action

**Gate:** the tier-up button is enabled when `sellPriceLevel >= 15 && speedLevel >= 15` in the current tier. No gold cost. Only the two always-unlocked tracks gate the tier-up; size/crit/combo are skill-tree-locked and would otherwise make tier-up unreachable early.

**Action** — when the player presses tier-up:

1. `canvasTier += 1`
2. Reset all five tracks: `sellPriceLevel=0, speedLevel=0, sizeLevel=0, critLevel=0, comboLevel=0`
3. Reset in-canvas state: `canvasProgress=0, comboChain=0, isCritThisCanvas=false` (current canvas is forfeited, same idiom as ascend)
4. Call `evaluateAchievements()` (future "reach tier N" achievements)

The tier-up is **manual** (button-driven). The player can keep grinding the current tier after the gate opens — there is no auto-tier-up.

## Tier-scaled formulas

Define two helpers in `src/core/balance.ts`:

```ts
/** Gold/cost/per-level multiplier for tier T. tierFactor(1) = 1, (2) = 10, (3) = 100, … */
export const tierFactor = (tier: number): number => Math.pow(10, tier - 1);

/** Base-time multiplier for tier T. timeFactor(1) = 1, (2) = 2, (3) = 4, … */
export const timeFactor = (tier: number): number => Math.pow(2, tier - 1);
```

Apply across the canvas formulas:

| What | T1 | T2 | T3 | T4 |
|---|---|---|---|---|
| Base canvas gold (CANVAS_GOLD_BASE × tierFactor) | 10 | 100 | 1,000 | 10,000 |
| Base canvas time (CANVAS_TIME_BASE × timeFactor) | 10s | 20s | 40s | 80s |
| Sell price / level (SELL_PRICE_PER_LEVEL × tierFactor) | +10% | +100% | +1,000% | +10,000% |
| Speed / level (SPEED_PER_LEVEL × tierFactor) | +5% | +50% | +500% | +5,000% |
| Size / level (SIZE_PER_LEVEL × tierFactor) | +15% | +150% | +1,500% | +15,000% |
| Crit / level (CRIT_PER_LEVEL × tierFactor) | +1% | +10% | +100% (clamped) | (clamped) |
| Combo / level (COMBO_PER_LEVEL × tierFactor) | +2% | +20% | +200% (clamped) | (clamped) |
| Sell-price L1 cost (SELL_PRICE_COST_BASE × tierFactor) | 100 | 1,000 | 10,000 | 100,000 |
| Speed L1 cost (SPEED_COST_BASE × tierFactor) | 100 | 1,000 | 10,000 | 100,000 |
| Size L1 cost (SIZE_COST_BASE × tierFactor) | 1,000 | 10,000 | 100,000 | 1,000,000 |
| Crit L1 cost (CRIT_COST_BASE × tierFactor) | 5,000 | 50,000 | 500,000 | 5,000,000 |
| Combo L1 cost (COMBO_COST_BASE × tierFactor) | 5,000 | 50,000 | 500,000 | 5,000,000 |

**`CANVAS_TIME_BASE` changes from 2 to 10.** The legacy `PAINT_TIME_BASE_SECONDS = 10` constant (still imported by `tests/store/persistence-integration.test.ts:6`) becomes redundant; remove it during implementation. The single test usage is a "tick long enough to trigger a sale" pattern and can read `CANVAS_TIME_BASE` directly.

### Wire points

- `src/core/balance.ts` — `canvasGold(size, mult, tier)`, `canvasTime(size, tier)`, and the five `*UpgradeCost(level, tier)` functions all take `tier` as their last parameter and multiply by `tierFactor` / `timeFactor`. The per-level constants (`SELL_PRICE_PER_LEVEL`, etc.) stay as-is.
- `src/core/multipliers.ts` — `getCanvasGoldMultiplier`, `getCanvasSpeedMultiplier`, `getCritChance`, `getComboBaseChance`, `getCanvasSize` read `state.canvasTier` and multiply each *track contribution* by `tierFactor(state.canvasTier)` before composing with item/worker/school/achievement bonuses. Item/worker/school/achievement contributions are NOT tier-scaled (see Interactions).
- `src/core/canvasTickPure.ts` — uses the new tier-aware `canvasGold` and `canvasTime` signatures.
- `src/store/canvasSlice.ts` — `upgradeSellPrice`, `upgradeSpeed`, `upgradeSize`, `upgradeCrit`, `upgradeCombo` all read `state.canvasTier` and pass it to the matching cost function. New action `tierUp` performs the gate check and the reset.
- `src/routes/PaintingRoute.tsx` — the cost preview chips on each `TrackCard` use the tier-aware cost.

## UI changes

### Canvas stage

- `STAGE_NAMES` in `src/components/painting/CanvasStage.tsx` is rekeyed from `sizeLevel` to `canvasTier`. The current names (Sketch / Apprentice / Journeyman / Adept / Skilled / Masterpiece / Virtuoso / Master / Grandmaster / Legendary / Mythic) become the T1..T11 labels. Past T11, fall back to `"Tier {N}"`.
- The title row reads `— Tier {canvasTier} · {STAGE_NAMES[canvasTier]} —` (or `— Tier {canvasTier} —` past T11).
- The bottom-right `tierBadge` reads `Tier {canvasTier}`.
- `CanvasStage`'s `sizeLevel` prop becomes purely informational for the pixel-art aria label; replace the prop with `canvasTier` for the title/badge. Callers (`PaintingRoute.tsx`) pass both.

### Canvas upgrades strip

A new `TrackCard` for "Tier Up" lives in `src/components/painting/CanvasUpgradesStrip.tsx` (or next to the existing five). It has three visible states:

- **Locked** (initial, or after a tier-up when the gate is fresh): label "Tier Up", effect line "Reach sell_price L15 + speed L15", cost label "—", disabled.
- **Ready**: label "Tier Up", effect line `→ Tier {N+1} · ×10 base gold · ×2 paint time`, cost label "Free", enabled.
- **No max** (tier is open-ended, no terminal state).

Click handler calls the new `tierUp` action.

### Stats Room

`src/components/painting/StatsRoom.tsx` gains a Tier block at the top showing:
- Current tier and stage name
- Active tier multipliers (×N base gold, ×N upgrade costs, ×N per-level effects, ×N base time)

### Hover / tooltips

The sell-canvas hover body in `CanvasStage` already lists per-contributor breakdowns. Tier scaling is a *multiplier on contributions* — no new line is needed in the hover; the existing lines (Sell Price, Items, Workers, etc.) reflect the post-tier-multiplier values naturally. If clarity becomes a problem in playtesting, add a "Tier multiplier" row.

## Interactions

- **Ascend** resets `canvasTier` to 1 along with the five track levels. Once `canvasTier` is part of `initialCanvasState`, the existing `resetCanvas()` action covers this.
- **Skill tree unlocks** for size/crit/combo (the `canvas_size`, `canvas_crit`, `canvas_combo` capability tags from `size_matters`, `genius_episode`, `unrelentless`) carry across tiers. Unlock state is run-meta; track levels are per-tier.
- **Workshop items** are tier-agnostic. An item that grants `+20% sell_price` adds +20% to the additive bonus regardless of tier. As tiers grow, items become a baseline contribution overshadowed by tier-scaled per-level upgrades — same pattern as school bonuses and skill-tree contributions become "baseline" past mid-game.
- **Office workers** are tier-agnostic for the same reason.
- **School bonuses** are tier-agnostic.
- **Achievement bonuses** are tier-agnostic.
- **`canvasTickPure`** still applies the same combo-bonus and crit-speed math; tier only changes the inputs.
- **Catch-up simulation** is unaffected by tier — it replays gold/time accumulation at the player's current tier. Tier-up is manual, so the sim never auto-tiers-up. When the player returns and the gate is met, they tier up themselves.

## Edge cases and known limitations

- **Crit/combo past their caps.** At T2 the player softcaps crit (~3 levels) and combo (~5 levels). Past the cap, additional levels do nothing. This is acknowledged and intentional for v1 of the tier system; a future iteration will rework what crit/combo do past their existing caps at higher tiers (e.g., crit gold multiplier scaling, combo chain depth bonus, or similar). See Future work.
- **Numbers grow large.** At T10 the base canvas gold is 10 × 10^9 = 10 B; combined with size² multipliers and full upgrades, single canvases will produce values in the 10^15–10^20 range. `break_eternity.js` handles this without issue; the UI's `formatBig` already renders such magnitudes.
- **Existing canvas tests** assume base gold = 10 and base time = 2. All of them will need updates to either (a) pass an explicit tier=1 and assert against the new T1 baseline, or (b) set the canvas to T1 and use the new constants. Many will break; this is expected scope.

## Future work

- **Crit/combo at high tiers.** Rework the past-cap behavior so additional levels at higher tiers do something meaningful (own plan, deferred).
- **Tier-up cost iteration.** The v1 trigger is free-with-gate. If playtesting shows tier-up rhythm is too fast, add a gold cost that scales with tier as a second-pass tuning knob.
- **Tier-gated content.** Future tiers could unlock new canvas mechanics, new affix kinds, or new room features. Not part of this design.

## Save migration

Bump `SAVE_VERSION` from 21 to 22. Migration v21 → v22 adds:

```ts
if (fromVersion < 22) {
  // v21 → v22 (2026-05-23): canvas tier system. Existing canvases default to T1.
  // sellPriceLevel and speedLevel keep their existing values (which may be ≥1 from the old L1 default);
  // the L0 default change is only for fresh saves.
  state = {
    ...state,
    canvasTier: 1,
  };
}
```

The L0 starting-level change for `sellPriceLevel`/`speedLevel` only applies to fresh saves. Existing saves preserve their levels — players who had L20 sell_price at T1 keep L20 sell_price at T1. Their progress isn't reset.

## Testing strategy

Unit:
- `tierFactor(N)` and `timeFactor(N)` produce expected values at N=1..5
- `canvasGold(size, mult, tier)` matches the table for each tier at size=1
- `canvasTime(size, tier)` matches the table for each tier at size=1
- `sellPriceUpgradeCost(level, tier)` matches the table for L1 at each tier
- `getCanvasGoldMultiplier`, `getCanvasSpeedMultiplier`, `getCritChance`, `getComboBaseChance`, `getCanvasSize` each apply the tier multiplier to track contributions and not to item/worker/school/achievement contributions

Slice:
- `tierUp` action: rejects when gate is not met (returns false, state unchanged); on success bumps tier, resets all five levels, resets in-canvas state
- Existing canvas tests updated to match the new T1 baseline (CANVAS_TIME_BASE = 10, sellPriceLevel/speedLevel default 0)

Integration:
- A full ascend cycle resets `canvasTier` along with everything else
- Catch-up sim replays gold gain across a tier boundary correctly (the sim does NOT auto-tier-up; only the player's manual press does)

Persistence:
- v21 → v22 migration adds `canvasTier: 1` to an existing save without touching other fields
- Round-trip: a save with `canvasTier: 3` persists and reads back correctly

UI:
- TierUp `TrackCard` shows the three visible states correctly per the gate
- `STAGE_NAMES[canvasTier]` renders in the title; fallback "Tier N" past T11
- Stats Room shows the active tier multipliers
