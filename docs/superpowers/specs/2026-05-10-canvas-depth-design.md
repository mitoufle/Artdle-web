# Canvas Depth — Design Spec

**Date:** 2026-05-10
**Status:** Plan-ready (numbers TBD, spelled out in §10).
**Subproject:** 1 of 3 in the Painter's Office decomposition (this spec → affix-pool rework → Office).
**Relationship to the source spec:** A simplified replacement for `docs/specs/2026-04-25-canvas-design.md` §2–8. The source spec's RPG-quality formula (subjects, mastery, style/palette sliders, gamble, chef d'œuvre) is **dropped** in favour of a leaner 5-track upgrade panel. See §11 for what's kept vs. dropped.

---

## 1. Concept

Canvas progression today is a single integer (`canvasTier`, 1–10) bought in gold. This spec replaces that single dimension with **5 independent upgrade tracks**, each levelled in gold, two unlocked at game start and three gated by fame skill-tree nodes that the user authors via `/dev/skill-designer`.

The five tracks split today's "canvas tier" into specialized gold-output levers (sell price, speed, size) and add two new RNG-driven mechanics (crit, combo) that give late-game runs visible variance and stacking momentum.

**Critically, each track corresponds to a new affix kind.** Workshop items and Painter's Office workers will roll affixes that buff these tracks. This spec is therefore the foundation handshake with subproject 2 (affix pool rework) and subproject 3 (Painter's Office). The list of affix kinds this spec creates is in §6 — that list is the contract for subproject 2.

---

## 2. The 5 tracks

Each track is an integer level (1, 2, 3, …), uncapped, levelled by spending gold. Each level applies a fixed effect.

| Track | Effect per level | Initial state | Gating |
|---|---|---|---|
| **Sell price** | `+SELL_PRICE_PER_LEVEL` % gold per sale (additive) | L1 active from start | None |
| **Completion speed** | `+SPEED_PER_LEVEL` % canvas speed (additive) | L1 active from start | None |
| **Size** | `+SIZE_GOLD` % gold AND `+SIZE_TIME` % time, additive (gold > time net positive) | L0 (locked) | Fame skill-tree node "Unlock Size" |
| **Crit** | `+CRIT_PER_LEVEL` % crit chance | L0 (locked) | Fame skill-tree node "Unlock Crit" |
| **Combo** | `+COMBO_PER_LEVEL` % base combo chance | L0 (locked) | Fame skill-tree node "Unlock Combo" |

The `*_PER_LEVEL` constants and starting/cost curves are defined in §10 (TBD numbers, but the curves are sketched there).

**Gating mechanics.** Each gated track has a corresponding `unlock*` flag in the skill-tree state. The flag is set by purchasing the relevant fame node. While the flag is false, the track's upgrade button is rendered as a locked card (greyed-out, "Unlock via skill tree" label, click does nothing). Once flag is true, the track behaves like Sell price / Speed.

The user authors these unlock nodes themselves via the skill-tree designer; this spec only commits the engine surface (`getCanvasTrackUnlocked(state, trackId)`).

---

## 3. Track mechanics in detail

### 3.1 Sell price

Pure additive multiplier on canvas gold output. Stacks additively with other gold-multiplier sources (workshop affixes, future office worker affixes, skill-tree multipliers).

```
goldMult = 1
  + SP_PER_LEVEL × sellPriceLevel
  + Σ (workshop equipped sell_price affixes)
  + Σ (office worker sell_price affixes — once subproject 3 ships)
  + Σ (skill-tree sell-price contributions)
```

### 3.2 Completion speed

Pure additive multiplier on canvas speed (= 1/time). Stacks additively across sources, same shape as sell price. Existing `getCanvasSpeedMultiplier` is updated to read from `speedLevel` instead of derived from canvas tier.

### 3.3 Size

Adds to BOTH the gold output and the time per canvas. Each level: `+SIZE_GOLD` % gold and `+SIZE_TIME` % time. Tuned so net gold/sec is positive at every level (i.e., `SIZE_GOLD > SIZE_TIME`, typically ~2:1 ratio).

Replaces the `tier²` scaling that the old `canvasTier` system provides. Unlike old tier (capped at 10), Size is uncapped.

```
beforeMultipliers = CANVAS_GOLD_BASE × (1 + SIZE_GOLD × sizeLevel)
beforeMultipliers = CANVAS_TIME_BASE × (1 + SIZE_TIME × sizeLevel)
```

### 3.4 Crit

