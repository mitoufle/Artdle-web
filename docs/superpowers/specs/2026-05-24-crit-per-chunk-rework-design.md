# Crit per-chunk rework — design

**Date:** 2026-05-24
**Status:** draft (awaiting user approval)

## Summary

Crit currently fires once per canvas: if it rolls, the canvas paints `CRIT_SPEED_FACTOR=10×` faster and (via the `prismatic_eye` node) credits +20% gold per level. This is being replaced by a per-chunk mechanic: each chunk paint event independently rolls for crit, and a crit instantly paints `N` extra chunks. Crit chance is sourced from skill tree + the `critLevel` upgrade track (capped at L50). Crit chunks (the `+N` per crit) is sourced from items + workers.

The change touches balance, canvasTickPure, the canvas slice, item/worker affixes, stats semantics, save migration, the canvas-stage UI, and 60+ test files. Existing saves are wiped on load (one-shot version bump).

## Player-facing behavior

| | Old | New |
|---|---|---|
| Crit roll | Once per canvas, at canvas start | Once per chunk-paint event (auto + click) |
| Crit effect | Canvas paints 10× faster, +20% gold per `prismatic_eye` level | Canvas paints `N` extra chunks immediately (no gold bonus) |
| Base crit chance | 0% (everything came from sources) | **1%** (always-on floor) |
| Base crit chunks | n/a (binary flag) | **1** (a base crit paints +1 extra chunk → 2 total) |
| Crit chance sources | `critLevel` + `+crit_chance%` items + `+crit_chance%` workers | Base 10% + `critLevel` (capped L50) + skill-tree capability `crit_chance` (hook only — no nodes yet) |
| Crit chunks sources | n/a | Base 1 + `+crit_chunks` items + `+crit_chunks` workers |
| Soft-cap | `CRIT_SOFT_CAP_THRESHOLD/CEILING` on chance | Same formula, same constants — still applies to chance |
| Bonus chunks re-roll | n/a | **No** — bonus chunks added by a crit do not themselves roll for crit (prevents infinite chains) |

### Why per-chunk

A per-chunk crit makes the system uniformly active: it affects auto-paint AND clicks, so idle and active play both benefit; and high-chunk-count tiers (which scale per `getSketchGridDim`) automatically see more crit events per canvas, which keeps crit feeling alive as tiers progress.

### Why base-1% floor

Gives crit a tiny intrinsic presence even before the player invests in the crit track — without overpowering the early game. The 1% is added before the soft-cap formula, so all other sources (critLevel, future skill-tree nodes) stack on top.

## Balance constants

`src/core/balance.ts`:

| Constant | Old | New |
|---|---|---|
| `CRIT_PER_LEVEL` | `0.01` (1% chance per critLevel) | unchanged |
| `MAX_CRIT_LEVEL` | (none) | **new**, value `50` |
| `BASE_CRIT_CHANCE` | (none) | **new**, value `0.01` |
| `BASE_CRIT_CHUNKS` | (none) | **new**, value `1` |
| `CRIT_SPEED_FACTOR` | `10` | **removed** |
| `CRIT_SOFT_CAP_THRESHOLD` | `0.30` | unchanged |
| `CRIT_SOFT_CAP_CEILING` | `0.95` | unchanged |

## Multipliers (`src/core/multipliers.ts`)

```ts
// New
export function getCritChance(state: CanvasMultiplierInputs): number {
  let raw = BASE_CRIT_CHANCE;
  raw += CRIT_PER_LEVEL * Math.min(state.critLevel, MAX_CRIT_LEVEL);
  raw += countCapability(state, "crit_chance");  // hook for future nodes
  // (removed: +crit_chance% from items and workers)
  return softCapCrit(raw);
}

// New
// Returns the number of BONUS (extra) chunks per crit. Base 1.
export function getCritChunks(state: CanvasMultiplierInputs): number {
  let chunks = BASE_CRIT_CHUNKS;
  chunks += getEquippedContribution(state, "+crit_chunks");
  chunks += getOfficeContribution(state, "+crit_chunks").toNumber();
  return Math.max(0, Math.floor(chunks));  // integer; 0 = trigger only, no extras
}

// Removed: getCritGoldBonus  (prismatic_eye / crit_gold_bonus capability is gone)
```

`critLevel` is hard-capped via `Math.min(state.critLevel, MAX_CRIT_LEVEL)` in `getCritChance`, and the upgrade card in the strip disables and labels "MAX" at L50.

## Tick loop (`src/core/canvasTickPure.ts`)

The current loop steps in canvas-finishing increments. The new loop steps per **paid chunk** — bonus chunks added by a crit are "free" (zero time cost) and don't loop independently.

