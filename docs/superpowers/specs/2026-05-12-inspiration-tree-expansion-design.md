# Inspiration Tree Expansion — Design

**Status:** Approved (2026-05-12). Implementation plan to follow in `docs/superpowers/plans/`.

## Problem

The inspiration tree currently has 3 stages × 2 mechanically identical parts, ending in a manual `Grow into X` button gate. The shape feels arbitrary ("2 per stage is weird"), the manual gate is unnecessary friction (any reasonable state advances), and the 3-stage ceiling caps progression far below the long-term ~25–30 stage roadmap.

This expansion delivers a 6-stage v1.x version with variable parts per stage, auto-stage-up, and a config shape that scales cleanly to the full 25+ stage roadmap.

## Goals

1. Replace the rigid "2 parts per stage" shape with variable counts per stage (1/2/2/3/3/4 across the six new stages).
2. Remove the manual `Grow` button. Stage advancement is automatic the instant `canGrowSapling(state)` becomes true.
3. Ship six stages (Tiny Sprout → Verdant Shoot) with locked names; document the remaining 20 named stages + the World Tree terminus as a future-stages reference, no code.
4. Preserve all non-tree player state across migration (gold, inspi, fame, items, workers, PM, lifetime, fame nodes).
5. Keep the existing growth-curve ratios (`×10` between stages, `×5` within a stage) so the v1.x balance pass tunes from a known baseline.

## Non-Goals

- New TreeScene sprite art per stage. Existing 3 SVG variants (seed / sapling / tree) get reused across the 6 stages (2 stages per sprite tier). Sprite-per-stage art waits until stages 7+ ship — that pass will be batched as a single art task across the new content.
- Mechanically distinct parts within a stage (e.g., one part for rate, another for multiplier). Every part stays `{ baseCost, rate }` — variety comes from stage progression and part count, not part type.
- Authoring the full 25-stage roadmap as code now. The names live in this spec; only stages 1–6 land in `TREE_STAGES`.

## Design

### Config: `src/config/treeStages.ts`

Replace the existing `TREE_STAGES` array. Variable parts per stage; thresholds and costs follow the existing ratios.

| Idx | Stage         | Parts | Threshold (advance) | Parts (id · baseCost · rate)                                                                            |
|-----|---------------|-------|----------------------|---------------------------------------------------------------------------------------------------------|
| 0   | Tiny Sprout   | 1     | 5                    | `cotyledon` · 10 · 0.1                                                                                  |
| 1   | Bud           | 2     | 12                   | `tendril` · 100 · 1 \| `budtip` · 500 · 5                                                               |
| 2   | Leaflet       | 2     | 25                   | `vein` · 1 000 · 10 \| `leaflet` · 5 000 · 50                                                            |
| 3   | Sapling       | 3     | 50                   | `twig` · 10 000 · 100 \| `branch` · 50 000 · 500 \| `leaf` · 250 000 · 2 500                              |
| 4   | Whisperleaf   | 3     | 100                  | `softbough` · 100 000 · 5 000 \| `quietleaf` · 500 000 · 25 000 \| `faintvein` · 2 500 000 · 125 000     |
| 5   | Verdant Shoot | 4     | — (top)              | `greenshoot` · 1 M · 250 000 \| `lushbough` · 5 M · 1.25 M \| `vividleaf` · 25 M · 6.25 M \| `stalk` · 125 M · 31.25 M |

`unlockThreshold` semantics unchanged: the value for stage `N` is the total levels required *across the parts of stage `N-1`* to unlock stage `N`. Stage 0 keeps `unlockThreshold: 0`.

Numbers are placeholder for v1.x and tuned in the playtest balance pass after this lands. The `×10` (between-stage cost / rate) and `×5` (within-stage between parts) ratios match the current code; this expansion preserves them on purpose so the existing 3 stages translate one-to-one.

### Slice: `src/store/treeSlice.ts`