**RNG per canvas, evaluated at canvas start.** When a canvas begins painting, roll `rng() < critChance`. On hit, the canvas paints in `effectiveTime / 10` (= 90% faster, magnitude fixed). On miss, normal time.

```
critChance = CRIT_PER_LEVEL × critLevel
           + Σ (crit_chance affix contributions)
```

**Cap behaviour.** Crit chance does not cap at 100% in the engine. Above 100%, only one crit fires per canvas (no multi-crit in this spec). Future: skill-tree node could enable multi-crit; explicitly out of scope.

**Affix interaction.** A `+crit_chance%` affix adds additively to `critChance`. A `+crit_magnitude%` affix is **NOT in this spec** — magnitude is fixed at 90%. Subproject 2 will know not to roll crit-magnitude affixes (yet).

### 3.5 Combo

**RNG on canvas completion**, decides if next canvas chains. Mechanism:

```
On canvas completion:
  effectiveCombo = comboChance × (1 - DECAY_PER_LINK × comboChain)
  if rng() < effectiveCombo:
    comboChain += 1                  // chain extends
  else:
    comboChain = 0                   // chain breaks

On the NEXT canvas completion (gold compute):
  comboBonus = 1 + COMBO_PER_LINK × comboChain
  // Then the chain decision above is rolled BEFORE the gold pays out:
  //   1. Compute gold using comboChain from prior chain.
  //   2. Sale fires.
  //   3. Roll combo to decide whether next canvas chains.
  //   4. Update comboChain.
```

**Tuning constants.**
- `COMBO_PER_LINK` = 0.10 (= +10% gold per link)
- `DECAY_PER_LINK` = TBD (e.g., 0.05 = -5 percentage points per link). Determines self-limiting taper.

**Initial state.** `comboChain = 0` at game start, ascend, save load. Run-state.

**Affix interaction.** `+combo_chance%` is in the pool. `+combo_magnitude%` and `+combo_decay_reduction%` are **NOT in this spec** — magnitudes fixed. Subproject 2 will know.

**UI implication.** Combo chain state must be visible (current chain length, current bonus) on the canvas. Rendering: a small "🔥 chain × N (+N0%)" badge near the canvas. Resets visibly to 0 on miss.

---

## 4. Schema changes (`canvasSlice`)

### 4.1 New `CanvasState`

```typescript
export interface CanvasState {
  canvasProgress: number;              // unchanged
  sellPriceLevel: number;              // new, replaces canvasTier's "gold lever"
  speedLevel: number;                  // new, replaces canvasTier's "time lever"
  sizeLevel: number;                   // new, gated by skill tree
  critLevel: number;                   // new, gated
  comboLevel: number;                  // new, gated
  comboChain: number;                  // new, run-state, resets on miss / ascend / load
  isCritThisCanvas: boolean;           // new, set at canvas start, used by canvasTick
  lastSale: { id: number; amount: Big } | null;  // unchanged
}
```

### 4.2 Removed

- `canvasTier` field (gone).
- `MAX_TIER` and `tierUpgradeCost` from `core/balance.ts` (gone — replaced by per-track curves in §10).
- `<TierCard>` component (replaced by 5 new track-card components — §7).

### 4.3 Initial state

```typescript
export const initialCanvasState: CanvasState = Object.freeze({
  canvasProgress: 0,
  sellPriceLevel: 1,    // unlocked tracks start at level 1
  speedLevel: 1,
  sizeLevel: 0,         // gated tracks start at level 0 (locked render)
  critLevel: 0,
  comboLevel: 0,
  comboChain: 0,
  isCritThisCanvas: false,
  lastSale: null,
}) as CanvasState;
```

### 4.4 New actions

- `upgradeSellPrice()` — `if (gold ≥ cost) { gold -= cost; sellPriceLevel += 1; }`
- `upgradeSpeed()` — same shape
- `upgradeSize()` — same shape, also requires `getCanvasTrackUnlocked('size')`
- `upgradeCrit()` — same shape, gated on `getCanvasTrackUnlocked('crit')`
- `upgradeCombo()` — same shape, gated on `getCanvasTrackUnlocked('combo')`

All actions follow the existing **validate → spend → mutate** atomic guard pattern.

### 4.5 Modified `canvasTick`

The tick advances `canvasProgress` against `effectiveTime`. Now:

1. **At canvas start** (when `canvasProgress` is 0 and a new canvas begins): set `isCritThisCanvas = rng() < critChance`. This is captured at start and held for the canvas's life so the player can see the crit applied throughout.
2. **Compute effectiveTime** = `canvasTime(sizeLevel) / (speedMult × (isCritThisCanvas ? 10 : 1))`.
3. **On completion** (sale fires):
   - Compute gold: `gold = goldBase × goldMult × (1 + COMBO_PER_LINK × comboChain)` (combo bonus from prior chain state, applied before chain mutation).
   - Pay out gold + PM.
   - Roll combo: if hit, `comboChain += 1`; if miss, `comboChain = 0`.
   - Reset `canvasProgress = 0`, `isCritThisCanvas = false`. Next canvas's crit roll happens at the start of the next canvas.

---

## 5. Reset on ascend

All five track levels + `comboChain` reset to initial state on ascend:

```typescript
resetCanvas: () => set({
  ...initialCanvasState,
  // lastSale not reset (transient — already null at this point)
})
```

**Persistent meta progression** = fame skill tree only. Owning the "Unlock Crit" fame node means after ascending the Crit track is still unlocked (level 0 again, but the track is buyable). Same for Size and Combo.

This mirrors v1.0's pattern: canvas tier reset, skill tree persists.

---

## 6. Affix pool — handshake contract for subproject 2

This is the explicit list of affix kinds that subproject 2 must add to the pool to interact with the new canvas mechanics. Subproject 2 owns the rolling logic, magnitudes per tier, and class-weighting tables; this spec only commits the kinds.

### 6.1 New affix kinds (introduced by this spec)

| Affix kind | Effect | Multiplier consumer |
|---|---|---|
| `sell_price` | Adds to `goldMult` | `getCanvasGoldMultiplier(state)` |
| `speed` | Adds to `speedMult` | `getCanvasSpeedMultiplier(state)` |
| `crit_chance` | Adds to `critChance` | new `getCritChance(state)` |
| `combo_chance` | Adds to `comboChance` | new `getComboBaseChance(state)` |
| `size_gold_per_level` | Multiplies the per-level gold bonus from sizeLevel | `getSizeGoldPerLevelMultiplier(state)` |

### 6.2 Renamed / continued affix kinds

| Old kind | New name | Reason |
|---|---|---|
| `canvas_gold` | `sell_price` | Direct mapping to the new track |
| `paint_time` | `speed` | Inverted semantics (time → speed); subproject 2 handles the migration |

### 6.3 Affix kinds explicitly NOT introduced

These are reserved for future waves; subproject 2 should NOT roll them:
- `crit_magnitude` (magnitude fixed at 10× this spec)
- `combo_magnitude` (fixed at +10% per link)
- `combo_decay_reduction` (decay is a tuning constant)
- `size_time_per_level` (time cost of size is fixed)

### 6.4 Existing affix kinds unchanged

- `paint_mastery_gain` — continues to multiply PM gain. No change.

### 6.5 Migration handshake

Subproject 2's plan includes:
- `AffixKind` enum: rename `canvas_gold` → `sell_price`, rename `paint_time` → `speed`, add `crit_chance`, `combo_chance`, `size_gold_per_level`.
- Save migration (`SAVE_VERSION` bump): walk inventory + equipped items, rename old kinds to new, and drop any unrecognised kinds.
- `multipliers.ts` updated to consume the new kinds.

---

## 7. UI

### 7.1 Layout

The existing `<CanvasUpgradesStrip>` is already a 5-cell horizontal grid (`v2.0` shipped 1 filled cell + 4 empty placeholders). This spec fills all 5 cells.

Cell order, left to right:

1. `<SellPriceCard>` — always rendered (always unlocked)
2. `<SpeedCard>` — always rendered
3. `<SizeCard>` — rendered locked or active depending on `getCanvasTrackUnlocked('size')`
4. `<CritCard>` — same, `'crit'`
5. `<ComboCard>` — same, `'combo'`

### 7.2 Card anatomy (single component, parameterised)

```
┌──────────────────────────┐
│ [Icon]  TRACK NAME       │
│                          │
│ Level: N → N+1           │
│ Effect: +X.X% [stat]     │
│                          │
│ [Upgrade — Y g]          │
│ (or "Locked — fame tree" │
│  in locked state)        │
└──────────────────────────┘
```

Single shared `<TrackCard>` component takes `{ trackId, locked }` props. Reads level / cost / effect / unlock state from store via selectors. Hover info on the card surfaces the stat, the per-level effect formula, the next-level cost, and (when relevant) current contribution from affixes.

### 7.3 Combo chain badge on the canvas

`<CanvasStage>` gains a small badge in a corner showing chain state:

```
🔥 ×N    +N×10% gold
```

Hidden when `comboChain == 0`. Animates a quick pulse on chain extension; shake-and-fade on chain break.