Model:
- A **paid chunk** is one whose chunkTime was consumed from the tick's timeBudget.
- A **bonus chunk** is one painted instantly when a paid chunk rolls a crit. It advances `progress` by `chunkTime` per bonus without decrementing `timeBudget`.
- Only paid chunks roll for crit. Bonus chunks never roll, so the crit chain is finite.
- `getCritChunks(draft)` returns the **number of bonus (extra) chunks** added on a successful roll. Base `BASE_CRIT_CHUNKS = 1` means one bonus on top of the trigger.

Pseudocode:

```
while (timeBudget > 0 && sales < MAX_SALES_PER_TICK):
    effectiveTime = baseTime / speedMult            // no more critFactor
    chunkCount   = getSketchGridDim(tier)^2
    chunkTime    = effectiveTime / chunkCount
    chunkIndex   = floor(progress / chunkTime)
    nextChunkBoundary = (chunkIndex + 1) * chunkTime
    timeToNextChunk   = nextChunkBoundary - progress

    if timeBudget < timeToNextChunk:
        progress += timeBudget; timeBudget = 0; break

    // Cross a paid chunk boundary.
    progress    = nextChunkBoundary
    timeBudget -= timeToNextChunk

    // Roll crit on this paid chunk.
    if rng() < getCritChance(draft):
        bonus = getCritChunks(draft)                // extras; base 1
        // Cap bonus so it doesn't overshoot the canvas end (overflow is wasted).
        remainingChunks = chunkCount - (chunkIndex + 1)
        appliedBonus = min(bonus, remainingChunks)

        // Free progress for the appliedBonus chunks (no timeBudget cost).
        progress += appliedBonus * chunkTime

        // Mark trigger + bonus chunk indices as crit-painted (for gold flash).
        critChunkSet.add(chunkIndex)
        for i in 1..appliedBonus:
            critChunkSet.add(chunkIndex + i)

        critsLanded     += 1 + appliedBonus         // trigger + bonus all "crit chunks"
        currentCritStreak += 1 + appliedBonus
        maxCritStreak = max(maxCritStreak, currentCritStreak)
    else:
        currentCritStreak = 0

    if progress >= effectiveTime:
        fire sale; progress = 0; sales += 1
        critChunkSet.clear()                        // reset for the new canvas
```

Click handler path (`PaintingRoute.tsx`): the click invokes a `chunkClick()` store action that calls `canvasTickPure(draft, chunkTime)` for the current canvas — the exact time for one paid chunk. The same per-chunk crit logic fires, so a clicked chunk can crit and add bonus chunks identically to auto-paint.

## Items, affixes, workers

`src/config/workshopAffixes.ts`:

- **Remove** `"+crit_chance%"` from `AffixKind`, `AFFIX_KINDS`, `AFFIX_SYMBOL`, `AFFIX_COLOR`, `AFFIX_WEIGHTS`, `AFFIX_RANGES_BY_TIER`.
- **Add** `"+crit_chunks"`:
  - symbol: `"⚡"` (lightning bolt — burst / instant-multiplier feel; visually distinct from the `✦` star used for crit chance elsewhere in the UI)
  - color: `"#ffaf3a"` (warm gold-orange — pairs with the gold flash on crit chunks; visually different from the red `#e85c5c` historically associated with crit chance, so chunks and chance read as different stats at a glance)
  - weight: `1.3` (same as the old kind)
  - magnitude ranges per tier (integer chunks):

| Tier | min | max |
|---|---|---|
| normal | 1 | 1 |
| magic | 1 | 2 |
| rare | 2 | 3 |
| epic | 2 | 4 |
| legendary | 3 | 5 |

`src/config/officeClasses.ts`:

- Replace `+crit_chance%` entries with `+crit_chunks` using smaller magnitude ranges (workers scale via `levelScale`, so even +1 from a worker compounds heavily at high worker levels). Proposed:

| Class | min | max |
|---|---|---|
| critic / colorist / patron (current crit owners) | 0 | 1 |

(Exact class assignments mirror the existing `+crit_chance%` slot — only the kind and magnitudes change.)

The affix-magnitude bonuses (`craftsmanship`, `better_scaling`, school multiplier) still apply additively at roll time to the `min/max`, same as today.

## Skill tree

`src/config/skillTreeNodes.ts` and `skillTreeDesign.json`:

- **Remove** `prismatic_eye` node entirely.
- **Remove** the `crit_gold_bonus` capability from any tree-side selectors.
- **Add** a new capability string `"crit_chance"` to the capability registry. No nodes carry it yet; this is the forward-compat hook the user mentioned for "skill tree raises crit chance" in a later iteration.

`countCapability(state, "crit_chance")` returns 0 today and is the only skill-tree input to `getCritChance` until a future node is authored.

## UI

`src/components/painting/CanvasStage.tsx`:

- **Remove** the `CRIT` indicator div (`data-testid="crit-indicator"`) — it was driven by `isCrit` prop, which no longer exists.
- **Remove** the `isCrit` prop and its `isCritThisCanvas` plumbing through `PaintingRoute.tsx`.
- **Add** per-cell crit-painted state. Every chunk painted via a crit (both the trigger chunk that rolled and any bonus chunks it added) gets a gold tint on its pop-in:
  - CSS: `.sketchCell` + a new `.sketchCellCrit` modifier that adds `filter: drop-shadow(0 0 6px var(--gold))` during the pop-in transition (220ms), then fades back to normal styling via the same `transform`/`opacity` transition system as the current chunk pop. Implementation may use a 1-shot CSS animation that targets only the appearance.
  - Data flow: the tick loop accumulates `critChunks: Record<number, true>` of chunk indices in the current canvas. Persists natively as JSON (avoids the Set/persist serialization friction). It lives in `canvasSlice` (run-state, cleared on sale + reset on tier-up / ascend). `CanvasStage` selects this and applies the modifier class when `critChunks[chunkIndex] === true`.

`src/components/painting/TrackCard.tsx` (or the crit card's caller in `PaintingRoute.tsx`):

- At `critLevel >= MAX_CRIT_LEVEL`, the card disables its upgrade button and replaces the cost label with `"MAX"`.

`src/components/painting/StatsRoom.tsx`:

- Stats labels for `critsLanded`, `currentCritStreak`, `maxCritStreak` change wording from "canvas" to "chunk" (e.g., "Crit chunks landed", "Current crit streak", "Best crit streak").

### Icon convention

Two visually distinct icons keep "chance" and "chunks" readable as different stats wherever crit is surfaced:

| Concept | Icon | Color | Used in |
|---|---|---|---|
| Crit chance | `✦` (existing star) | `#e85c5c` (red, existing) | Crit upgrade card label/tooltip, stats labels for `critsLanded`/streaks, future skill-tree node carrying `crit_chance` capability |
| Crit chunks | `⚡` (new lightning bolt) | `#ffaf3a` (warm gold-orange) | `+crit_chunks` affix on items + workers, item-tooltip rows, the crit-chunk gold flash on the easel |

The TrackCard component's `affixKind` prop currently expects an `AffixKind`. The crit upgrade card today passes `"+crit_chance%"` — since that kind no longer exists as an affix, the card needs a new path that takes an explicit icon + color (or carries a `kind: "crit_chance_stat"` sentinel) so it can still show the `✦` star without referencing a removed AffixKind. Minor refactor noted in the implementation plan.

## Stats semantics

Field names stay identical (no schema change beyond wipe). Meanings shift:

| Field | Old meaning | New meaning |
|---|---|---|
| `statsRun.critsLanded` | crit canvases this run | crit **chunks** painted this run (trigger + bonus) |
| `statsLifetime.critsLanded` | crit canvases lifetime | crit **chunks** painted lifetime (trigger + bonus) |
| `statsRun.currentCritStreak` | consecutive crit canvases | consecutive crit chunks painted (any paid-chunk miss resets; canvas boundary does NOT reset) |
| `statsRun.maxCritStreak` | max consecutive crit canvases | max consecutive crit chunks observed this run |

Streak semantics: each paid chunk that rolls a hit contributes `1 + appliedBonus` to the streak; a paid chunk miss resets to 0. Canvas-end does not reset (the streak is chunk-level). The values wipe to 0 on save migration.

## Tier-up reset behavior (collateral change)

Today `tierUp()` in `canvasSlice.ts` resets ALL five canvas-depth tracks (sellPrice, speed, size, crit, combo) to 0 when the player crosses the gate. With this rework, the "gated" tracks (size, crit, combo) are no longer reset — they persist across tier-ups, so investment in them compounds.

| Track | Reset on tier-up — old | Reset on tier-up — new |
|---|---|---|
| sellPriceLevel | yes → 0 | unchanged: yes → 0 |
| speedLevel | yes → 0 | unchanged: yes → 0 |
| sizeLevel | yes → 0 | **no — preserved** |
| critLevel | yes → 0 | **no — preserved** |
| comboLevel | yes → 0 | **no — preserved** |
| canvasProgress | yes → 0 | unchanged: yes → 0 |
| comboChain | yes → 0 | unchanged: yes → 0 |
| critChunks (new) | n/a | yes → empty (chunk markers are per-canvas) |

Rationale: the user explicitly requested this; the gated tracks represent long-arc investments (size, crit, combo each open via skill-tree unlocks) and resetting them every tier-up made them feel disposable. The two reset tracks (sellPrice + speed) are the ones the tier-up gate is keyed on, so resetting them keeps the tier-up loop intact.

Update the `tierUp()` jsdoc accordingly. Tests in `tests/store/canvasSlice.test.ts` that assert "all tracks reset to 0 on tier-up" need to be split: sellPrice/speed assertions stay, size/crit/combo assertions flip to "preserved across tier-up".

## Save migration

Save schema version bumps from **22 → 23**. The migration step in `src/store/index.ts` for `v22 → v23` does a **full wipe**: any save below v23 is discarded and the store re-initializes from defaults. Documented in the migration chain comment block.

No targeted field migration is written. This is consistent with the user's preference for a clean slate over carrying dead +crit_chance% items / refunding prismatic_eye / etc.

## Test impact

Files that need updates (non-exhaustive — driven by symbol-level grep):

- `tests/core/balance.test.ts` — new constants (`BASE_CRIT_CHANCE`, `BASE_CRIT_CHUNKS`, `MAX_CRIT_LEVEL`); remove `CRIT_SPEED_FACTOR` test.
- `tests/core/multipliers.test.ts` — `getCritChance` no longer reads items/workers; new `getCritChunks` tests; `getCritGoldBonus` removed.
- `tests/core/canvasTickPure.test.ts` — rewrite around per-chunk rolling, no canvas-level crit flag; assert bonus chunks are added on crit; assert streak counts chunks; assert no re-roll on bonus chunks.
- `tests/store/canvasSlice.test.ts` — drop `isCritThisCanvas` from initial state + tier-up reset assertions; new `critChunkSet` field (set/clear on canvas start).
- `tests/store/persistence-integration.test.ts` — v22 → v23 wipe; loading a v22 save returns a fresh store, not a migrated one.
- `tests/store/statsSlice.test.ts` — semantic re-labeling only (no structural changes), but assertions about "canvas crit" become "chunk crit" via the tick test scenarios.
- `tests/config/workshopAffixes.test.ts` — `+crit_chance%` removed; `+crit_chunks` ranges and weight asserted.
- `tests/store/workshopSlice.test.ts` — item rolls no longer produce `+crit_chance%`; `+crit_chunks` may appear.
- `tests/config/officeClasses.test.ts` — worker classes carry `+crit_chunks` not `+crit_chance%`.
- `tests/components/painting/CanvasStage.test.tsx` — drop "renders CRIT badge" test; add "crit chunks render with gold-tint class" test.
- `tests/routes/PaintingRoute.test.tsx` — click handler advances by one chunk and may add bonus chunks on crit (use a seeded rng for determinism).
- `tests/dev/bot-simulation.test.ts` — rebalance expectations; long-run gold may differ since crit no longer 10× speed.
- `tests/store/skillTreeSlice.test.ts` — remove `prismatic_eye` references; add the new `crit_chance` capability registry test.

## Out of scope

- **No new skill-tree nodes for crit chance.** The capability hook exists; specific node authoring is a follow-up.
- **No achievement rebalancing pass** unless a specific crit achievement breaks. The wipe means existing achievement progress resets anyway; any per-canvas crit thresholds in achievement definitions may need re-tuning, but that's a separate spec.
- **No new visual for the canvas-stage strip card** beyond the MAX disable state — the card label may need wording tweaks but no layout changes.
- **No floating-text CRIT indicator.** The gold flash on the chunk is the only feedback for now.

## Open knobs (defaults proposed, easy to tune)

- `+crit_chunks` magnitude tables (per item tier, per worker class) — proposed above; can be re-tuned after a play-test.
- The gold-tint CSS for crit chunks — proposed `filter: drop-shadow(0 0 6px var(--gold))` for the first 220ms of pop-in; final look is a CSS tuning round.

## Risks

- **Auto-paint speed shift.** Without `CRIT_SPEED_FACTOR=10`, throughput changes shape. Fresh-game baseline (1% chance, +1 bonus): effective throughput ~`1.01×` — early crits are felt rarely, similar to the old `1% × 10× speed ≈ 1.09×` but spread out per chunk instead of bursting once per canvas. Mid-game (e.g., critLevel 20: 1% + 20% = 21% raw, no soft-cap yet) with a handful of `+crit_chunks` items (say +3 stacked): throughput ~`1 + 0.21 × 3 = 1.63×`. Late-game (critLevel 50 capped: 1% + 50% = 51% raw → soft-cap ~57% effective) with stacked items + workers stacking bonus chunks into the 20–50 range: combined throughput can reach `10×+` baseline — well past the old crit cap. This is intentional late-game power-up territory, but bot-simulation tests must be re-baselined to catch unintended runaways.
- **Tick performance.** Stepping per-chunk in the inner loop is more iterations than today's per-canvas step. At T6 (784 chunks) and high speedMult, the tick may iterate hundreds of times per frame. `MAX_SALES_PER_TICK` (1000) becomes effectively `MAX_CHUNKS_PER_TICK`; consider raising it or splitting the cap.
- **Save wipe is a hard reset.** Solo-dev player loses all progression on first load after deploy. Confirmed by user.