- `growSapling()` action **stays** as an atomic `currentStage++` operation. It is no longer reachable from the UI but remains the single canonical mutation point.
- `buyPartLevel(partId)` — at the end of a successful purchase, call `growSapling()` repeatedly while `canGrowSapling(state)` is true. Cap the loop at 100 iterations as a foot-gun guard. A single buy cannot cross more than one threshold in practice (a part is in exactly one stage), but the loop allows the implementation to remain idempotent and safe.
- `treeTick(deltaSeconds)` — after the inspi-credit work, if `canGrowSapling(state)` is true, fire `growSapling()`. This handles existing-save players whose state already qualifies (post-migration or after balance changes), without requiring a purchase.
- No state-shape changes. `partLevels: Record<string, number>` covers any number of part IDs.

### Migration: save version 13 → 14

- Bump `SAVE_VERSION` to 14 in `src/store/index.ts`.
- New migration step: reset `currentStage` to 0 and `partLevels` to `Object.fromEntries(allNewPartIds.map(id => [id, 0]))`.
- All other slices preserved (gold, inspiration, fame, items, workers, PM, lifetime gold, fame nodes, etc.).
- Rationale: old part IDs (`spark/bud/leaf/branch/bough/crown`) have no equivalent in the new stages. Mapping by total levels or estimating equivalent stage produces misleading state. Wiping only the tree is cheap given preserved gold income — a stage-3 player today can rebuild to stage 6 in a few minutes once auto-grow is in.

### Auto-grow trigger summary

- **`buyPartLevel`** is the primary trigger (responsive: stage flips the moment the threshold is hit by a buy).
- **`treeTick`** is the safety-net trigger (handles state where threshold is met without a buy event, e.g., post-migration loads, hypothetical balance changes that lower thresholds, etc.).
- Both call the same `growSapling()` action, which double-checks `canGrowSapling(state)` before mutating — so double-firing in the same frame is idempotent.

### UI

#### `src/routes/TreeRoute.tsx`
- Drop the `growSapling` import.
- Drop the corresponding `onGrow` prop wiring.

#### `src/components/tree/StagePanel.tsx`
- Drop the hardcoded `STAGE_NAMES = ["Seed", "Sapling", "Tree"]`. Read names dynamically from `TREE_STAGES`.
- The chip strip renders one chip per `TREE_STAGES` entry (6 chips). CSS spacing in `StagePanel.module.css` may need a small tightening pass to keep the strip readable at 6 wide.
- Remove the `Grow into X` button. Remove `canGrow` / `onGrow` props from the component's `Props` interface.
- Title format stays: `Current → Next` for non-final, `Current · Final stage` at the top stage.
- Progress bar + level-count line stay (informative even when grow is automatic). The hover footer no longer says "Click 'Grow'..."; it becomes `"Stage advances automatically when threshold is reached."`.

#### Stage-up celebration
- `TreeRoute` watches `currentStage` via a `useRef` to detect changes.
- On change, fires a transient toast (`"Grown into {newStageName}!"`) anchored to the scene area for ~2 seconds. CSS-driven fade. No new dependencies.
- Optional sparkle class added to the scene container for the same 2 seconds (CSS-only flourish).
- This is the lowest-friction implementation; if it feels noisy in playtest, it's a one-line removal.

### TreeScene sprites: `src/components/tree/TreeScene.tsx`

Map the 6 stages onto the existing 3 sprite variants:

| Stage index | Sprite           |
|-------------|------------------|
| 0 (Tiny Sprout), 1 (Bud) | `seed` (the small sprout) |
| 2 (Leaflet), 3 (Sapling) | `sapling` (the mid tree) |
| 4 (Whisperleaf), 5 (Verdant Shoot) | `tree` (the big tree) |

Implementation: replace the hardcoded `STAGE_NAMES = ["seed", "sapling", "tree"]` 3-element lookup with a tier-mapping function (e.g., `getSpriteTier(stage) = Math.floor(stage / 2)`). `data-tree-stage` attribute now reflects the sprite tier name, not the stage name, which matches the test-id semantics (the test was asserting on the sprite art, not the stage label).

### Tests

#### `tests/core/balance.test.ts`
No formula changes — `treePartCost` is unchanged. Optional: add a small smoke test that walks `TREE_STAGES` and asserts no missing fields / non-positive base costs / negative rates.

