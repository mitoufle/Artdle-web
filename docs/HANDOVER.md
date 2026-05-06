# Artdle Web — Handover

## v3.1 — Workshop leveling + tiered items (shipped on `main`)

**Status:** Shipped. Workshop now levels via 1 XP per craft. Items have a tier (Normal..Legendary) determining affix count (1..5). Slot kinds (brush, palette) gate inventory rolls and are unlocked via skill-tree fame nodes.

### What landed

- **Schema:** `Item = { id, slot, tier, affixes[] }` (was single-affix). `WorkshopState` adds `workshopLevel`, `workshopXp`; `equippedItems[]` becomes `equipped: Partial<Record<SlotKind, Item>>`.
- **Slot kinds:** `"brush"` always unlocked; `"palette"` unlocks via the `gear_up` skill-tree node (renamed in `skillTreeDesign.json` to "Unlock Palette Slot"). Each unlocked kind = 1 equip slot of that kind.
- **Tier system:** Hard gates per tier — Normal=L1, Magic=L5, Rare=L15, Epic=L35, Legendary=L70. Affix counts: 1/2/3/4/5. Probability formula: linear interp from `(unlock_level, min)` to `(L100, max)` per tier; normal fills remainder. Legendary 0.01% at L70, 1% at L100.
- **Cost curve:** piecewise growth — 1.05 per level for L1–L5, 1.20 per level past L5. L1 = 100g, L5 = 122g, L70 = 21M g, L100 = 5B g.
- **XP curve:** `xpToNext(level) = 4 × (level + 1)`. 1 XP per craft. Cumulative L70 ≈ 9,936 crafts.
- **Affix rolling:** Flat 5–15% magnitude per affix, regardless of tier. Duplicate affix kinds allowed on the same item. Future skill-tree nodes can multiply at read time.
- **`<WorkshopRoom>` UI:** level header with XP bar + dynamic-cost craft button + tiered item cards (color-bordered by tier, with slot-kind badge + affix list) + per-slot equipped panel (one row per unlocked slot kind only).
- **Save migration v8 → v9:** wipes inventory + equipped (game unreleased; no real cost).
- **Workshop level + XP survive ascend** (long-tail meta, like skill tree). Inventory + equipped wiped on ascend (run-state).

### Tests + build

- **573 tests passing.**
- tsc clean. Lint clean (only pre-existing main.tsx warning).
- Bundle: 151.63 KB gzipped JS (~+2 KB from v3.0).

### Next

Skill-tree nodes for affix magnitude multipliers, legendary chance bonuses, workshop XP boosts — designer-driven; the read-time multiplier pattern from v3.0 carries forward without engine changes.

---

## v3.0 — Skill tree rewrite from designer JSON (shipped on `main`)

**Status:** Shipped. The v1.1 5-node tree has been replaced by the user's designed 17-node DAG (multi-level, multi-parent). `src/config/skillTreeDesign.json` is the source of truth; `skillTreeNodes.ts` derives `SKILL_NODES` from it at module load. Save schema v7 → v8 wipes `purchasedNodes` (game unreleased — no save migration needed).

### What landed

- **Schema:** `purchasedNodes: Partial<Record<string, number>>` (level count). New selectors: `getNodeLevel`, `getNextCost`, `sumLevels`. `hasNode` / `canBuyNode` API names preserved with new semantics. `SkillNodeId = string` (typo protection sacrificed for data-driven config).
- **DAG prereqs:** `node.parentIds` (array). `canBuyNode` requires every parent owned at level ≥ 1.
- **Multi-level purchases:** `buyNode` spends `costs[currentLevel]` and increments. Maxed at `maxLevel`.
- **New effects:**
  - **Get Inspired** (5%/lvl × 5 = +25%) — inspi rate mult, replaces v1.1 Patient Eye
  - **10 colors** (B&W + 9 chroma, 10% additive each = +100% all bought) + **Rainbow** (20%/lvl additive × 5 = +100%) — canvas gold mult, replaces v1.1 Goldsmith
  - **Basic Technique + Muscle Memory** (1%/lvl additive each, max +10%) — NEW canvas speed multiplier in `canvasTick`
  - **Poke the Tree** (auto +100×lvl inspi every 10s) — NEW periodic timer (`pokeTreeTimer` + `skillTreeTick`)
  - **Bargain** (-1%/lvl tree-cost, floored at 50% off) — NEW discount on tree-part upgrades in `treeSlice.buyPartLevel`
  - **Gear Up** (1 → 2 workshop slots) — replaces v1.1 Second Slot
  - **Dropped without replacement:** v1.1 Faster Strokes (-10% palier) and Better Brush (+1 affix magnitude). No equivalent in the new tree.
- **Constellation visuals:** `<StarCanvas>` shows level badges for multi-level nodes, "maxed" state. `<NodeCard>` shows "Level N / M" + button cycles through Acquire / Upgrade · cost / Maxed. Multi-parent edges drawn from each parent.
- **Designer integration:** `nodeLayout.ts` derives `NODE_POSITIONS` and `EDGES` from `skillTreeDesign.json` at module load via `computeAutoLayout`. The `/dev/skill-designer` route remains the authoring tool.

### Tests + build

- 541 tests passing (was 536 baseline; net +5 from added skill-tree config tests).
- tsc clean. Lint clean (only pre-existing main.tsx fast-refresh warning).
- Bundle: 150.19 KB gzipped JS / 5.74 KB gzipped CSS / **~156 KB total** (was ~150 KB pre-T1; +6 KB for new effect plumbing + multi-level UI).

### Next

The skill tree is content-driven now. Authoring loop: open `/dev/skill-designer`, design, Save to file, restart dev server, see new tree. To wire a new effect type, the implementer (Claude) reads the `numericEffect` text and adds the appropriate multiplier/system. Currently all 17 nodes' effects are wired.

---

## v2.0 — Visual redesign shipped (on `feat/v2-redesign`, tag `v2.0`)

**Status:** v2.0 complete. All 4 routes rebuilt to match the handoff aesthetic. Pure visual adapt — no new gameplay features (per the v2.0 spec rule). Ready to merge to `main`.

### What v2.0 is