### 7.4 Crit indicator on the canvas

When `isCritThisCanvas` is true, `<CanvasStage>` shows a "CRIT" badge / glow effect for the duration of the canvas. Visual treatment TBD; functional contract is: visible to player throughout the crit canvas.

---

## 8. Save migration

`SAVE_VERSION` bump (current is v9 per HANDOVER → v10).

Migration v9 → v10:

```
For each persisted save with version 9:
  - Drop canvasTier (don't translate — tier 1-10 doesn't map cleanly to the new 5 tracks).
  - Add sellPriceLevel = 1, speedLevel = 1.
  - Add sizeLevel = 0, critLevel = 0, comboLevel = 0.
  - Add comboChain = 0, isCritThisCanvas = false.
  - For workshop inventory + equipped items: walk affixes:
      - Rename canvas_gold → sell_price
      - Rename paint_time → speed
  - (Subproject 2's affix-pool rework adds further migration in v11.)
```

Acknowledgement: dropping tier 1-10 means players who happened to be at tier 8 lose 7 levels of progression. Game is unreleased; no real player cost. If we ship before subproject 2, the migration also strips items with affixes that don't exist post-rename — also acceptable pre-release.

---

## 9. Test surface

Vitest tests for `core/balance.ts` formulas:
- Per-level effect of each track (parameterised cases for L1, L10, L100).
- Cost curve monotonic + matches table values.
- Combo gold-bonus formula (chain × COMBO_PER_LINK).
- Decay-per-link applied to comboChance.
- Crit RNG seeded test — fixed seed produces expected hit/miss sequence.
- Combo RNG seeded test — same.

`canvasSlice` tests:
- Each `upgrade*` action: validate → spend → mutate atomicity (gold check, lock check, level increment).
- Locked tracks: action no-ops with no gold spend.
- `canvasTick` behaviour with crit hit (effective time / 10).
- `canvasTick` behaviour with combo chain (gold × (1 + chain × 0.1)).
- Combo chain mutation on completion: hit increments, miss resets.
- `resetCanvas` restores `initialCanvasState` (all five levels + chain).

Save migration tests:
- v9 → v10 round-trip: tier dropped, new fields default, affix kinds renamed.
- v9 → v10 with each pre-existing affix kind covered.

Target ~30 new Vitest tests (~658 total, currently 628).

---

## 10. TBDs (numbers)

These are spec-level TBDs, not subproject blockers. They're set during the implementation plan or in the first impl task.

| # | TBD | Notes |
|---|---|---|
| 10.1 | `SELL_PRICE_PER_LEVEL` | Probably 5–10% per level |
| 10.2 | `SPEED_PER_LEVEL` | Probably 2–5% per level |
| 10.3 | `SIZE_GOLD`, `SIZE_TIME` | Ratio ~2:1 net positive; e.g., +20% gold / +10% time per level |
| 10.4 | `CRIT_PER_LEVEL` | Probably 0.5–1% chance per level. L20 → 10–20% chance |
| 10.5 | `COMBO_PER_LEVEL` | Probably 1–2% chance per level. L20 → 20–40% base chance |
| 10.6 | `DECAY_PER_LINK` | E.g., 0.05 (-5 percentage points per link). Tunes self-limiting taper |
| 10.7 | Cost curves per track | Probably exponential, tuned so each track at L1→L20 costs comparable to today's tier 1→10 chain |
| 10.8 | Crit chance soft cap behaviour | Above 100%: clamp at 100%? Allow multi-crit? **This spec: clamp at 100%, multi-crit deferred.** |
| 10.9 | Where in the gold formula combo bonus applies | Outermost (after all affixes), or within the additive multiplier? **This spec: outermost (multiplicative on the post-affix gold).** Tunable later |
| 10.10 | Initial cost of L1→L2 for each track | Anchors the early-game pacing |

The numbers should be chosen so the game feels good without playtest, then tuned by smoke-test in browser.

---

## 11. What's kept vs. dropped from the source spec

The source `2026-04-25-canvas-design.md` was a much richer RPG-quality system. This spec replaces it. Below: what survives, in what form, and what is dropped.