#### `tests/store/treeSlice.test.ts` (new cases)
- Auto-grow fires inside `buyPartLevel` when the buy brings total levels to threshold.
- Auto-grow does NOT fire inside `buyPartLevel` when total < threshold.
- `treeTick` fires `growSapling()` when `canGrowSapling(state)` is true on tick entry.
- `treeTick` does not fire `growSapling()` when at the final stage.
- `buyAllAffordableTreeParts` cascades across stage thresholds correctly when gold supports the cascade.

#### `tests/store/persistence-integration.test.ts`
- v13 → v14 migration: a save with non-zero `currentStage` and non-zero `partLevels` migrates to v14 with `currentStage: 0` and all-zero `partLevels` (new part IDs only); other slices unchanged.

#### `tests/components/tree/StagePanel.test.tsx`
- Asserts 6 chips render, no Grow button is present, no `canGrow`/`onGrow` prop in the type.
- Update existing assertions that depended on `["Seed", "Sapling", "Tree"]` to expect the new 6-stage strip.

### Files Touched

```
src/config/treeStages.ts                       rewrite TREE_STAGES
src/store/treeSlice.ts                         auto-grow in buyPartLevel + treeTick
src/store/index.ts                             SAVE_VERSION 13 → 14 + migration step
src/routes/TreeRoute.tsx                       remove growSapling wiring; add stage-up toast
src/components/tree/StagePanel.tsx             read STAGE_NAMES from config; remove Grow button
src/components/tree/StagePanel.module.css      tighten chip spacing for 6
src/components/tree/TreeScene.tsx              tier-mapping function (6 stages → 3 sprites)
tests/store/treeSlice.test.ts                  auto-grow cases
tests/store/persistence-integration.test.ts   migration v13→v14 case
tests/components/tree/StagePanel.test.tsx     chip-count + no-grow-button (update existing)
tests/components/tree/StagePanel.hover.test.tsx update hover-footer assertion
```

## Future Stages (Reference, Not Code)

The user supplied the full naming roadmap for the eventual ~25-stage progression, capped by a `World Tree` terminus. These names live here so the v1.x team can adopt them in later waves without re-litigating naming:

```
1.  Tiny Sprout          (← ships in this design)
2.  Bud                  (← ships in this design)
3.  Leaflet              (← ships in this design)
4.  Sapling              (← ships in this design)
5.  Whisperleaf          (← ships in this design)
6.  Verdant Shoot        (← ships in this design)
7.  Mossling
8.  Sylvan Sapling
9.  Bloomheart
10. Treant Cub
11. Wyldwood
12. Elderbark
13. Greenwarden
14. Thornlord
15. Sage Oak
16. Ancient Treant
17. Spiritwood
18. Mythbark Colossus
19. Arcane Yggling
20. Runebark Sovereign
21. Skyroot Behemoth
22. Astral Sequoia
23. Celestine Wyrmwood
24. Empyrean Heartwood
25. Genesis Arbor
26. World Tree           (terminus)
```

Future waves authoring stages 7+ should:
- Reuse the variable-count-per-stage convention.
- Likely flatten the cost / rate growth ratios (the current ×10 between stages makes stage 26 mathematically untouchable). A balance pass at the time of authoring stages 7+ will need a new growth curve (e.g., ×3 between stages past stage 6).
- Plan a sprite-per-stage art pass at that time.

## Open Questions

None at design freeze. Numbers in §Design are placeholder and explicitly subject to the v1.x balance pass; that's part of the design, not an open question.

## Acceptance Criteria

- `TREE_STAGES` contains exactly 6 entries with the names, part counts, thresholds, and base costs/rates listed in §Config.
- The `Grow into X` button is not rendered anywhere. Touching a part-level threshold via `buyPartLevel` or via `treeTick` advances the stage within the same frame.
- A v13 save loads into v14 with `currentStage: 0`, `partLevels` keyed on the new part IDs, all-zero levels, and every other slice unchanged.
- All existing tests pass; new test cases (auto-grow inside buy, auto-grow inside tick, cascade, migration) pass.
- `npx tsc --noEmit` clean. `npm run build` clean. Bundle delta < 5 KB gzipped.
- A stage-up flashes a 2-second toast naming the new stage; the scene briefly highlights.
