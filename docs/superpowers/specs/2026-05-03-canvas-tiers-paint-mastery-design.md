# v1.1 — Canvas Tiers + Paint Mastery — Design Spec

**Date:** 2026-05-03
**Status:** Draft for review
**Wave:** v1.1 (per `docs/PORT_PLAN.md` §2.1)
**Source of truth:** `docs/specs/2026-04-25-canvas-design.md` §3 + §6, `docs/specs/2026-04-24-artdle-rescope-design.md` §7
**Supersedes:** none

---

## 1. Context

v1.0 shipped the minimum playable loop (tag `v1.0`, 276 tests). The canvas is a single fixed-time slot that sells for a flat 10g base, modified by two workshop affixes and one skill tree node. There is no progression axis on the canvas itself.

This wave adds the first two pieces of the canvas-design spec: **tier scaling** (the canvas climbs through 10 levels of richness) and **paint mastery** (a permanent currency that compounds across runs). Together they create the v1.1 between-runs progression: each ascend, you've earned more PM, so the next run is richer.

**Wave-roadmap context** (from `docs/PORT_PLAN.md` §2.1, deferred to later waves):

- v1.2 — subjects + per-subject mastery
- v1.3 — quality, style, palette, gamble, chef d'œuvre RNG
- v1.4 — multi-canvas + Canvas-branch skill tree (17 nodes)
- v1.5+ — Workshop expansion
- v2.0 — Painter's Office (RPG redesign), offline progress

This spec stays inside the v1.1 boundary. Hooks for v1.2-1.4 are noted where they affect v1.1 shape.

---

## 2. Scope (strict)

In:

- 10 canvas tiers (`taille`)
- Tier-upgrade UI on `PaintingView` (gold cost, click-to-upgrade)
- Paint Mastery as a fourth currency (permanent, persists across ascends)
- Paint Mastery log-curve multiplier on canvas gold output
- Save migration v2 → v3
- ~25 new Vitest tests

Explicitly out (preserved as-is from v1.0; deferred per PORT_PLAN):

- Quality / style / palette / mastery / floor (v1.3)
- Subjects (v1.2)
- Multi-canvas / parallel slots / Painter Office workers (v1.4 / v2.0)
- Chef d'œuvre / gamble / item drops (v1.3 / v1.5)
- Canvas-branch skill tree expansion (v1.4)
- Workshop affix expansion (v1.5)
- New skill-tree nodes for v1.0's 5-chain
- Tree-stage expansion
- CanvasPopup tab structure (v1.3 when there is real configuration to host)

---

## 3. Architecture

### 3.1 State shape

Two new persisted fields:

| Field | Slice | Type | Default | Reset on ascend? | Persisted? |
|---|---|---|---|---|---|
| `canvasTier` | `canvasSlice` | `number` (integer 1..10) | `1` | **yes** (back to 1) | yes |
| `paintMastery` | new `paintMasterySlice` | `Big` | `big(0)` | **no** (permanent) | yes |

`paintMasterySlice` is its own slice (not folded into `canvasSlice`) because PM is permanent meta-progression while canvas state is per-run; opposite reset semantics belong on opposite sides of the partition. Same architectural rationale as why `metaSlice.ascendCount` doesn't live in `ascendSlice`.

### 3.2 No structural changes to

- `tickLoop`, `lifecycle`, `persistence` adapter, `metaSlice`
- `treeSlice`, `workshopSlice`, `skillTreeSlice`, `ascendSlice`, `currencySlice`, `hoverInfoSlice`, `uiSlice`, `viewSlice`

`src/systems/ascend.ts` gets two declarative-list edits (one new field added to the preserved list, one new field added to the reset list — see §5.4); the orchestrator's pattern is unchanged. `canvasSlice` and `src/store/index.ts` get the largest edits (tier field + action; new slice composition + migration). The change footprint is intentionally tight: no new infrastructure, only data flowing through existing channels.

