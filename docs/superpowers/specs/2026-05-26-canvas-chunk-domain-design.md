# Canvas chunk-domain rework — design

**Date:** 2026-05-26
**Status:** Draft — awaiting user review

## Goal

Flip the canvas-paint model from **time-domain** ("each canvas takes N seconds; tier doubles that N") to **chunk-domain** ("each canvas is N chunks; speed upgrade reduces the interval per chunk; tier doubles N"). Collapse the Size and Tier axes into one. Move tier-up from an implicit threshold mechanic to an explicit, expensive `Tier upgrade` button.

## Core model

### Unified axis

- `canvasTier` is the only progression axis. The `canvasSize` slice field is removed.
- Player-facing name: **"Tier"** (`Canvas Tier 3`, `Tier upgrade`).
- Internal name: `canvasTier` (existing field reused; size disappears entirely).

### Chunks per tier

| Tier | Chunks | Cells rendered | Chunks-per-cell |
|------|--------|----------------|-----------------|
| 1    | 10     | 10             | 1               |
| 2    | 20     | 20             | 1               |
| 3    | 40     | 40             | 1               |
| 4    | 80     | 80             | 1               |
| 5    | 160    | 160            | 1               |
| 6    | 320    | 320            | 1               |
| 7    | 640    | 640            | 1               |
| 8    | 1280   | 640            | 2               |
| 9    | 2560   | 640            | 4               |
| T    | 10 × 2^(T-1) | min(640, 10 × 2^(T-1)) | ceil(chunks / cells) |

Formula: `chunks(T) = 10 × 2^(T-1)`. Cells = `min(640, chunks(T))`. Chunks scale infinitely; cells cap at 640.

The visual cell grid keeps the existing rasterized-to-canvas + drip-fed in-flight pool architecture from the 2026-05-25 chunk-rendering rework. At T8+, one cell-paint event corresponds to multiple chunks completed — the engine fires the chunk events as before; the visual layer batches them into one cell reveal.

### Interval

```
chunkInterval = BASE_CHUNK_INTERVAL / getCanvasSpeedMultiplier(draft)
```

- `BASE_CHUNK_INTERVAL = 5` seconds.
- Speed L0 → 5s/chunk.
- All existing speed sources (`basic_technique`, `muscle_memory`, speed affix on items, worker speed contributions) keep their current multiplicative semantics. They feed `getCanvasSpeedMultiplier` exactly as today; only the consumer changes (`/ interval` instead of `× canvasTime`).
- Click-to-paint: one click = one chunk advanced. (Today: one click = `paintTimeSec / chunkCount` seconds. Functionally equivalent at the chunk level; the new path is simpler — pass a chunk count, not a seconds value.)

### Gold

Gold pays per chunk as the chunk completes, not in a lump at canvas end.

```
goldPerChunk = baseGoldPerChunk(level) × tierFactor(T) × itemsMul × workersMul
canvasTotalGold = chunks(T) × goldPerChunk
```