A pure visual redesign of v1.1, ground-up:
- Tailwind dropped → CSS Modules + `tokens.css` (semantic design tokens).
- All 4 routes rebuilt with inline-SVG scenes + CSS Grid layouts: **Tree** (canopy + ground + glowing leaf), **Painting** (vignetted canvas + gilded frame + room rail + workshop side panel), **Ascension** (animated stone-arch portal + cavern with floating crystals + past-runs ledger), **Constellation** (star-map with 5 nodes + edges + selectable NodeCard + minimap).
- New persisted field: `pastRuns` ledger on `metaSlice`. SAVE_VERSION 5 → 7.
- All v1.1 mechanics preserved: 4 currencies (Gold / Inspiration / Fame / Paint Mastery), canvas tiers (gold = 10 × tier² × multipliers), 5-node skill tree, workshop crafting, ascend.

### Visual deviations from handoff (per "pure adapt" rule)

- Keep IndexedDB persistence (handoff suggested localStorage).
- 4 currencies (handoff used 3); PM teal `#7adcd6` token added.
- 3-stage tree (handoff showed many stages).
- 1-tile canvas-upgrades strip (handoff showed 5).
- 5-node constellation (no fake locked future-nodes).
- 1 cluster only ("Starters") — no fake clusters.
- No pan/zoom on the constellation (5 nodes fit one viewBox).
- React 19 + lucide-react icons (handoff suggested emoji glyphs).

### Reduced-motion

`prefers-reduced-motion: reduce` honored across every animated component:
- `TreeScene` — SVG `<animate>` paused.
- `Cavern` — crystal float paused, opacity locked.
- `Portal` — float + shimmer paused.
- `StarCanvas` — twinkles paused.
- `index.css` — `fame-pulse-anim` paused.
- `FloatingGoldText` — programmatic suppress + onComplete still fires.

### Round breakdown

- **R0** (foundation): Tailwind drop, `tokens.css`, react-router-dom, lucide-react, top-bar nav, currency chips.
- **R1**: Tree route (TreeScene + GroundLine + EnergyMeter + tree-stage interactivity).
- **R2**: Painting route (CanvasStage + TierCard + WorkshopRoom side panel; legacy popup retired).
- **R3**: Ascension route (Cavern + Portal + ThresholdPanel + FamePreviewCard + PastRunsLedger; pastRuns ledger added to save).
- **R4**: Constellation route (StarCanvas + NodeCard + MiniMap + ClusterList).

Each round: own plan in `docs/superpowers/plans/`, executed via subagent-driven-development with TDD per task. Tagged `v2.0-round-{0..4}` for rollback.

### Tests + build (final)

- **470 tests passing** (442 baseline + 28 new across R4).
- tsc clean. Lint clean (only pre-existing `main.tsx` fast-refresh warning).
- Bundle: 144.91 KB gzipped JS / 4.86 KB gzipped CSS / **~149.77 KB total gzipped**.

### Next

Merge `feat/v2-redesign` → `main`. After merge, the v1.2 Quality-axis content work (currently parked per memory) is the natural next thread.

---

## v2.0 Round 4 — Constellation route (complete on `feat/v2-redesign`)

**Status:** Round 4 complete. Polish pass + v2.0 tag pending.

### What landed

- New `src/components/constellation/` directory:
  - `<StarCanvas>` — bg-0 + warm radial glow + 32px grid + 7 animated star twinkles + FAME hub (gold disc + halo + Cinzel "FAME" label) + 5 skill nodes laid out per `nodeLayout.ts` + 5 edges. Click → onSelect callback. Selected node gets purple halo + (for available) inner inspi dot.
  - `<NodeCard>` — 240px fame-bordered + glow card. Shown when ConstellationRoute has a selectedId. Title (fame Cinzel) + meta + description + Acquire button.
  - `<MiniMap>` — small SVG overview using same node positions, scaled. Caption shows N/5 owned. (No viewport rect — no pan/zoom in v2.0.)
  - `<ClusterList>` — single "Starters · N/5" row. No fake clusters per "pure adapt" rule.
  - `nodeLayout.ts` — fixed 2D positions for the 5 nodes + 5 edges. The data layer the 2 SVG components share.
- `src/routes/ConstellationRoute.tsx` rebuilt: CSS Grid `1fr 280px` (canvas + right rail). Selection state at the route. Right rail panels: 42px-serif Fame to spend display + MiniMap + ClusterList.

### Visual deviations from handoff (per v2.0 "pure adapt" rule)