---

## 4. Formulas

All formulas live in `src/core/balance.ts`. Every formula has a Vitest test in `tests/core/balance.test.ts`. This is project discipline (CLAUDE.md, PORT_PLAN §5.12).

### 4.1 Canvas gold per sale

```ts
canvasGold(tier: number, mult: Big): Big
  = big(10).mul(tier).mul(tier).mul(mult)
```

`mult` is the product of all multiplicative bonuses: `pmMult * canvasGoldMult * skillTreeGoldMult`.

`tier²` substitutes for the `quality × tier` shape from `canvas-design.md` §6.3 by setting `quality = tier`. When v1.3 lands the real quality system, the formula becomes `big(10).mul(quality).mul(tier).mul(mult)` — a one-line variable swap, no architectural change.

### 4.2 Canvas paint time per sale

```ts
canvasTime(tier: number): number    // seconds
  = tier * 2
```

Tier 1 = 2s, tier 5 = 10s (matches v1.0's `PAINT_TIME_BASE_SECONDS`), tier 10 = 20s.

This is `canvas-design.md` §6.5's stripped form (`(tier * 2 + style * 1)` with style → 0). v1.3 adds the style term.

The constant `PAINT_TIME_BASE_SECONDS = 10` from v1.0 is removed in v1.1; `canvasTime(tier)` replaces it everywhere.

### 4.3 Tier upgrade cost

```ts
TIER_UPGRADE_BASE = 100
TIER_UPGRADE_RATIO = 2.78
MAX_TIER = 10

tierUpgradeCost(currentTier: number): Big
  = big(TIER_UPGRADE_BASE).mul(big(TIER_UPGRADE_RATIO).pow(currentTier - 1))
```

`tierUpgradeCost(N)` is the gold cost to upgrade **from tier N to tier N+1**. Defined for `currentTier ∈ [1, 9]`; tier 10 has no upgrade. UI guards on `tier < MAX_TIER`.

Calibration (per `canvas-design.md` §10: "100 → 1M g across 10 tiers"):

| From tier | Cost (g) |
|---|---|
| 1 | 100 |
| 2 | 278 |
| 3 | 774 |
| 4 | 2,151 |
| 5 | 5,983 |
| 6 | 16,634 |
| 7 | 46,250 |
| 8 | 128,575 |
| 9 | 357,439 |
| **Total path 1→10** | **~558,184 g** |

Calibrated so T1→T2 happens early in run 1 (well below the 1k inspi palier); the full path is multi-ascend territory.

### 4.4 Paint mastery gain per sale

```ts
pmGainPerSale(tier: number): Big
  = big(tier).mul(tier)         // tier² ; equivalently grossGold / 10
```

This is computed on **gross tier-derived gold** (pre-multiplier), not the post-multiplier sale amount. Two reasons:

1. **No PM-gold feedback loop.** If PM gain depended on actual gold credited, then `gold ↑ → PM ↑ → pmMult ↑ → gold ↑` would feed back on itself. Using gross output keeps PM growth purely a function of tier (and v1.3+ of quality).
2. **Future-proof shape.** When v1.3 ships quality (`gold = quality × tier × 10`), `pmGainPerSale` becomes `quality × tier`. The "PM gain = grossGold / 10" framing is preserved across waves.

Returned as `Big` even though the v1.1 numeric values are small, because `paintMastery` is `Big` and gains accumulate via `Big.add`.

### 4.5 Paint mastery multiplier

```ts
PM_LOG_FACTOR = 5.0

pmMult(pm: Big): Big
  = big(1).add(big(PM_LOG_FACTOR).mul(big(Math.log10(pm.toNumber() + 1))))
```

At PM = 0, `log10(1) = 0`, so `pmMult = 1` (exact). For Big PM beyond `Number.MAX_SAFE_INTEGER`, `pm.toNumber()` saturates but `log10` of saturated values still produces a valid magnitude — break_eternity's design intent. The PM mult is always a small Big-wrapped float (~1 to ~50 range in v1.1 reachability).

Curve at factor 5.0:

| PM | pmMult |
|---|---|
| 0 | 1.0 |
| 10 | ~6.2 |
| 100 | ~11.0 |
| 1,000 | ~16.0 |
| 10,000 | ~21.0 |
| 100,000 | ~26.0 |
| 1,000,000 | ~31.0 |
| 1,000,000,000 | ~46.0 |
| 10,000,000,000 | ~51.0 |

The "approaches but never reaches" `pas ×1000` ceiling that the rescope spec called for is preserved by the log shape, even at factor 5.0.

### 4.6 Full canvas gold formula at sale

```ts
const goldMult = pmMult(paintMastery)
                   .mul(canvasGoldMult(equipped, skillTree))
                   .mul(skillTreeGoldMult)        // existing Goldsmith node
const sale = canvasGold(canvasTier, goldMult)
```

Multiplier ordering doesn't matter (all multiplicative). PM mult composes with the existing `+canvas_gold%` workshop affix and the existing Goldsmith skill-tree node identically.

---

## 5. State machine + tick changes

### 5.1 `canvasSlice.tick(delta)`

Existing v1.0 behavior: progress timer advances `delta` seconds; on completion, sells, credits gold, restarts.

Two changes:

1. **Completion duration:** `canvasTime(tier)` replaces the constant `PAINT_TIME_BASE_SECONDS = 10`. The `paint_time` multiplier (from `-paint_time%` workshop affix) continues to scale this value.
2. **Sale path:** after gold credit, call `paintMasterySlice.gainFromSale(tier)`. The PM increment uses the **same `tier`** that drove the just-completed canvas, regardless of any tier upgrades that may have happened mid-paint. (In v1.1, mid-paint upgrades shouldn't be a concern — single canvas, atomic upgrade — but the rule is unambiguous.)

`lastSale.amount` (used by the floating-gold-text widget) remains the post-multiplier gold credit, unchanged.

### 5.2 `canvasSlice.upgradeTier()` action

New atomic guard-spend-mutate action (per Phase-3 lesson #10 from HANDOVER):

```ts
upgradeTier: () => {
  const state = get()
  if (state.canvasTier >= MAX_TIER) return
  const cost = tierUpgradeCost(state.canvasTier)
  if (state.gold.lt(cost)) return
  set({
    gold: state.gold.sub(cost),
    canvasTier: state.canvasTier + 1,
  })
}
```

No partial state. No race window between gold check and tier mutation.

### 5.3 `paintMasterySlice` API

```ts
interface PaintMasterySlice {
  paintMastery: Big
  gainFromSale: (tier: number) => void   // additive: paintMastery += pmGainPerSale(tier)
}
```

That's the entire API. No `setPaintMastery`, no `resetPaintMastery` — neither is needed; ascend doesn't reset PM, and there's no other call site.

### 5.4 Ascend orchestrator

`src/systems/ascend.ts` already preserves a declarative list (`fame`, `ascendCount`, `purchasedSkillNodes`, `playerId`). Add `paintMastery` to that list. `canvasTier` resets to 1 (added to the reset list alongside `gold`, `inspiration`, tree, canvas progress, equipped item).

---

## 6. Save migration v2 → v3

### 6.1 Trigger

`SAVE_VERSION` bumps from `2` to `3`. v2 saves get migrated on rehydration; v3+ saves load directly.

### 6.2 Migration function

```ts
function migrateV2toV3(state: Record<string, unknown>): Record<string, unknown> {
  state.canvasTier = 1
  state.paintMastery = serializeBig(big(0))   // serialized form, since migration runs before deserialization
  return state
}
```

Existing v2 saves load with `canvasTier = 1, paintMastery = 0` — equivalent to v1.0 behavior, no progress lost. Tests confirm a v2 save with non-zero gold/inspi/fame/skillNodes loads cleanly into a v3 store with all v2 progress intact plus the v1.1 defaults.

### 6.3 Migration chain integrity

The `migrate(persisted, fromVersion)` function in `src/store/index.ts` runs migrations in sequence. After v1.1:

```ts
if (fromVersion < 2) state = migrateV1toV2(state)   // existing
if (fromVersion < 3) state = migrateV2toV3(state)   // new
```

Each migration is idempotent on its own version range (running v2→v3 on a v3 save is a no-op because v3 saves never enter that branch).

### 6.4 Big serialization

`paintMastery: Big` lives in the persisted partial. Existing `serializeBigs` walker (handling `__big` markers) covers it without code change as long as the field is in the slice's serializable shape — which it is, since the slice only exposes `paintMastery: Big` and the `gainFromSale` action (actions are not partialized).

---

## 7. UI

### 7.1 `<TierUpgradeButton>` on `PaintingView`

New component, mounted next to the canvas progress strip on `PaintingView`.

**Visible label:**
- When `tier < MAX_TIER`: `⬆ Tier {tier + 1} — {format(cost)} g`
- When `tier === MAX_TIER`: `Tier MAX`

**State:**
- Disabled when `gold.lt(tierUpgradeCost(tier))` OR `tier === MAX_TIER`
- Enabled when both checks pass

**On click:** `useGameStore.getState().upgradeTier()`. Action is the no-op if the guard fails (defense-in-depth; UI shouldn't allow clicking when disabled, but the action is the source of truth).

**Hover (`<Hoverable>`)** — bodies use the factory-callback pattern (Phase 5 lesson #24) so values stay live:

| Field | Body content |
|---|---|
| Title | `"Upgrade canvas tier"` (or `"Maximum tier reached"` at T10) |
| Body lines | Current tier: `gold/sale = {currentGold}`, `time/sale = {currentTime}s`, `pm/sale = {currentPm}`. Next tier: deltas — `+{Δgold} gold/sale`, `+{Δtime}s time/sale`, `+{Δpm} pm/sale`. |
| Footer | `"Cost: {cost} g"` (or `"Tier 10 — no further upgrades in v1.1"` at MAX) |

### 7.2 `<BottomBar>` — gains a 4th currency

Currently 3 widgets (gold / inspi / fame). v1.1 adds **PM** as the 4th `<CurrencyDisplay>`.

- **Iconography (v1.1 decision):** PM widget renders **text-only** as `"PM {value}"` — no icon. Rationale: no PM art asset exists yet, and bikeshedding a placeholder glyph isn't a v1.1 deliverable. `<CurrencyDisplay>` accepts an optional `icon` prop; PM passes `undefined`. Icon rolls in via a later patch when an asset is sourced (low-priority follow-up; no spec rev needed).
- **Pulse on increment:** same CSS-keyframe + `data-pulsing` attribute pattern as fame (Phase 6a lesson #33). Pulse fires on each PM gain (every canvas sale at tier ≥ 1, so frequent — verify in playtest the pulse rate isn't distracting; flagged in §11.2).

### 7.3 PM concept hover entry

The PM widget wraps in `<Hoverable>` with concept content:

| Field | Content |
|---|---|
| Title | `"Paint mastery"` |
| Body | `"Permanent painting mastery. Multiplies all canvas gold by 1 + 5 × log10(pm + 1). Survives ascends."` + live line `"Current multiplier: ×{pmMult.toFixed(2)}"` |
| Footer | `"Earned per canvas sale: tier² PM."` |

### 7.4 Canvas progress hover — one extra line

If the canvas progress strip already wraps in a `<Hoverable>` (per the v1.0 invariant that every interactive element does), append one body line: `"PM mult: ×{pmMult.toFixed(2)}"`. If the canvas progress is not currently hover-wrapped, add a `<Hoverable>` to it as part of the v1.1 work — the canvas is the central interaction surface and should explain its PM contribution at the point of action, not only on the bottom bar.

### 7.5 Floating gold text — unchanged

`<FloatingGoldText>` continues to show `+Ng` only. No `+P PM` floater (PM increments fire 0.5–5 times per second at high tiers; floating-text spam would be visual noise). The PM widget's pulse handles per-sale feedback.

### 7.6 No new view, no new popup

`PaintingView` gets one new control (the tier button). No new view, no new popup. CanvasPopup tabs (`canvas-design.md` §13) wait for v1.3 when there's actual configuration to host.

---

## 8. Hover info contracts

Per `docs/specs/2026-04-25-info-panel-design.md` §6, every interactive element wraps in `<Hoverable>` with title / body / footer. Bodies use factory callbacks for live values.

| Element | Title | Body | Footer |
|---|---|---|---|
| Tier upgrade button (T<10) | `Upgrade canvas tier` | current vs next tier deltas (gold/time/pm) | `Cost: {cost} g` |
| Tier upgrade button (T=10) | `Maximum tier reached` | `Canvas at tier 10. No further upgrades in v1.1.` | (none) |
| PM currency widget | `Paint mastery` | concept + current value + `Current multiplier: ×{pmMult}` | `Earned per canvas sale: tier² PM.` |
| Canvas progress (existing) | (existing) | (existing + new line) `PM mult: ×{pmMult}` | (existing) |

---

## 9. Tests

Target: ~25 new tests, all Vitest. Total project-wide should reach ~300 passing.

### 9.1 `tests/core/balance.test.ts` — new tests

- `canvasGold(1, big(1)) === big(10)`
- `canvasGold(5, big(1)) === big(250)`
- `canvasGold(10, big(1)) === big(1000)`
- `canvasGold(10, big(2)) === big(2000)` (mult composition)
- `canvasTime(1) === 2`, `canvasTime(5) === 10`, `canvasTime(10) === 20`
- `tierUpgradeCost(1) === big(100)` exact
- `tierUpgradeCost(5)` toBeCloseTo `5983` (Big.pow drift)
- `tierUpgradeCost(9)` toBeCloseTo `357439`
- `pmGainPerSale(1) === big(1)`, `pmGainPerSale(5) === big(25)`, `pmGainPerSale(10) === big(100)`
- `pmMult(big(0)) === big(1)` exact
- `pmMult(big(100))` toBeCloseTo `11.0`
- `pmMult(big(1_000_000))` toBeCloseTo `31.0`
- `pmMult(big(1e10))` toBeCloseTo `51.0`

### 9.2 `tests/store/canvasSlice.test.ts` — extensions

- `canvasTier` initializes to 1
- `upgradeTier()` with sufficient gold: tier increments, gold decrements by `tierUpgradeCost`
- `upgradeTier()` with insufficient gold: no-op, state unchanged
- `upgradeTier()` at tier 10: no-op, state unchanged
- `tick()` completion duration is `canvasTime(tier)` for tier 1, 5, 10 (driven by setting tier and counting ticks)
- Sale credits `gold = canvasGold(tier, computedMult)` end-to-end
- Sale calls `paintMasterySlice.gainFromSale(tier)` once per sale

### 9.3 `tests/store/paintMasterySlice.test.ts` — new file

- Initial `paintMastery === big(0)`
- `gainFromSale(1)` adds `big(1)` to `paintMastery`
- `gainFromSale(10)` from `big(0)` produces `paintMastery === big(100)`
- Repeated `gainFromSale` accumulates correctly
- Selector for `pmMult` returns `big(1)` at PM=0
- Selector for `pmMult` returns `≈11` at PM=100

### 9.4 `tests/systems/ascend.test.ts` — extension

- After `performAscend()`: `canvasTier === 1`
- After `performAscend()`: `paintMastery` value is unchanged from pre-ascend
- A multi-ascend sequence preserves PM additively (run 1 PM=10, ascend, run 2 PM grows from 10)

### 9.5 `tests/store/persistence.test.ts` — extension

- v2 save (no `canvasTier`, no `paintMastery` keys) → migrate → v3 state has `canvasTier === 1`, `paintMastery === big(0)`
- v2 save with non-zero gold/inspi/fame/skillNodes round-trips through migration with all v2 progress preserved
- v3 save with non-default `canvasTier === 7` and `paintMastery === big(12345)` round-trips exactly (Big serialization works through `__big` markers)
- The `migrate` chain is idempotent: running it on a v3 save returns the v3 save unchanged

### 9.6 `tests/ui/PaintingView.test.tsx` — extension

- Tier upgrade button renders with current tier+1 label and current cost
- Click dispatches `upgradeTier` action (mock store / spy on action)
- Disabled when gold < cost
- Disabled at tier 10 with "Tier MAX" label

### 9.7 `tests/ui/BottomBar.test.tsx` — extension

- Renders 4 currency widgets (was 3)
- PM widget shows current PM value formatted
- PM widget Hoverable produces concept entry on hover

---

## 10. Definition of done — v1.1.0

A v1.1 ship gate, not a v1.1.x patch gate.

1. All formulas in `balance.ts` with passing tests (§9.1).
2. `canvasSlice.canvasTier` field works: initializes to 1, upgrades via action with gold guard, resets to 1 on ascend, paint time uses `canvasTime(tier)`.
3. `paintMasterySlice` works: gains `tier²` per sale, persists across ascend, persists across save/load round-trip.
4. PM multiplier applied to canvas gold sales end-to-end (sale amount = `canvasGold(tier, pmMult × goldMults)`).
5. PaintingView has a working `<TierUpgradeButton>` with hover info and proper disabled states.
6. BottomBar renders 4 currency widgets; PM widget pulses on increment with same pattern as fame.
7. Save migration v2 → v3 exercised by unit test + integration test.
8. Existing 276 tests still pass; ~25 new tests; total ~300 passing.
9. Manual smoke check: fresh save → reach T2 → verify PM increments → ascend → verify `tier === 1`, PM unchanged → continue run → verify PM mult applied correctly to second-run gold.
10. Bundle still under 250 KB gzipped.
11. `tsc -b --noEmit` clean. `eslint` clean (zero new warnings).

---

## 11. Risks & flagged-for-review

### 11.1 Steep first-ascend power curve

With `PM_LOG_FACTOR = 5.0`, even modest PM totals give large multipliers. A first run that earns 60 PM (tier 1, ~60 sales at +1 PM/sale) gives second-run pmMult ≈ ×9.9. That's an aggressive ramp by traditional idle-game standards but matches the user's "PM should never feel capped" intent. **Flag for v1.1 balance pass:** if real play surfaces "second run trivializes everything", drop factor to 2.0–3.0 in a v1.1.x patch. The factor is a single constant in `balance.ts`.

### 11.2 PM widget pulse rate

At tier 10, PM increments fire every 2 seconds (one pulse per sale). At v1.4 multi-canvas time, with 8 slots, that's potentially 4 pulses/second. **Flag:** if pulse rate becomes distracting in v1.4, debounce or batch pulses across slots. v1.1 has a single canvas, so the pulse rate is bounded.

### 11.3 Saturation of `pm.toNumber()` in `pmMult`

For PM values beyond `Number.MAX_SAFE_INTEGER` (~9e15), `pm.toNumber()` saturates. `log10(saturated)` still produces a valid magnitude, and Big arithmetic handles `pmMult` correctly downstream. v1.1 reachability is well under saturation territory. **Flag:** the saturation behavior is technically correct but not ideal — a future v2.x refactor could replace `Math.log10(pm.toNumber())` with a Big-native logarithm. Not v1.1's problem; documented for future-you.

### 11.4 PM/sec scales linearly with tier (verified)

Combining `pmGainPerSale = tier²` with `canvasTime = tier × 2` gives PM/sec = `tier² / (2 × tier) = tier / 2`. So tier 1 = 0.5 PM/sec, tier 10 = 5 PM/sec — ×10 across the tier range. This is the intended behavior (every tier upgrade visibly accelerates PM accumulation, not just gold output). An earlier scoping iteration that proposed `pm += tier` would have given a flat 0.5 PM/sec across all tiers; the `tier²` shape adopted here corrects that. The constancy-vs-linearity claim is testable via the `canvasTime` and `pmGainPerSale` unit tests in §9.1.

### 11.5 No `paint_mastery_gain%` workshop affix in v1.1

Workshop affix expansion is v1.5. PM gain in v1.1 is purely tier-driven; no items can boost it. The `pmGainPerSale(tier)` shape leaves room for a future multiplier (`pm += tier² × pmGainMult`) when v1.5 lands.

---

## 12. Hooks for future waves (no v1.1 work — preserved here so future-you sees them)

- **v1.2 subjects:** `pmGainPerSale` becomes `pm += quality × tier × subjectMult` once subjects are tracked. Existing call site (`paintMasterySlice.gainFromSale`) takes one extra parameter.
- **v1.3 quality:** `canvasGold(tier, mult)` becomes `canvasGold(quality, tier, mult)`. Single signature change in `balance.ts`; one call site in `canvasSlice`.
- **v1.4 multi-canvas:** each canvas slot calls `gainFromSale(tier)` independently; `paintMasterySlice` already supports this (commutative additive Big op).
- **v1.5 workshop affix `+pm_gain%`:** added to `mult` in `pmGainPerSale(tier, mult)`.
- **v1.4 Canvas-branch skill tree:** 17 new fame-purchasable nodes including "Quality floor +2" — those plug into v1.3's quality formula, not v1.1's tier formula. v1.1 needs no skill-tree changes.

---

## 13. Out of scope (firmly)

- Mobile-first design, multiplayer, French language (permanently out per CLAUDE.md).
- Painter's Office, Painting School, Expositions, audio, achievements (deferred per PORT_PLAN §13).
- Offline progress / 24h catch-up (v2.0).
- Skill-tree expansion (v1.4 / per-wave).
- Tree-stage expansion (future waves).
- New workshop affixes (v1.5).
- `+inspiration_rate%` PM-mult-on-tree (out of scope; PM is canvas-only per rescope §7).

---

## 14. Migration & rollout

v1.1 is a single-cut release. No feature flag. No partial rollout. The migration v2 → v3 runs once on first load after the v1.1 build replaces the v1.0 build. v2 saves still loadable; v3 saves cannot be opened by v1.0 (acceptable — same one-way migration policy as v1→v2).

Roll-back path: the annotated `v1.0` tag is preserved on `origin`; `git checkout v1.0` restores v1.0 binary state. v3 saves cannot be loaded by v1.0 (the migration is one-way); a real player rolling back would lose run state — acceptable for a solo-dev game.

---

## 15. Implementation phasing (preview — actual phasing in the writing-plans output)

The plan that comes after this spec will likely decompose into ~6 phases:

1. **Balance formulas + tests** (`balance.ts`, `balance.test.ts`)
2. **`paintMasterySlice` + tests**
3. **`canvasSlice.canvasTier` + `upgradeTier` + tick changes + tests**
4. **Ascend orchestrator update + tests**
5. **Save migration v2→v3 + tests**
6. **UI: tier upgrade button + 4-widget BottomBar + hover info + UI tests**

Each phase is a few commits, all green between commits, executable via subagent-driven development per project workflow (CLAUDE.md).

---

**End of spec.**