- `tierFactor(T) = 10^(T-1)` — unchanged from today. Tier still multiplies base gold.
- The existing `lastSale` flash fires on the **final** chunk of each canvas (the chunk that triggers `canvasNumber++`). Players still see the "canvas sold!" beat; it just happens at the last chunk's payout instead of as a separate burst.
- Crit chunks pay too — a crit fires `1 + N` chunks worth of gold (same as today's "crit cells").

### Economy ramp

- Tier-up cost: `1000^(T-1)` (1k, 1M, 1B, 1T, 1Q, ...).
- Per-tier canvas total gold growth: ×20 (×10 from `tierFactor` × ×2 from chunks).
- Per-tier canvas time growth: ×2 (chunks ×2, interval fixed if speed not bought).
- Per-tier GPS growth at base: ×10.
- Within-tier upgrade budget to bridge ×1000 cost ÷ ×10 income = **~×100**. Existing within-tier dials (sell-price, speed, crit, combo, items, workers, skill tree) are expected to cover this; if playtest shows the gap is too wide, tuning options are: raise `tierFactor` exponent, lower tier-cost base, raise within-tier upgrade caps.

## New: Tier upgrade

A dedicated, prominent UI element. Not part of the existing upgrade strip (sell-price/speed/crit/combo).

### Placement

Above the upgrade strip on the painting route, sized larger than a normal upgrade card. Clearly distinct visually so the player reads it as "this advances the run, those are stat boosts."

### State machine

| State | Visual |
|-------|--------|
| Locked at T1 start | Default card style, shows `Tier 2 — 1,000 gold`. Greyed-out look if unaffordable. |
| Affordable | Rainbow conic-gradient border animates (style: `src/components/shell/AchievementToast.module.css` line 31, "Animated rainbow border via masked conic-gradient ring"). |
| Bought | Pulse animation + tier number increments; card shows next tier cost. |

The border is a re-use of the achievement-toast pattern, not a copy-paste. Extract the `@keyframes` and the conic-gradient masking technique into a shared class (e.g. `.rainbowBorderAffordable`) under a shared CSS module so both call sites stay in sync.

### Behavior

- Always available from the first canvas — no prerequisite (e.g. no "reach inspiration X" gate).
- Clicking it spends gold equal to `1000^(T-1)`, increments `canvasTier`, resets `canvasProgress` to 0 (canvas restarts at chunk 0 with the new tier's chunk count). `canvasNumber` is not reset (it tracks total canvases painted in the run; tier-up doesn't undo that count).
- Within-tier upgrade levels (sell-price, speed, crit, combo), workshop items, workers, and skill-tree state are **preserved** across tier-up. Tier-up is a within-run progression event, distinct from ascend.

## Removed

These are removed *as part of this rework*, in the same plan. Spec states the intent; the implementation plan enumerates exact files and lines.

1. **`canvasSize` slice field and its actions** (`upgradeSize`, related getters). The size upgrade button disappears from the upgrade strip.
2. **The `canvas_size_bonus` capability** and the skill-tree nodes that grant it (likely `expanding_horizon`, possibly others — plan to audit `src/config/skillTreeNodes.ts`).
3. **Size affix on items** (any item affix that contributes to canvas size). Removal scope: the affix definition in `workshopAffixes`, any item-roll logic that could roll it, save migration to strip the affix from existing inventory.
4. **Size contribution from workers** (any worker hook that adds to size).
5. **`costTierFactor()`** and its usage in the five `*UpgradeCost` functions. Speed, sell-price, crit, combo costs stop ramping with tier. They keep their per-level ramp.
6. **`CANVAS_TIME_BASE`, `canvasTime()`, `timeFactor()`** in `src/core/balance.ts`. Dead after this rework. The plan removes them.
7. **The displayed `TierBlock.tierFactor` "Base gold ×N" / "Upgrade costs ×N" rows in `StatsRoom.tsx`** — only "Base gold" survives; "Upgrade costs" goes away (no per-tier cost ramp).

## UI changes

### Painting route layout (top-down)

1. Stats / tier badge: shows `Tier N`, chunks remaining, current goldPerChunk.
2. **Tier upgrade card** — new, prominent, separate from upgrade strip. Includes the rainbow-border affordability state.
3. Upgrade strip (sell-price, speed, crit, combo) — unchanged structurally; cost formulas drop `costTierFactor`.
4. Canvas area — unchanged visual architecture (settled-canvas + in-flight pool).
5. Track cards, room rail — unchanged.

### Stats room

- `TierBlock` is renamed to `CanvasBlock`. Displays: tier number, chunks per canvas, interval per chunk (derived from speed), gold per chunk, gold per canvas, GPS.
- Size-related rows removed entirely (no `Size`, `Size factor`, `Size² gold multiplier` rows).
- The existing "Base gold ×N" row stays (still meaningful — `tierFactor(T)` lives on). The "Upgrade costs ×N" row is removed (no more `costTierFactor`).

## Trade-offs accepted

1. **Click impact regresses at high tiers.** T7 = 640 chunks → 1 click = 0.16% of canvas. The 2026-05-25 chunk-rendering work celebrated clicks recovering from 1/12,769 to 1/400; this design pushes it back to 1/640 at T7, and 1/1280 at T8, etc. Acceptable: clicks are an early-game lever; idle ticking dominates late.
2. **L0 canvas time at high tiers is large.** 5s × 640 = 53 minutes per canvas at T7 with no speed. Speed upgrades become load-bearing for high-tier playability. Intentional: speed is now the second progression axis (behind tier).

## Out of scope (defer to writing-plans)

- Save migration mechanics: `canvasProgress` (seconds) → chunk count. Likely strategy: bump `SAVE_VERSION`; on load, if old version present, convert `canvasProgress / canvasTime * chunks` to chunks completed. Plan enumerates the migration code path.
- Exact dead-code removal list: which lines in which files lose `canvasTime`, `timeFactor`, `CANVAS_TIME_BASE`.
- Exact skill-tree node list to remove (`expanding_horizon` confirmed, others TBD via audit).
- Exact item/worker affix removal: enumeration of affected files in `src/config/workshopAffixes.ts` and worker config.
- Test churn: ~25-40 existing tests touch `canvasSize`, `canvasTime`, or `costTierFactor`. Plan enumerates and either updates or deletes each.

## Test strategy

- New `tests/core/canvasTickPure.test.ts` cases for chunk-domain math: click = 1 chunk, tick interval = `BASE_CHUNK_INTERVAL / speed`, chunk overflow → next canvas at chunk 0.
- New `tests/core/balance.test.ts` cases: `chunks(T) = 10 × 2^(T-1)`, `goldPerChunk(level, T) = baseGoldPerChunk × tierFactor(T) × ...`, `tierUpgradeCost(T) = 1000^(T-1)`.
- Bot-sim (`tests/dev/bot-simulation.test.ts`) updates: ascend guard already exists; add tier-up purchase strategy (player buys tier when gold ≥ cost AND within-tier upgrades are reasonably saturated). Re-establish the T3→T4 ≥ T2→T3 × 0.9 non-inversion guard with the new formulas.
- Regression test for the new Tier upgrade card affordability border (the rainbow class appears on the card when `gold >= tierUpgradeCost(currentTier + 1)`).
- Update `tests/components/painting/CanvasStage.test.tsx` cell-cap tests to reflect the 640 cap (not 400).

## Implementation order (sketch — plan refines)

1. **Core math layer:** add `chunks(T)`, `goldPerChunk(...)`, `tierUpgradeCost(T)`, `chunkInterval(...)`. Tests first.
2. **canvasTickPure:** drop seconds-based progress, use chunk count directly. Click = 1 chunk. Tests updated.
3. **Slice:** rename / repurpose `canvasProgress` semantics (chunks completed, not seconds). Migration code.
4. **Tier upgrade action:** new `tierUp()` action; spends gold, increments tier, resets canvas.
5. **Upgrade-cost cleanup:** drop `costTierFactor` from speed/sell-price/crit/combo cost formulas.
6. **Remove size:** slice field, upgrade action, skill nodes, item affix, worker contribution. Save migration strips old fields.
7. **UI:** new Tier upgrade card with shared affordability-border CSS. StatsRoom rewrite for Canvas block.
8. **Dead-code sweep:** `canvasTime`, `timeFactor`, `CANVAS_TIME_BASE`.
9. **Bot-sim:** adapt and re-run; capture per-tier progression for documentation.