- 5 nodes only (v1.1's Goldsmith / Patient Eye / Second Slot / Faster Strokes / Better Brush). No fake locked future-nodes.
- 1 cluster only ("Starters"). No fake clusters in the cluster list.
- No pan/zoom interaction. With 5 nodes the entire chain fits in a single 600×600 viewBox; pan/zoom lands when a future wave grows the node count past one screen.

### Visual state

- All 4 routes — Tree (R1) + Painting (R2) + Ascension (R3) + Constellation (R4) — now match handoff aesthetic.

### Tests + build

- 470 tests passing.
- tsc clean. Lint clean (only pre-existing main.tsx fast-refresh warning).
- Bundle: 144.91 KB gzipped JS / 4.86 KB gzipped CSS / ~149.77 KB total gzipped.

### Next

Polish round (animations + reduced-motion + final HANDOVER + v2.0 tag), then v2.0 ships.

---

## v2.0 Round 3 — Ascension route (complete on `feat/v2-redesign`)

**Status:** Round 3 complete. Round 4 (Constellation) pending.

### What landed

- New `src/components/ascension/` directory:
  - `<Cavern>` — radial violet→black gradient + repeating stone-block grid + 5 floating purple-diamond crystals (CSS clip-path) with staggered 3s opacity pulse.
  - `<Portal>` — animated stone-arch SVG (bricked stone gradient + thin joint lines + inner radial glow + keystone with gold ✦ rune + 6 purple flanking runes). CSS `portal-float` (±6px Y, 6s) + `portal-shimmer` (drop-shadow pulse, 4s).
  - `<ThresholdPanel>` — current inspi (28px mono inspi-glow) + progress bar to threshold + caption.
  - `<FamePreviewCard>` — fame-bordered + glow card with big serif "+N" fame gain + permanence caption.
  - `<PastRunsLedger>` — 4 most-recent runs in mono table format + total fame footer. Empty state for first-time players.
- `src/routes/AscensionRoute.tsx` rebuilt: CSS Grid `1fr 360px` (cavern + right rail). Inline confirmation modal (role=dialog, aria-modal) for the irreversible Step Through action.

### Data layer

- New persisted field: `pastRuns: ReadonlyArray<PastRun>` on `metaSlice`. Each entry: `{ fame: number; ascendedAt: number }`.
- New action: `metaSlice.addPastRun(run)` (orchestrator-only consumer).
- `performAscendOrchestrator` now appends one entry per successful ascend after fame credit + ascendCount bump.
- Save migration v6 → v7 adds default `pastRuns: []` to existing v6 saves.

### Visual state

- Ascension route: matches handoff aesthetic (cavern + animated portal + right-rail panels + irreversible-action modal).
- Tree (R1) + Painting (R2): complete from prior rounds.
- Constellation: still degraded; Round 4 rebuilds.

### Tests + build

- 442 tests passing.
- tsc clean. Lint clean.
- Bundle: 143.22 KB gzipped JS / 4.52 KB gzipped CSS / ~148.18 KB total gzipped.

### Next

Round 4: Constellation (skill tree). Per spec §8 Round 4.

---

## v2.0 Round 2 — Painting route (complete on `feat/v2-redesign`)

**Status:** Round 2 complete. Round 3 (Ascension) pending.

### What landed

- New `src/components/painting/` directory:
  - `<CanvasStage>` — vignetted canvas frame + gilded picture frame + pixel landscape SVG inside + animated paint-fill overlay (height = progressPct%) + easel cap + thin gold progress bar + bottom info row.
  - `<TierCard>` — primary tile in the canvas upgrades strip. Gold border + gold glow + Roman numerals current → next + Upgrade button.
  - `<CanvasUpgradesStrip>` — 5-cell layout container. v2.0 fills 1 cell (TierCard); 4 are empty layout slots reserved for future upgrades.
  - `<RoomRail>` — 64px vertical nav with 4 tabs (Workshop active; Office/School/Lab disabled with "Coming soon"). lucide-react icons.
  - `<WorkshopRoom>` — 340px right panel replacing legacy WorkshopPopup. Same v1.1 craft/equip/unequip/discard logic, restyled.
- `src/routes/PaintingRoute.tsx` rebuilt: CSS Grid `1fr 340px 64px / 1fr auto` with named areas (stage / upgrades / room / rail).

### Retired

- `src/ui/widgets/TierUpgradeButton.tsx` (replaced by TierCard).
- `src/ui/popups/WorkshopPopup.tsx` (replaced by WorkshopRoom panel; popup state removed).
- `src/store/uiSlice.ts` (workshopPopupOpen field + open/close actions no longer needed).
- `<WorkshopPopup />` mount in `App.tsx`.

### Visual state

- Painting route: matches handoff aesthetic (vignetted canvas + gilded frame + tier card + room rail with workshop side panel).
- Tree: complete (Round 1).
- Ascension / Constellation: still degraded; Rounds 3-4 rebuild.

### Tests + build

- 411 tests passing.
- tsc clean. Lint clean.
- Bundle: 141.15 KB gzipped JS / 3.60 KB gzipped CSS / ~145.19 KB total gzipped.

### Next

Round 3: Ascension route. Per spec §8 Round 3.

---

## v2.0 Round 1 — Tree route (complete on `feat/v2-redesign`)

**Status:** Round 1 complete. Round 2 (Painting) pending.

### What landed

- New `src/components/tree/` directory:
  - `<TreeScene>` — pixel-art landscape SVG with sky/mountains/hills/pond/ground + 3-stage tree variant + 7 animated motes + 3 rising fireflies.
  - `<InspiReadout>` — Cinzel 28px inspi-purple rate readout overlay (top-left of scene) with mono `Stage · {name}` subtext.
  - `<StagePanel>` — right-rail top: title `Current → Next`, 3 stage chips (Seed/Sapling/Tree, current highlighted), progress bar, `Grow into …` CTA.
  - `<UpgradeRow>` — bordered rows with monogram tile + serif name + mono meta + gold cost pill.
- `src/routes/TreeRoute.tsx` rebuilt: CSS Grid `1fr 340px` layout (scene + right rail). All v1.1 tree mechanics preserved (3 stages × 2 parts; `buyPartLevel`/`growSapling` actions; `canGrowSapling` gate).

### Visual state

- Tree route: matches handoff aesthetic (pixel landscape + Cinzel/mono typography + inspi-glow + 3-stage tree visual).
- Painting / Ascension / Constellation: still degraded post-T9; Rounds 2-4 rebuild.

### Tests + build

- 399 tests passing.
- tsc clean. Lint clean (pre-existing main.tsx warning only).
- Bundle: 140.76 KB gzipped JS / 2.47 KB gzipped CSS / ~143 KB total gzipped.

### Next

Round 2: Painting route. Per spec §8 Round 2.

---

## v2.0 Round 0 — Foundation (in progress on `feat/v2-redesign`)

**Status:** Round 0 complete on branch. Round 1+ pending.

### What landed

- `feat/v2-redesign` branch off `main` at `a0bb088`.
- Design tokens: `src/styles/tokens.css` (copied from `design_handoff_artdle/tokens.css` + new `--pm` teal block: `#7adcd6`).
- Globals + base reset: `src/styles/globals.css`. Google Fonts (Cinzel, JetBrains Mono, Inter, Press Start 2P, VT323) loaded via `index.html`.
- Tailwind 4 fully removed (uninstalled, vite plugin dropped, `@theme` block in `src/index.css` deleted; only the fame-pulse keyframe remains).
- New deps: `react-router-dom@7`, `lucide-react`.
- New shell components in `src/components/shell/`: `<TopBar>`, `<BottomBar>`, `<CurrencyChip>`, `<InfoPanel>`, `<MetaChip>`. All CSS Modules-styled per handoff aesthetic.
- React Router wired: 4 routes (`/tree`, `/painting`, `/ascension`, `/constellation`) + redirect from `/` and catch-all to `/tree`.
- Legacy views moved to `src/routes/` (`HomeView` → `TreeRoute`, `PaintingView` → `PaintingRoute`, `AscensionView` → `AscensionRoute`, `SkillTreeView` → `ConstellationRoute`). Tailwind classes stripped from each; layout preserved via inline style for essentials.
- Legacy shell widgets (`ui/widgets/{TopBar, BottomBar, InfoPanel, CurrencyDisplay}`) deleted.
- `viewSlice` retired. Migration v5 → v6 drops the `currentView` field from persisted saves. (T11 added a v4→v5 no-op + v5→v6 currentView-drop chain; final SAVE_VERSION = 6.)
- `WorkshopPopup` auto-close-on-route-change refactored from `currentView` to `useLocation()` pathname.

### Visual state

- TopBar / BottomBar / InfoPanel: fully redesigned per handoff.
- Route content (Tree / Painting / Ascension / Constellation): functionally working, visually degraded (no Tailwind = unstyled internal elements). Per-route visual rebuild lands in Round 1-4.

### Tests + build

- 373/373 tests passing (36 test files).
- tsc clean. Lint clean (pre-existing main.tsx warning unchanged).
- Bundle: 138.76 KB gzipped JS / 1.77 KB gzipped CSS / ~141 KB total gzipped. (vs v1.1's ~129 KB — +12 KB from react-router-dom + lucide-react, minus Tailwind removal).

### Smoke checklist for the user

After pulling this branch and running `npm run preview`:

1. Open the printed URL in **incognito** (clean IDB).
2. Browser redirects to `/tree` from `/`.
3. TopBar: brand "ARTDLE" with fame-tinted "A". 4 nav links visible.
4. BottomBar: 4 currency chips. On `/tree`, gold + inspi prominent; fame + PM dimmed.
5. Click "Painting": URL changes; PaintingView content renders (degraded styling — that's expected).
6. Tier upgrade button still works (gold spent, tier increments).
7. Click "Ascension": URL changes; ascend works at threshold.
8. Click "Constellation": URL changes; skill nodes purchasable.
9. Refresh page on any route: lands back at the same route (router preserves URL); state persisted (gold/inspi/PM all rehydrate).
10. BottomBar dimming switches correctly per route.

### Next

Round 1: Tree route. Per spec §8 Round 1 in `docs/superpowers/specs/2026-05-04-v2-redesign-design.md`.

---

**Date:** 2026-05-03 (v1.1 SHIPPED)
**Status:** v1.1 tagged. Phases 0+1+2+3+4+5+6a+6b (v1.0) + all v1.1 tasks complete + PM redesign patch. **350/350 tests** across 32 files. tsc clean. lint clean (1 pre-existing warning in main.tsx). Bundle: 124.83 KB gzipped JS / ~129 KB total. Repo on `origin/main` with `v1.1` annotated tag pending push (user will push explicitly).

---

## What v1.1 adds (on top of v1.0)

- **10 canvas tiers.** Tier 1 = 2s/sale, 10g; tier 5 = 10s/sale, 250g; tier 10 = 20s/sale, 1000g. Gold scales as `BASE × tier² × multipliers`. Paint time scales as `tier × 2 / paintTimeMult`. Stripped form of canvas-design.md §6 (`quality = tier`, no style/palette/mastery yet).
- **Tier upgrade button** on PaintingView. Cost curve `100 × 2.78^(tier-1)` g per single upgrade. Total path 1→10 ≈ 558k g. Hover shows current vs. next tier deltas (gold/sale, time/sale, PM/sale).
- **Paint Mastery (PM)** — 4th currency. Permanent (persists across ascends). Earned `tier²` per canvas sale. Multiplies canvas gold via `1 + 5 × log10(pm + 1)`. PM 100 → ×11; PM 1M → ×31; PM 1e10 → ×51 (asymptotic log shape).
- **BottomBar** grows from 3 to 4 currency widgets (gold / inspi / fame / PM). PM widget pulses on increment, same CSS-keyframe pattern as fame.
- **Save migration v2 → v3.** Existing v2 saves load with `canvasTier = 1`, `paintMastery = big(0)` defaults. v1 saves chain through v1→v2 then v2→v3.

---

## v1.1 deliverables vs. spec DoD

| # | DoD requirement | Status |
|---|---|---|
| 1 | All formulas in balance.ts with passing tests | ✅ |
| 2 | canvasSlice.canvasTier works (init, upgrade, reset) | ✅ |
| 3 | paintMasterySlice works (gain, persist, no-reset on ascend) | ✅ |
| 4 | PM mult applied to canvas gold sales end-to-end | ✅ |
| 5 | PaintingView has TierUpgradeButton with hover + disabled states | ✅ |
| 6 | BottomBar 4 widgets; PM widget pulses on increment | ✅ |
| 7 | Save migration v2→v3 unit + integration tests | ✅ |
| 8 | 276 baseline tests still pass; ~25 new; ~300+ total | ✅ (332 total — +56 from v1.0 baseline) |
| 9 | Manual smoke check | ⚠️ DEFERRED to user (subagent cannot run interactive playthrough) |
| 10 | Bundle < 250 KB gzipped | ✅ (124.83 KB — ~50% headroom; +0.65 KB over v1.0) |
| 11 | tsc + lint clean | ✅ |

---

## Strict scope adhered

No new workshop affixes, no new skill tree nodes, no tree-stage expansion (per spec strict scope). All changes interior to canvas + new PM slice + UI surface.

---

## What shipped in v1.1 (commit log)

- `29320a3` — `core(balance):` canvasGold takes tier; tier² scaling
- `836bf1e` — `core(balance):` add canvasTime(tier) formula
- `655edfe` — `core(balance):` add tierUpgradeCost + tier constants
- `5c0142e` — `core(balance):` add pmGainPerSale(tier) formula
- `c7f57f6` — `core(balance):` add pmMult + PM_LOG_FACTOR
- `1d115d5` — `store(paintMastery):` scaffold slice (not yet registered)
- `4ef2ab7` — `test(paintMastery):` cover initial state, gainFromSale, helper
- `04d9e05` — `store:` register paintMasterySlice + getPmMultiplier helper
- `d964d80` — `store(canvas):` add canvasTier field (default 1, resets on ascend)
- `7fd81e2` — `store(canvas):` add upgradeTier() atomic action
- `7bba100` — `store(canvas):` tick uses canvasTime(tier) and tier-scaled gold
- `afd4a6b` — `test(canvas):` pin canvasTier-at-sale contract
- `8323678` — `test(ascend):` pin v1.1 reset semantics
- `5f9f629` — `store:` bump SAVE_VERSION to 3; v2→v3 migration adds v1.1 defaults
- `0c0a49a` — `test(persistence):` rename stale 'v2 current' test to '(legacy)'
- `31f2bfd` — `ui(painting):` add TierUpgradeButton widget
- `029310f` — `ui(painting):` mount TierUpgradeButton; show tier in canvas header
- `5561dc1` — `ui(currency):` support paintMastery kind in CurrencyDisplay
- `7276b5c` — `ui(bottombar):` add 4th currency widget for paintMastery

---

### v1.1 patch — PM redesign (2026-05-03, post-internal-playtest)

The original v1.1 PM gain (`tier²` per sale) felt too aggressive in playtest:
canvas gold compounded within minutes. Redesigned to a gold-fraction model:

- **PM gain per sale = `saleGold / pmThreshold(lifetimeGold)`.**
- **`pmThreshold(lifetimeGold)`** ratchets up by 1000× at each milestone:
  1k g/PM (lifetime < 1M) → 1M g/PM (1M ≤ lt < 1B) → 1B g/PM (1B ≤ lt < 1T) → ...
- **New persisted field:** `lifetimeGold: Big` on `paintMasterySlice`. Cumulative
  canvas gold ever earned. Persists across ascends like `paintMastery`.
- **Save migration v3 → v4:** adds `lifetimeGold: big(0)` default. Existing
  `paintMastery` values preserved — only the gain rate changes going forward.
- **PM/sale is now fractional** (early game: 0.01 PM/sale at tier 1). The
  multiplier curve (1 + 5 × log10(pm + 1)) is unchanged; only the gain shape
  shifted from per-canvas to per-gold.
- **Net effect:** PM accumulates roughly log-shaped relative to lifetime gold.
  Asymptotic ceiling around ×16-20 multiplier in normal play, vs the original
  design's effectively-uncapped curve.

The `v1.1` tag was moved forward locally to include this patch. The original
v1.1-without-redesign was never publicly tagged.

---

## Lessons preserved (v1.1 additions)

(Appended to the existing list. Numbering continues from lesson #37.)

38. **Cross-slice action calls inside ticks are idiomatic.** `state.gainFromSale(state.canvasTier)` from `canvasSlice.canvasTick` reaches into `paintMasterySlice` — same shape as the existing `state.add("gold", gain)` pattern. No coupling concerns.
39. **PM mult composes multiplicatively, item bonuses additively.** Convention: `getCanvasGoldMultiplier` returns `1 + Σ contributions` (additive); `getPmMultiplier` returns the multiplicative factor; combined via `*` at the call site. Documented in `multipliers.ts` JSDoc.
40. **Save migrations are transient typecheck-broken until the slice is registered.** v1.1's slice scaffold (1d115d5) and tests (4ef2ab7) were committed before registration (04d9e05), leaving typecheck broken for that window. Future rule: any new slice using `state.X` from the same slice must be committed in the same commit as the store registration in `store/index.ts`, OR use `as any` casts during the gap.
41. **Vitest's `toBeCloseTo` with negative precision is more lenient than Jest documents.** `toBeCloseTo(5983, -1)` passes for values near `5972.82` even though the tolerance formula would predict failure. Test expectations don't need to match `Big.pow` exactly; integer-rounding the actual value is cleaner.
42. **Test name discipline:** "migrate from version N (current) is a no-op" rots when N becomes legacy. Prefer "migrate from version N (legacy) is idempotent" — see commit 0c0a49a which renamed the stale test.

---

## Repo state

- **Branch:** `main` at `https://github.com/mitoufle/Artdle-web.git`. **Pending push** (`v1.1` annotated tag pending push — user will push explicitly).
- **Bundle:** `dist/index.html` 0.29 KB gzipped, CSS 3.98 KB gzipped, JS 124.83 KB gzipped — total **~129 KB gzipped**. Well under the 250 KB DoD budget.
- **Versions:** TS 6.0.3, Vite 8.0.10, Vitest 4.1.5, Zustand 5.0.12, Tailwind 4.2.4, React 19.2.5, Motion 12.38.0. See `VERSIONS.md`.

---

## What's next — v1.2

Per `docs/PORT_PLAN.md` §2.1: v1.2 = subjects (5 starters + 15 derived) + per-subject 10-tier mastery. Source: `docs/specs/2026-04-25-canvas-design.md` §7.

When starting v1.2 in a fresh Claude session in this directory:

> Read CLAUDE.md and docs/HANDOVER.md. v1.1 is shipped (tag v1.1). We're starting v1.2 — Subjects + per-subject mastery. Read docs/specs/2026-04-25-canvas-design.md §7 for the source design. Use brainstorming → writing-plans → subagent-driven-development.

---

---

# Historical — v1.0 (shipped 2026-05-03)

**Date:** 2026-05-03 (v1.0 SHIPPED)
**Status:** v1.0 tagged. Phases 0+1+2+3+4+5+6a+6b complete. **276/276 tests** across 30 files. tsc clean. lint clean (1 pre-existing warning). Bundle: 124.18 KB gzipped JS / ~128 KB total. Repo pushed to `origin/main` with `v1.0` annotated tag.

---

## What v1.0 is

The end-to-end playable loop, in browser, save persists across sessions:

- **Tree (HomeView):** 3 stages × 2 parts. Buy parts with gold; each level adds inspi/sec. Click **Grow next stage** when prior-stage levels hit the unlock threshold (Seed 0 → Sapling 10 → Tree 100). Stage header fades on transition.
- **Canvas (PaintingView):** Auto-paints on a 10s base cycle (modified by paint-time multiplier from equipped items). Each completion sells for 10g base (modified by canvas-gold multiplier). Floating "+Ng" text rises on each sale. Workshop button opens the popup.
- **Workshop (popup over PaintingView):** Click **Craft** (100g) to roll one item with one painting-only affix (`+canvas_gold%` or `-paint_time%`, magnitude 5–15%). Inventory ≤ 3; equip 1 (or 2 with Second Slot). Equip / unequip / discard. Popup fades in/out via Motion.
- **Ascension (AscensionView):** Convert inspiration to fame when above palier (`PALIER_BASE × PALIER_GROWTH^count`). Fame is permanent; gained as `floor(log10(inspi) × 10)`. Run resets (currencies, tree, canvas, workshop); fame + skill tree + ascendCount + playerId preserved. Fame value pulses on increment.
- **Skill Tree (SkillTreeView):** 5 nodes in a strict-linear chain — Goldsmith (1 fame, +10% gold), Patient Eye (3, +15% inspi), Second Slot (10, 1→2 equip slots), Faster Strokes (30, −10% palier), Better Brush (100, +1pp affix magnitude). Total chain: 144 fame.
- **Hover info:** Every interactive element wraps in `<Hoverable>` with title / body / footer factory callbacks. Body resolves at hover time so live values stay current. InfoPanel strip is fixed-height (h-20 + overflow-hidden) so layout never shifts.
- **Currencies (BottomBar):** Gold, Inspi, Fame as `<CurrencyDisplay>` widgets. Hoverable concept entries. Fame increment fires a 500ms scale + color pulse.
- **TopBar:** 4 nav buttons; active state via `aria-pressed` + `bg-app-panel`. View persists across reloads (`viewSlice.currentView`).
- **Save:** IndexedDB via `idb-keyval`, throttled 1Hz writes, flush on hide / unload. Async rehydration gated by `<LoadingScreen />`. Versioned schema (currently v2 after the v1→v2 inspi-affix removal migration). `playerId` UUID generated on first launch and preserved across all saves and ascends.
- **Lifecycle:** Single `installLifecycle(defaultLifecycleHooks)` orchestrator owns `visibilitychange` (pause+flush / resume) + `beforeunload` (flush). All flush rejections route through `reportError` — no silent persist failures.

What's deliberately NOT in v1.0: offline progress, audio, achievements, Painter's Office, Painting School, Expositions, multi-art-form, accounts, mobile, French. All deferred to waves v1.1+ per `docs/PORT_PLAN.md` §2.1.

---

## What shipped this session (post-Phase-5)

**Phase 6a (10 commits, executed via subagent-driven-development):**

- `bdffa94` — `feat(telemetry):` error-reporter seam (`reportError` + swappable sink with captured-default reset).
- `c672e78` — `refactor(core):` tickLoop pause/resume API extracted; internal `_visibilityHandler` removed.
- `2bf5dd1` — `feat(systems):` `installLifecycle` orchestrator + `defaultLifecycleHooks` (consolidates Phase 2 carry-overs #1, #2, #5: `.flush().catch()`, telemetry hook, single `visibilitychange` listener).
- `302733d` — `store(canvas):` `lastSale: { id, amount } | null` transient field + `clearLastSale()` action; stripped from `partialize`.
- `ad99a1c` — `ui(painting):` `<FloatingGoldText>` Motion widget + PaintingView mount keyed on `lastSale.id`.
- `a41a21e` — `ui(home):` tree stage transition fade via `<AnimatePresence mode="wait">`.
- `59668da` — `ui(currency):` fame increment pulse via CSS keyframe + `useEffect`-driven attribute toggle.
- `3728719` — `ui(workshop-popup):` mount/unmount fade via `<motion.div>` + `<AnimatePresence>` (used the C-1 testid swap from Phase 6 opening).
- `72a24fe` — `docs:` v1.0-RC README (player + dev, ~110 lines) + `docs/screenshots/.gitkeep` placeholder.

**Post-Phase-6a adjustments (2 commits):**

- `f479ad5` — `ui(info-panel):` fixed `min-h-16` → `h-20 overflow-hidden` so InfoPanel never reflows.
- `10368d9` — `config(workshop):` dropped `+inspiration_rate%` affix (items are painting-only). `SAVE_VERSION` 1 → 2 with a real `migrate` function that filters out items with the removed kind from `inventory` + `equippedItems`. 4 new migration unit tests.

**Phase 6b (this commit + tag):**

- `<this commit>` — `docs:` HANDOVER catch-up to v1.0-shipped state.
- `v1.0` annotated tag pushed to `origin`.

**Test count progression:** Phase 5 ended at 239/239. Phase 6a added 30 (Motion + lifecycle + telemetry + canvasSlice.lastSale + 1 persistence integration). Adjustment 2 added 4 (migrate unit tests) — net 4 because the inspi-affix tests were rewritten not replaced. **Final: 276/276 across 30 test files.**

---

## v1.0 deliverables vs. PORT_PLAN §8 DoD

| # | DoD requirement | Status |
|---|---|---|
| 1 | All 3 currencies persisted | ✅ (gold, inspiration, fame; Big-typed; serialized via `__big` markers) |
| 2 | 3 tree stages w/ parts, upgrades, transitions | ✅ |
| 3 | Canvas paints, sells, credits gold, single slot | ✅ (single canvas; equip slots are 1 or 2 via Second Slot) |
| 4 | Workshop crafts items, equips, affixes apply | ✅ (2-affix painting-only pool: `+canvas_gold%`, `-paint_time%`) |
| 5 | Ascend works: palier, fame, run reset, fame/skills/count preserved | ✅ |
| 6 | Skill tree: 5 nodes, fame purchases, applies to gameplay | ✅ |
| 7 | Save/load via IDB, async-rehydration-gated, survives 30-day idle | ✅ |
| 8 | playerId UUID generated + preserved | ✅ |
| 9 | Versioned schema + migrate chain | ✅ (now at v2 with real v1→v2 migration; chain is no longer a stub) |
| 10 | Hover info on every interactive surface | ✅ |
| 11 | ~120 Vitest tests passing | ✅ (276 — well over budget; UI tests added in Phase 4+5 weren't in the original estimate) |
| 12 | Bundle < 250 KB gzipped | ✅ (124.18 KB JS + 3.95 KB CSS; ~50% headroom) |
| 13 | Cold-load 60 FPS, warm-load instant | ✅ assumed; not formally measured. RAF + CSS path is performant by construction. |
| 14 | Complete play-through (start → 3-5 ascends → close → reopen → continue → save still works) | ⚠️ NOT empirically verified — no playtest was run. Functional path is exercised by 276 unit + integration tests but not by a real human session. See "Known unverified" below. |

---

## Known unverified (intentional v1.0 gap)

Per the user decision in the Phase 6b brainstorm (2026-05-03), **balance was NOT tuned via playtest**. Reasoning: future waves (Painter's Office, Painting School, Expositions, audio, achievements) will require re-tuning anyway, so investing in playtest-driven v1.0 balance was deemed wasted effort.

What this means concretely:

- **Numbers in `src/core/balance.ts` and `src/config/treeStages.ts` are formula-derived, not playtest-validated.** The PORT_PLAN §7 target of 5–15 min first-ascend is plausible from the analytical math but not confirmed.
- **The 2-affix pool (down from 3) is a deliberate design choice but not playtested.** PORT_PLAN §1.3 flags "may feel thin" as a tuning question; expansion candidates (`-craft_cost%`, `+craft_quality%`, `+canvas_gold_per_equipped%`) are documented but not shipped.
- **No formal play-through verification.** The DoD #14 requirement is satisfied by automated tests, not by real play.

Patch path: if real play surfaces issues, ship a `v1.0.1` tag with targeted balance constants. Most likely targets if needed: `PALIER_BASE` (currently 1000), `CANVAS_GOLD_BASE` (currently 10), `PAINT_TIME_BASE_SECONDS` (currently 10), the `treeStages` part `baseCost` / `rate` curves.

---

## Lessons preserved (still apply for v1.1+)

From Phase 0+1+2:

1. **`break_eternity.js` `Big.pow(integer)` is not bit-exact.** Use `toBeCloseTo` for any Big-derived value flowing through `Big.pow`.
2. **`JSON.stringify` calls `Decimal.toJSON()` BEFORE the replacer runs.** Recursive `serializeBigs` walker handles new Big-bearing fields.
3. **Test name = test contract.** Each `it("…")` description must accurately describe what the body asserts.
4. **The afterEach-spy-restore pattern** for Zustand singleton tests when swapping methods.
5. **`Object.freeze` on module-level initial-state constants.**
6. **Tick-driven mutations require persist throttling** (1s window + flush on hide/unload).
7. **D7 tick order is part of the API contract.** `treeTick` then `canvasTick`.
8. **Idle-frame guards belong in slice ticks, not the orchestrator.**

From Phase 3:

9. **Literal-union keys over `Record<string, …>`.**
10. **Atomic guard order is "validate → spend → mutate"** for any new player verb.
11. **System-file orchestrators talk to slices through actions, not `set` directly.**
12. **`tsconfig.app.json` MUST set `"noEmit": true` in a Vite project.**
13. **Per-task reviews are narrow by design — final cross-cutting review catches what they can't.**
14. **AffixKind / SkillNodeId / ViewId strings are persisted** — renames require save migration. JSDoc above each warns. Phase 6a's adjustment 2 demonstrated this with the v1→v2 migration on AffixKind.
15. **Save-format-binding JSDoc adds zero runtime cost and infinite future safety.**

From Phase 4:

16. **Selectors-only is structural, not stylistic.** `useGameStore.getState()` in render is forbidden. Acceptable in event handlers (mouseEnter, onClick, `onAnimationComplete`) and Hoverable factory callbacks.
17. **Helper signatures over `GameStore` create cast-debt at view call sites.** Future refactor opportunity: `Pick<GameStore, K>` narrowing.
18. **Tailwind 4 JIT picks up runtime-concatenated class strings without a safelist.**
19. **`@testing-library/jest-dom` matchers under `verbatimModuleSyntax` need their types in `tsconfig.app.json`'s `types` array.**
20. **RTL 16 + Vitest globals auto-cleanup between tests.** No `afterEach(cleanup)` needed.
21. **Exhaustive `switch (currentView)` over a `ViewId` literal union** gives compile-time view coverage.
22. **`InfoPanel`'s height is fixed** (h-20 + overflow-hidden as of Phase 6b) — content longer than 5 lines clips silently rather than reflowing the chrome.
23. **`data-testid` survives Tailwind class churn AND Motion wrapping.** The Phase 6 opening C-1 fix (testid on the WorkshopPopup inner card) directly enabled 6a's Motion fade without test changes.

From Phase 5:

24. **Hoverable factory callbacks are the I-1-compliant escape hatch for live values.** Factories run at hover time (event-handler context).
25. **Block-level children inside Hoverable need `as="div"`.**
26. **Transient UI state is a separate slice.** `uiSlice` (workshopPopupOpen) lives separately from gameplay state.
27. **Popup mount goes inside `<main>` (relative parent), not at the root.**
28. **Auto-close-on-view-change is a load-bearing invariant, not a convenience.** `WorkshopPopup`'s `@invariant` JSDoc explicitly names the predicate-relaxation required before any non-painting entry point.

From Phase 6a:

29. **Telemetry hook pattern: function-export + module-level mutable default + reset helper.** `reportError` is the call site; `setErrorReporter` swaps for tests / future v2.0 backends; `resetErrorReporter` restores the captured default. Zero call-site change to swap sinks.
30. **`installLifecycle({onHide, onShow, onUnload})` orchestrator pattern.** Decouples event-fan-out from production-wiring; testable in isolation; production hooks (`defaultLifecycleHooks`) are themselves a unit-tested module export.
31. **tickLoop is event-agnostic.** `pauseTickLoop` / `resumeTickLoop` are the API; lifecycle.ts decides when to call them. Pause is idempotent; resume is no-op when no `_onTick` is installed. Reset `_last` on resume so the first post-resume frame has delta ≈ 0 (v1 ignores elapsed paused time).
32. **`<motion.div>` with `key={trigger.id}` + `onAnimationComplete` is the AnimatePresence-substitute for one-shot animations.** No need for `<AnimatePresence>` when a single conditional render with a stable-per-firing key + a state-clearing callback already drives the lifecycle.
33. **CSS keyframe is the right tool for inline-element pulses.** Wrapping a `<span>` in `<motion.div>` shifts baselines; a `data-pulsing` attribute toggle + a class with `@keyframes` keeps layout stable.
34. **`useReducedMotion()` returns `boolean | null`.** Truthy-check (`reduce ? ...`) treats `null` (jsdom default / pre-listener) as "animate normally" — correct fallback.
35. **AnimatePresence v12 emits no DOM wrapper when children are conditionally null.** `container.firstChild === null` assertions still pass; this is what made Task 8 (WorkshopPopup fade) a zero-test-change drop-in.
36. **Save migrations: `(persisted, fromVersion) => mergedState`. Always merge, never replace.** v1→v2 migration pattern: walk a `Record<string, unknown>`, mutate the relevant slots, return `state as unknown as GameStore`. Filter functions return `[]` for non-array inputs (defensive). Export `migrate` for unit testing.
37. **`v1.0` deliberately ships unplaytested.** v1.1+ waves will re-tune anyway. Patch path is `v1.0.1` if real play surfaces issues.

From v1.1:

38. **Cross-slice action calls inside ticks are idiomatic.** `state.gainFromSale(state.canvasTier)` from `canvasSlice.canvasTick` reaches into `paintMasterySlice` — same shape as the existing `state.add("gold", gain)` pattern. No coupling concerns.
39. **PM mult composes multiplicatively, item bonuses additively.** Convention: `getCanvasGoldMultiplier` returns `1 + Σ contributions` (additive); `getPmMultiplier` returns the multiplicative factor; combined via `*` at the call site. Documented in `multipliers.ts` JSDoc.
40. **Save migrations are transient typecheck-broken until the slice is registered.** v1.1's slice scaffold (1d115d5) and tests (4ef2ab7) were committed before registration (04d9e05), leaving typecheck broken for that window. Future rule: any new slice using `state.X` must be committed in the same commit as the store registration in `store/index.ts`, OR use `as any` casts during the gap.
41. **Vitest's `toBeCloseTo` with negative precision is more lenient than Jest documents.** `toBeCloseTo(5983, -1)` passes for values near `5972.82` even though the tolerance formula would predict failure. Test expectations don't need to match `Big.pow` exactly; integer-rounding the actual value is cleaner.
42. **Test name discipline:** "migrate from version N (current) is a no-op" rots when N becomes legacy. Prefer "migrate from version N (legacy) is idempotent" — see commit 0c0a49a which renamed the stale test.
43. **PM gain shape redesign mid-wave is OK if the multiplier formula stays.** The v1.1 internal-playtest catch (PM compounded too fast with `tier²` gain) was fixed in 6 small commits without retiring the v1.1 tag. The pmMult formula (`1 + 5 × log10(pm + 1)`) was preserved; only `pmGainPerSale` changed from `tier²` to `saleGold / pmThreshold(lifetimeGold)`, with `lifetimeGold` added as a new persisted Big.
44. **Save migrations chain neatly through 4 versions now (v1→v2→v3→v4).** Each migration is a single `if (fromVersion < N)` block with a spread that preserves all prior fields. Round-trip integration tests confirm both per-step migration (v2 direct) and chained migration (v1 through to current) preserve player-meaningful data.

---

## v1.0 repo state (historical)

- **Branch:** `main` at `https://github.com/mitoufle/Artdle-web.git`. **Pushed; `v1.0` tag pushed.**
- **Recent commits:** see `git log --oneline 12e749b..HEAD`.
- **Working tree:** clean (`.claude/` is harness-local untracked).
- **Bundle:** `dist/index.html` 0.29 KB gzipped, CSS 3.95 KB gzipped, JS 124.18 KB gzipped — total **~128 KB gzipped**. Well under the 250 KB DoD budget.
- **Versions:** TS 6.0.3, Vite 8.0.10, Vitest 4.1.5, Zustand 5.0.12, Tailwind 4.2.4, React 19.2.5, Motion 12.38.0. See `VERSIONS.md`.

---

## Known low-priority issues (carried forward to v1.x)

- **README screenshots:** placeholder `docs/screenshots/.gitkeep` + a TODO note in README. Capture 3 PNGs whenever a real play save exists.
- **Helper-signature narrow refactor** — `getInspiMultiplier`, `getCanvasGoldMultiplier`, etc. could take `Pick<GameStore, K>`. Touch when next visiting `multipliers.ts` / `treeSlice.ts` / `workshopSlice.ts` / `ascend.ts` for unrelated reasons.
- **HomeView's `flatMap` over stages** rebuilds the part list on every render. Memoize via `useMemo` if Phase 1.x expands stage count.
- **Index keys on inventory / equippedItems lists.** Safe today; if v1.5 introduces drag-to-reorder, switch to stable item identity (item objects are immutable; object identity works as a key).
- **`uiSlice.workshopPopupOpen` boolean.** Becomes a `Set<PopupId>` when v2.0+ adds a 2nd popup.
- **Phase 2 polish carry-overs #3 (canvas test 9 dedupe) and #4 (split tickAll's 3-assertion test):** test cleanup; deferred indefinitely.
- **Phase 3 final-review minors:** `void set;` YAGNI in `performAscendOrchestrator`; `workshopSlice.test.ts` determinism test doesn't pin a concrete `(kind, magnitude)` tuple; Better Brush range test doesn't actively prove the ceiling moved; `metaSlice.test.ts` "DO NOT call performAscend" comment-discipline risk.
- **3 unused `ticks: number[]` arrays in `tests/core/tickLoop.test.ts`** (Phase 6a Task 2): reviewer-flagged; trace back to plan code blocks; clean opportunistically.
- **5 minor reviewer suggestions across Phase 6a tasks:** `ErrorReporter` export from telemetry; `err instanceof Error` guard in lifecycle hooks instead of `as Error` cast; JSDoc wording polish on FloatingGoldText; `onUnload` defensive `pauseTickLoop()` call; per-component vs global reduced-motion approach. All non-blocking; documented in each task's review.
- **No empirical playtest of the full loop.** v1.0 ships analytically; v1.0.1 is the patch path if real play surfaces issues.
- **PM widget pulse rate at high tiers.** At tier 10, PM increments fire every 2s. At v1.4 multi-canvas time (8 slots), that's ~4 pulses/sec. Flag for v1.4 — debounce or batch if distracting. Not a v1.1 concern.
- **`pm.toNumber()` saturation in pmMult.** For PM beyond `Number.MAX_SAFE_INTEGER`, behavior is technically correct but not ideal. Future v2.x refactor opportunity: Big-native logarithm. Not a v1.1 concern; v1.1 reachability is well under saturation territory.

---

## Build/run commands

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 332/332 in ~10s
npm run build      # dist/ in <1s
npm run preview    # serves dist/ at http://localhost:4173
npm run lint
npx tsc -b --noEmit
```