| Source-spec mechanic | This spec |
|---|---|
| Quality formula (`tier + style + palette + mastery + floor`) | **DROPPED** — quality replaced by direct gold output |
| Style + palette discrete sliders | **DROPPED** — replaced by leveled tracks |
| Subjects (5 starter + 15 derived) | **DROPPED** — no subjects |
| Mastery (per-subject XP, 10 tiers, exponential) | **DROPPED** |
| Inspiration gamble (off / 10 / 100 / 1k / 10k) | **DROPPED** |
| Chef d'œuvre RNG quality override | **REPLACED** by Crit (different mechanic — speed-crit not quality-crit) |
| Multi-canvas | **DROPPED** (already deferred per Office sketch §1) |
| Item drops on canvas completion | **DROPPED** (source spec §11 already marked obsolete) |
| 17-node Canvas branch on skill tree | **REPLACED** by ~3 unlock nodes (Size / Crit / Combo unlock), authored by the user via `/dev/skill-designer` |
| Improvement tab `CanvasPopup` with cost curves | **REPLACED** by 5 inline cards in `<CanvasUpgradesStrip>` (no popup) |
| Configuration tab (sticky settings) | **N/A** — no sticky settings exist |
| Existing `canvasTier` (1-10) | **REPLACED** by Size (uncapped) + the other 4 tracks |

The spirit of the source spec — *"the canvas is a multi-axis system whose axes hook the affix pool"* — is preserved. The execution is leaner.

---

## 12. Out of scope (this spec)

- Multi-canvas / parallel slots (deferred indefinitely).
- Canvas drops (obsolete).
- Subjects, mastery, style, palette, gamble, chef d'œuvre, quality formula.
- Multi-crit (`critChance > 100%`).
- Combo magnitude / decay scaling via affixes (kinds reserved §6.3).
- Painter's Office worker affixes (subproject 3).

---

## 13. Engine surface (for plan author)

For the writing-plans skill to consume:

- **Slice changes**: `src/store/canvasSlice.ts` — replace tier with 5 levels + chain + crit flag; add 5 upgrade actions; modify `canvasTick`.
- **Balance**: `src/core/balance.ts` — new per-track formulas, drop `canvasTime(tier)`/`canvasGold(tier)` shapes (replace with `canvasGold(sizeLevel)`/`canvasTime(sizeLevel)` and add per-track effect functions).
- **Multipliers**: `src/core/multipliers.ts` — new `getCritChance(state)`, `getComboBaseChance(state)`, modify `getCanvasGoldMultiplier(state)` to consume `sellPriceLevel`, modify `getCanvasSpeedMultiplier(state)` to consume `speedLevel`.
- **RNG**: `src/core/rng.ts` already exists for workshop affix rolls — reuse for crit + combo. Document seeding policy (per-canvas seed? per-tick? user-call: shared with workshop's existing pattern).
- **Selectors**: `src/store/skillTreeSlice.ts` — add `getCanvasTrackUnlocked(state, trackId: 'size' | 'crit' | 'combo'): boolean`. Reads from `purchasedNodes` lookup against well-known node IDs (TBD which node ID maps to which track — user designs).
- **UI**: replace `src/components/painting/TierCard.tsx` with a parameterised `<TrackCard>` and 5 instances. Modify `<CanvasStage>` to render combo + crit badges. Update `PaintingRoute.tsx` accordingly.
- **Ascend orchestrator**: `src/systems/ascend.ts` — `resetCanvas()` reads new `initialCanvasState`. No change to orchestration order.
- **Save migration**: `src/systems/persistence.ts` — `migrate` adds v9→v10 case (drop tier, add new fields, rename affix kinds inline).
- **Skill-tree config**: no engine change required — the user will author the unlock nodes via `/dev/skill-designer`. Provide guidance in HANDOVER post-merge that 3 well-known node IDs (`unlock_canvas_size`, `unlock_canvas_crit`, `unlock_canvas_combo`) are the engine-recognised IDs to wire up.

---

## 14. Definition of done

- All 5 tracks levellable in gold, with locked-state UI for gated tracks.
- Sell price + Speed unlocked from L1, immediately upgradable.
- Size + Crit + Combo unlock states drive UI lock + action no-op until skill-tree node owned.
- Combo chain visible on `<CanvasStage>`, updates in real time.
- Crit visible on `<CanvasStage>` for the duration of the crit canvas.
- All formulas tested in Vitest with parameterised cases.
- Save migration v9 → v10 round-trip tested.
- Affix kinds list (§6) communicated to subproject 2 in its spec.
- `tsc -b --noEmit` clean. `npm run lint` clean (only pre-existing warning). `npm test` 658+/658+ passing.
- `npm run build` bundle still under 250 KB gzipped.

---

## 15. Next subproject

After this lands: subproject 2 (affix pool rework) consumes the §6 list and rolls forward `AffixKind` + multipliers + workshop affix rolling. Then subproject 3 (Painter's Office, sketched in `2026-05-10-painters-office-design.md`) ships on top.
