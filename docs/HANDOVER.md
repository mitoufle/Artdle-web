# Artdle Web — Handover

## Skill tree pricing + dev tooling polish (2026-05-15)

### What landed

**BFS-depth pricing for all skill tree nodes (commit `ff75de3`)**

- All 52 nodes in `skillTreeDesign.json` now have cost arrays scaled by BFS depth from the two roots (`get_inspired` d0, `basic_technique` d0) — max parent depth + 1 for multi-parent nodes.
- Pricing ladder: d0 costs ~[1–8], d11 nodes (`painters_hat`, `gold_diggers`) cost 10,000 fame. Full scale in the commit diff.

**In-game dev toggle: "Free nodes" (commit `ff75de3`)**

- `devFreeNodes: boolean` added to `skillTreeSlice` — default `false`, excluded from persist (transient).
- `canBuyNode` and `buyNode` both short-circuit when `devFreeNodes = true` (skip fame check / spend).
- Toggle button in `ConstellationRoute` rail: `[DEV] Free nodes: ON/OFF`. When ON, cost display shows `0`.
- `toggleDevFreeNodes` action wired through store.

**Skill designer Reset button fixed (commit `ff75de3` / earlier)**

- `window.confirm()` is silently suppressed in cross-origin (localtunnel) contexts.
- `ActionBar.tsx` replaced with inline two-step confirm: "Discard changes and reload from file? / Yes, reset / Cancel".
- `resetAll` in `useDesignerState` now calls `setDesign({ ...loadFileBaseline() })` — guarantees a new object reference so React re-renders and the auto-save `useEffect` doesn't fight the reset.

**Top bar reset button fixed (commit `ba4cd3d`)**

- Same `window.confirm()` suppression issue in `TopBar.tsx`.
- Replaced with inline confirm: "Wipe all progress? Yes / No" rendered inside the meta bar strip.
- "Yes" calls `useGameStore.persist.clearStorage()` + `localStorage.clear()` + `location.reload()`.

### Lessons preserved

- `window.confirm()` / `window.alert()` are silently suppressed in cross-origin iframes and tunnels (localtunnel, ngrok). Always use inline React state for destructive-action confirmation.
- Zustand `Object.is` comparison: passing the same object reference to `setState` is a no-op even if the object's contents differ. Always spread or construct a new object when resetting state.

### Next (carry-overs)

- Four `as unknown as GameStore` casts remain in `WorkshopRoom`, `ConstellationRoute`, `TreeRoute`, `AscensionRoute`.
- Chip-strip spacing for 6-stage tree chips (deferred from prior session).
- Goldsmith class node (`gold_diggers`) playtest pending.
- Combo chance soft cap (same treatment as crit) if playtesting shows it trivially maxes.
- `StatsRoom.tsx` has an uncommitted modification (flagged in git status at session start) — verify before next session.

---

## Workshop UI polish — session 5 (2026-05-15)

Visual polish pass (empty slot placeholders, symbol scale uniformity) and crit balance fix.

### What landed

**Empty slot SVG placeholders (commit `cdd9388`)**

- Each empty equipped slot in the Workshop now renders a slot-specific SVG sketch instead of a bare `—` dash.
- `SLOT_PLACEHOLDER: Record<SlotKind, JSX.Element>` map added to `WorkshopRoom.tsx` with hand-drawn inline SVGs for all six slot kinds: brush (angled handle + bristle tuft), palette (kidney shape + thumb hole + 3 paint blobs), easel (A-frame legs + crossbar + canvas rect), hat (beret dome + brim ellipse + stem dot), apron (body rect + bib + straps), boots (simplified boot profile path).
- SVGs are wrapped in `.slotIcon` span — `opacity: 0.22`, `color: var(--ink-1)` — so they read as a faint sketch hint. Slot name text below in `.slotLabel` unchanged.
- `.emptySlot` min-height bumped 80 px → 88 px to accommodate icon + label without cramping.

**Affix symbol optical size normalisation (commit `cdd9388`)**

- `AFFIX_SYMBOL_SCALE: Record<AffixKind, number>` added to `workshopAffixes.ts`. Compensates for Unicode glyphs that render at different optical sizes at the same `font-size`: `✦` and `⊕` scale ×1.3, `∞` scales ×1.1, `$` and `»` stay ×1.0.
- Applied as `fontSize: \`${base * AFFIX_SYMBOL_SCALE[kind]}px\`` everywhere symbols are rendered: item squares (base 11 px), upgrade tiles / TrackCard (base 20 px), worker/queue cards (base 11 px), StatsRoom block headers (base 13 px), FireConfirmModal affix rows (base 11 px).

**Crit chance soft cap (commit `a076c97`)**

- Problem: `getCritChance` was a simple additive sum clamped at 1.0. `CRIT_PER_LEVEL = 0.01` means critLevel 100 alone hits 100%; stacked items (up to 34% per legendary affix × 6 slots) and levelled workers pushed past it trivially early.
- Fix: two new constants in `balance.ts` — `CRIT_SOFT_CAP_THRESHOLD = 0.30` and `CRIT_SOFT_CAP_CEILING = 0.95`. Below 30% raw, the formula is linear (no change). Above 30%, exponential diminishing returns:
  ```
  effective = threshold + range × (1 − exp(−excess / (range × 0.5)))
  ```
  where `range = ceiling − threshold = 0.65`. Representative curve: 30% → 30%, 50% → ~60%, 100% raw → ~87.5%, ∞ raw → 95% (floating-point floor at ceiling).
- `getCritChance` in `multipliers.ts` updated; `CRIT_SOFT_CAP_THRESHOLD` and `CRIT_SOFT_CAP_CEILING` imported from `balance.ts`.
- **Canvas tests made deterministic.** Three tests previously relied on `critLevel: 100` guaranteeing 100% crits:
  - Crit timing and regression tests now use `canvasProgress: 0.001, isCritThisCanvas: true` — the `canvasProgress > 0` check bypasses the `if (progress === 0)` RNG roll, forcing the crit flag without touching the RNG.
  - Re-roll ordering test changed to `critLevel: 0` after the forced crit: the post-sale re-roll at line 158 then guarantees `false`, making the assertion deterministic in both directions.

### Tests + build

- **776 tests passing across 80 files** (was 775; +1 net from split multiplier test case).

### Lessons preserved

- **Hard-clamp at 1.0 is the wrong design for idle-game probabilities.** Diminishing returns above a threshold lets every upgrade continue to matter at the margin while making 100% unreachable. The threshold + exponential formula is self-contained in `getCritChance` and tunable via two constants in `balance.ts`. Combo chance should get the same treatment if it becomes an issue.
- **Tests that assert `rng() < P` for P < 1.0 are probabilistically flaky.** Bypassing the roll entirely (`canvasProgress: 0.001` + explicit `isCritThisCanvas`) is cleaner and more maintainable than picking a seed and hoping the RNG cooperates with future balance changes. Use this pattern for any future test that needs to control whether a canvas crits.
- **`AFFIX_SYMBOL_SCALE` belongs in the config, not inline.** Different Unicode glyphs have different optical sizes at the same `font-size`. A centralised scale map keeps all rendering sites consistent without repeated magic numbers.

### Next (carry-overs)

- Four `as unknown as GameStore` casts remain in `WorkshopRoom`, `ConstellationRoute`, `TreeRoute`, `AscensionRoute`.
- Chip-strip spacing for 6-stage tree chips (deferred from prior session).
- Goldsmith class node (`gold_diggers`) playtest pending.
- Combo chance soft cap (same treatment as crit) if playtesting shows it also trivially maxes.

---

## Workshop UI polish — session 4 (2026-05-14)

Visual polish pass and fusion correctness fix.

### What landed

**2-column affix grid + colored symbols (commit `cd92294`)**

- `AFFIX_COLOR` added to `workshopAffixes.ts`: `$` → `#f0b847` (gold), `»` → `#4fc3e8` (cyan), `✦` → `#e85c5c` (red), `∞` → `#b06ee8` (purple), `⊕` → `#4cb87a` (green).
- Item squares (Workshop equipped + inventory) now render affixes in a 2-column CSS grid (`grid-template-columns: 1fr 1fr`). Each affix span wraps the symbol in a `<span style={{ color: AFFIX_COLOR[a.kind] }}>` so the symbol is colored and the magnitude stays in `var(--ink-2)`. Font reduced from 14 px to 11 px to fit two columns in 104 px tiles.
- `WorkerCard` and `QueueCard` affix rows now prefix with the colored symbol followed by the long-form label.
- `StatsRoom` block headers prepend the colored symbol before each stat name (Sell Price, Speed, Crit, Combo, Size).
- Item tile background changed to flat `var(--bg-stone-d)` for all tiers — only the border (thickened from 2 px to 3 px) carries the tier color. `equippedFusion` layer-1 background updated to match.

**Same-slot-only fusion (commit `cd92294`)**

- `getFusionTarget` previously iterated all equipped slots and returned the first match on tier + affix-kind multiset, deliberately ignoring slot kinds (a "hat" in inventory could fuse with an equipped "brush"). This caused cross-slot merges (apron into boots, etc.) visible in playtesting.
- Fix: replaced the loop with a direct lookup `equipped[invItem.slot]`. If no item is equipped in the same slot, returns `null` immediately. Slot mismatch → no fusion, regardless of tier or affixes.
- `slotFusionMap` comment and key updated: now keys by `item.slot` (which equals `target.slot` under the new constraint).
- Test `"slot kind of inventory item does not have to match equipped slot"` inverted to `"returns null when slot kinds differ even if tier and affix kinds match"`. Matching-test fixture corrected (`inv.slot` changed from `"palette"` to `"brush"` to match the equipped item's slot).

### Tests + build

- **775 tests passing across 80 files** (unchanged count; 2 tests updated to reflect new contracts).

### Lessons preserved

- **`getFusionTarget` must check slot — tier + affixes alone are insufficient.** The earlier design said "slot kind intentionally ignored" but that produced obviously wrong gameplay. The simpler implementation (direct slot lookup) is also correct.
- **Colored symbols via inline style is fine for a fixed small set.** Five affix kinds, defined once in `AFFIX_COLOR`. No CSS classes needed — inline `style={{ color }}` on the symbol span is clear and co-located with the symbol string.

### Next (carry-overs)

- Four `as unknown as GameStore` casts remain in `WorkshopRoom`, `ConstellationRoute`, `TreeRoute`, `AscensionRoute`.
- Chip-strip spacing for 6-stage tree chips (deferred from prior session).
- Goldsmith class node (`gold_diggers`) playtest pending.

---

## Workshop UI polish + fusion UX overhaul (2026-05-14, session 3)

Continuation session fixing visual bugs surfaced by browser playtesting and overhauling the fusion interaction model.

### What landed

**Visual fixes (3 commits)**

- **Affix symbols + craft button restore** (`e129148`). Introduced `AFFIX_SYMBOL` map in `workshopAffixes.ts` (`$ » ✦ ∞ ⊕`). Item squares now render `{symbol} +{magnitude}%` instead of the raw kind string. `WorkshopRoom.module.css` had three undefined CSS custom properties: `--accent` (→ `var(--gold)`/`var(--inspi)`), `--text-sm`, `--text-lg` (→ literal `12px`/`18px`). These made the craft button invisible and the XP bar blank. TrackCard labels under the canvas now prefix with the matching affix symbol (`$ Sell Price`, `» Speed`, etc.) so the two contexts share a visual vocabulary.
- **Item square sizing** (`d9ad03d`). Squares enlarged 72 → 104 px. Room column widened 340 → 368 px (3 × 104 + 2 × 8 px gap + 24 px padding = 344 px; fits). Affix font 9 → 14 px; tier/slot labels 9 → 12 px.

**Fusion UX overhaul (1 commit, `baaa91e`)**

Old model: inventory item was the fusion trigger (pulsing tier-color glow, click to fuse). New model:
- **Left-click inventory item** → equip (always). **Right-click** → discard. The ✕ hover-button is gone; `onContextMenu` calls `discard(item.id)`.
- **Equipped slot glows rainbow when a same-tier fusion candidate sits in inventory.** Clicking the equipped slot fuses (if affordable) or unequips (if not affordable — avoids trapping the player).
- Rainbow border is a rotating conic gradient via `@property --rainbow-angle` animated from `0deg` to `-360deg` (anti-clockwise). Two background layers on `.equippedFusion`: layer 1 `padding-box` clip restores the tile's inner background; layer 2 `border-box` clip shows the rainbow only in the 2 px border strip. `border-color: transparent` on `.equippedFusion` removes the static tier-colour ring.

**Fusion correctness fixes (2 commits)**

- **Tier gate** (`b5afc6e`). `getFusionTarget` added `&& eq.tier === invItem.tier`. A magic item can no longer fuse with a normal item. Test suite updated: all `fuseItem` action tests had mismatched `inv: magic` / `eq: rare` fixtures — corrected to matching tiers. New test: `"returns null when affix kinds match but tiers differ"`.
- **`slotFusionMap` key fix** (`52ce63f`). The map was keyed by `item.slot` (inventory item's slot) instead of `target.slot` (equipped item's slot). Because `getFusionTarget` ignores slot kinds, a "hat" inventory item can match an equipped "brush". With the wrong key, the rainbow landed on whichever equipped slot shared the inventory item's label (e.g. the magic brush) even though the actual fusion target was the normal hat — making it look like a cross-tier merge. Fix: `map.set(target.slot, ...)` and `map.has(target.slot)`.

### Tests + build

- **775 tests passing across 80 files** (was 774; +1 new tier-gate test).

### Lessons preserved

- **`slotFusionMap` must key on the equipped item's slot, not the inventory item's slot.** `getFusionTarget` deliberately ignores slot kinds (a palette in inventory can fuse with an equipped brush). Any "reverse lookup" from inventory item → equipped slot must use `target.slot`, not `item.slot`, or the rainbow indicator will land on the wrong slot.
- **`@property` + `conic-gradient(from var(--angle))` is the correct rotating-border technique.** `box-shadow` colour cycling looks like a flash, not a rotation. Register `--rainbow-angle` as `<angle>`, animate to `-360deg` for anti-clockwise, use `background-clip: padding-box / border-box` to confine the gradient to the border strip.
- **Undefined CSS custom properties fail silently.** `--accent`, `--text-sm`, `--text-lg` were referenced in `WorkshopRoom.module.css` but never defined in `tokens.css`. Result: invisible button, blank XP bar, wrong font sizes — no build error. Always cross-check new token names against `tokens.css` before shipping.

### Next (carry-overs)

- Four `as unknown as GameStore` casts remain in `WorkshopRoom`, `ConstellationRoute`, `TreeRoute`, `AscensionRoute`.
- Chip-strip spacing for 6-stage tree chips (deferred from prior session).
- Goldsmith class node (`gold_diggers`) playtest pending.

---

## Workshop overhaul + new skill-tree nodes (2026-05-14)

Two back-to-back sessions delivering the workshop overhaul spec (`docs/superpowers/specs/2026-05-14-workshop-overhaul-design.md`, plan `docs/superpowers/plans/2026-05-14-workshop-overhaul.md`) followed by wiring four new designer nodes (`docs/superpowers/plans/2026-05-14-new-skill-tree-nodes.md`). Both runs used subagent-driven execution with two-stage review per task.

### What landed

**Workshop overhaul (Tasks 1–6, 10 commits)**

- **Tier unlock levels and XP** (`95c32d5`). Five-tier ladder: normal unlocks at L1, magic L3, rare L8, epic L20, legendary L40. XP per craft now scales 1/2/3/4/5 by tier. Probability ranges: magic 1–30%, rare 1–15%, epic 0.5–5%, legendary 0.01–1% — all interpolated linearly from unlock level to L100.
- **Tier-scaled affix magnitude ranges** (`a62a61d`). `AFFIX_MAGNITUDE_RANGE` reshaped from flat `Record<AffixKind, {min,max}>` to `Record<ItemTier, Record<AffixKind, {min,max}>>`. Normal 5–15, magic 8–22, rare 13–32, epic 20–44, legendary 38–56 (all ±affix-kind variation). Rolled via `AFFIX_MAGNITUDE_RANGE[tier][kind]` in `workshopRoll.ts`. Office workers hardcoded to `["normal"]` tier magnitudes — they are not item-tier-scaled by design (comment in `officeRoll.ts`).
- **Hat / apron / boots slot kinds + fame nodes** (`38fc1b8`). Three new `SlotKind` values added to `ALL_SLOT_KINDS`. Three new fame nodes (`painters_hat`, `painters_apron`, `painters_boots`) unlock each slot. `getUnlockedSlotKinds` extended. `SLOT_UNLOCK_NODE` map in `WorkshopRoom.tsx` shows locked-slot tooltips with the unlock node name.
- **`Item.fuseCount` + save migration v14 → v15** (`c0ad0e2`). `fuseCount: number` added to `Item`. `performCraft` initialises it to 0. Migration backfills `{ fuseCount: 0, ...item }` (spread order is idempotent) for all inventory and equipped items. All existing 40+ inline `Item` fixture literals across 5 test files updated.
- **Fusion mechanic** (`193b13d`). `getFusionTarget(invItem, equipped)`: finds equipped item whose affix-kind multiset (count + set, order-irrelevant via sort+join) matches `invItem`. Slot kind intentionally ignored. `getFuseCost(equippedItem, workshopLevel)`: `craftCost(level) × 2^fuseCount`. `fuseItem(dropId)`: validates drop → finds target → spends gold atomically → per-affix absorption `pct = 0.05 + rng() * 0.45` ([0.05, 0.50)) → `Math.round` (can be 0 for small magnitudes — intentional) → removes drop, increments fuseCount on equipped item. Known follow-up: `new Map(drop.affixes.map(a => [a.kind, a.magnitude]))` only keeps last magnitude per kind if a drop has duplicate kinds — under-donates in that case.
- **PoE-style Workshop UI rewrite** (`567e3d6`, `67f184e`). 72×72 item squares in CSS Modules. Tier color via `--tier-color` CSS custom property set on `.itemSquare[data-tier="..."]` selectors (scoped to avoid leakage). `fusionCandidate` animation via `@keyframes fusionPulse` using `var(--tier-color)` box-shadow. Discard button visibility via `.itemCell:hover .discardBtn` — critical: `.discardBtn` is a sibling of the Hoverable `<span>`, not a descendant of `.itemSquare`, so the selector must be on `.itemCell`. `craftHoverBody` / `levelHoverBody` use `useGameStore.getState()` (lazy, no hook) since called inside `body()` prop. `fusionTargetMap` memoised over `[inventory, equipped]`. Fusion candidate `data-tier` set to the matching equipped item's tier (not the drop's tier).

**New skill-tree nodes (Tasks 1–4, 4 commits)**

- **`apprentice_pool` removed** (`6efae1d`). Node dropped from `skillTreeDesign.json` by designer. `getMaxInventorySlots` line and stale test deleted.
- **`better_scaling`** (`bfe6694`). `getAffixMagnitudeBonus` in `multipliers.ts` now adds `getNodeLevel("better_scaling") * state.workshopLevel * 1` pp when purchased (1 level max). Signature extended to `Pick<GameStore, "purchasedNodes" | "workshopLevel">`. No call-site changes needed — only caller (`performCraft`) passes full `GameStore`.
- **`socks`** (`f04d4fa`). `getEquippedContribution` in `workshopSlice.ts` now iterates `Object.entries(equipped)` and applies ×1.5 to any affix on the `boots` slot when `socks` is purchased (1 level max). Signature extended to include `purchasedNodes`. All callers in `multipliers.ts` pass `CanvasMultiplierInputs` which already has `purchasedNodes` — no call-site changes.
- **`third_hand`** (`948f35b`). `workshopTick` now computes `interval = 10 × (1 − 0.10 × thirdHandLevel)` before the timer math. L0 = 10 s (unchanged), L5 = 5 s. `freshState()` in tests got `autoCraftTimer: 0` (was missing, causing order-dependent test pollution in the Taylorism block).

**Designer node tree changes (committed separately, `050b4ff`)**

`painters_hat` renamed "Enjoyable Shade" (parent: `painters_apron`, cost 1), `painters_apron` renamed "No More Stains" (parent: `socks`, cost 1), `painters_boots` renamed "Warm Feet" (parents: `monk_internship` + `third_hand`, cost 1). `third_hand` (5 levels) and `better_scaling` (1 level) and `socks` (1 level) added. `basic_technique` numericEffect fixed "1%" → "2%". Node positions updated throughout the workshop cluster.

### Tests + build

- **774 tests passing across 80 files** (was 750 before this batch; +24 net). TypeScript strict clean throughout.

### Lessons preserved

- **`getEquippedContribution` signature must include `purchasedNodes` to support per-slot modifiers.** Before `socks`, the function iterated `Object.values` with no slot awareness. Per-slot scaling requires `Object.entries` + a slot multiplier. Any future "X slot gets bonus Y" node follows this pattern: extend `getEquippedContribution`'s slot-mult logic rather than adding a parallel accumulation.
- **Discard button (or any hover-revealed sibling) needs a wrapper class, not a descendant selector.** `.itemSquare:hover .discardBtn` broke silently when Hoverable wrapped `.itemSquare` in a `<span>`, making `.discardBtn` a sibling. Always wrap the interactive cell in `.itemCell { position: relative }` and use `.itemCell:hover .child` for reveal logic.
- **`Map(affixes.map(a => [a.kind, a.magnitude]))` drops duplicate-kind magnitudes.** In the fusion absorption loop, if a drop has two affixes of the same kind, the Map only keeps the last one. A future fix would sum duplicates. Filed as known follow-up; not a regression (base case is single-affix-per-kind items).
- **`workshopTick` interval should be a variable, not the bare constant.** Adding `third_hand` only required computing `interval` before `Math.floor(next / interval)`. Any future "speed up autocraft" node follows the same pattern: modify `interval` before it's used.

### Next (carry-overs)

- Browser smoke test for workshop overhaul not yet confirmed: 72×72 squares readable, tier glow visible, fusion flow works end-to-end, discard button appears on hover.
- Goldsmith class node (`gold_diggers`) playtest pending.
- Four `as unknown as GameStore` casts remain in `WorkshopRoom`, `ConstellationRoute`, `TreeRoute`, `AscensionRoute`.
- Chip-strip spacing for 6-stage tree chips (deferred from prior session).

---

## Inspiration tree v1.x: 6 stages + auto-grow (2026-05-12)

15 commits delivering the 6-stage inspiration tree expansion specified in `docs/superpowers/specs/2026-05-12-inspiration-tree-expansion-design.md`. Plan: `docs/superpowers/plans/2026-05-12-inspiration-tree-expansion.md`. Subagent-driven execution with two-stage review per task.

### What landed

- **Config rewrite** (`bb2cd08`, `2f9155f`, `59892f3`). 3 stages × 2 parts → 6 stages with variable parts (1/2/2/3/3/4): Tiny Sprout (cotyledon), Bud (tendril, budtip), Leaflet (vein, leaftip "Leaf Tip"), Sapling (twig, branch, leaf), Whisperleaf (softbough, quietleaf, faintvein), Verdant Shoot (greenshoot, lushbough, vividleaf, stalk). Cost/rate curves preserve the prior `×10 between / ×5 within` ratios; unlockThresholds are 0/5/12/25/50/100. Mid-implementation the part id `"leaflet"` was renamed to `"leaftip"` to avoid a collision with the stage id of the same name, and the display name was later set to `"Leaf Tip"` to keep the in-rail labelling unambiguous. The remaining 20-stage roadmap (through Mossling, Sylvan Sapling, … Genesis Arbor → World Tree) is parked in the spec, not yet coded.
- **Auto-stage-up** (`d1d5cce`, `f13696d`, `49ef351`, `386a189`). `growSapling()` stays as the canonical atomic mutator but the manual button is gone. Two trigger points fire it automatically: `buyPartLevel` (immediately after a successful purchase) and `treeTick` (defensive safety-net for post-migration / loaded-qualifying-state). Both use the same `AUTO_GROW_MAX_ITER = 100` guard. `buyAllAffordableTreeParts` cascades through stages naturally since each outer iteration re-reads `state.currentStage`.
- **Save migration v13 → v14** (`7d7ab3b`, `e139238`, `f269fdb`). Wipes `currentStage` (→ 0) and `partLevels` (→ all-zero on the 15 new IDs). Currency, fame, items, workers, PM, lifetime gold, fame nodes, and every other slice are preserved. Returning v13 saves boot into stage 0 with zero levels but full gold — auto-grow rebuilds progression quickly. The TREE_PART_IDS array is documented in-place with one row per stage so future readers don't need to cross-reference `treeStages.ts` to understand the migration.
- **UI cleanup** (`b154bed`, `2560cda`). `StagePanel` drops the `canGrow`/`onGrow` props and the Grow button entirely; the chip strip iterates `TREE_STAGES` for 6 chips. The hover footer became "Stage advances automatically when threshold is reached." and the hover body's threshold-reached line became "Threshold reached — advancing!" (was "Ready to grow!" which implied player agency). `TreeRoute` drops the `growSapling` selector and the `canGrowSapling` import. Dead `.grow` CSS rules removed.
- **TreeScene tier mapping** (`e885469`). 6 stages → 3 sprite tiers via `floor(stage / 2)`: stages 0-1 use the seed sprite, 2-3 use sapling, 4-5 use tree. `getSpriteTier(stage)` clamps at `SPRITE_TIERS.length - 1`, so any future stage 6+ falls back to the tree sprite until new art lands.
- **Stage-up toast** (`23168d5`). `TreeRoute` tracks `currentStage` in a `useRef`; on advance it sets a 2-second toast inside the `.scene` container with name "Grown into {stageName}!" and a CSS-keyframe fade. No new dependencies.

### Tests + build

- **750 tests passing across 80 files** (was 746; +4 net: +3 new auto-grow-on-buy cases, +2 new auto-grow-on-tick cases, +1 new migration case, -2 Grow-button-specific cases that no longer apply).
- `npx tsc --noEmit` clean. `npm run build` clean. Bundle ≈ **164.16 KB gzipped** — essentially unchanged from the 164 KB baseline; well under the 250 KB DoD budget.

### Lessons preserved

- **Two trigger points are cheaper than they look.** Auto-grow guarded by `canGrowSapling(get())` at the end of both `buyPartLevel` and `treeTick`: the action path catches a "buy crossed threshold" event immediately; the tick path catches a "state loaded already qualifying" case (post-migration, balance changes, hand-edited saves). The cost is one O(parts-in-stage) sum per tick — trivial. The pattern is grep-able (`AUTO_GROW_MAX_ITER`) and should be reused when any future auto-advance mechanic ships.
- **Stage IDs and part IDs share a namespace in test/grep, not in code.** When stage 2 was named `"leaflet"` and one of its parts was also id `"leaflet"`, no runtime bug existed (TREE_STAGES[n].id vs partLevels keys are different lookups), but a future tooling pass that built a flat identifier map would silently collide. The fix was the early rename (`leaflet` → `leaftip`) plus a later display-name update (`"Leaflet"` → `"Leaf Tip"`) so the in-rail UI is also unambiguous. **Avoid name-equal-to-parent in nested configs.**
- **Migration that wipes one slice is cheaper than translating it.** Old part IDs (`spark/bud/leaf/branch/bough/crown`) have no mechanical equivalent in the new config. Mapping by total levels or estimating equivalent stages would produce misleading state. Wiping only `currentStage` + `partLevels` while preserving currency/items/workers/fame is graceful: returning players keep their gold income and auto-grow rebuilds tree progression in a few minutes.
- **Toast coalesces across multi-stage advances.** If a single `treeTick` advances the player across two thresholds (rare: stage cascade from a loaded save), the `useRef`-tracked previous value updates between renders and only the final stage's name lands in the toast. Behaviour is benign; document as expected.
- **Player-facing text should match the system model.** The hover body originally said "Ready to grow!" — verb implies player action. After the auto-grow change that's a lie. Renamed to "Threshold reached — advancing!" so the body matches the footer's framing. This text is rarely visible in practice (auto-grow fires synchronously after the threshold-crossing buy, so the "ready" state lasts at most one render frame) but should be correct when seen.

### Next

Open ends:

- **Browser smoke not yet completed.** The dev server is running (started earlier in session). User to verify: (1) buying enough cotyledon flips to Bud automatically with the toast firing; (2) no Grow button anywhere; (3) chip strip readable at 6 wide on the rail (the implementer judged spacing already compact at `var(--s-2)` gap + 11px font, but only browser playtest can confirm); (4) v13 saves migrate to v14 without errors visible in DevTools console.
- **Chip-strip spacing** may need tightening if 6 chips overflow. CSS was not adjusted by the plan; deferred pending playtest.
- **Stages 7+ art and balance** queued for a future wave. The current `×10 between stages` curve is mathematically untouchable past stage 10 or so; that wave needs a new growth curve. Names are pre-authored in the spec.
- The carry-overs from yesterday's HANDOVER stand: Goldsmith class playtest, crit perception verify, four remaining `as unknown as GameStore` escapes.

---

## Tree expansion + tick-loop fix + type-safety guard (2026-05-12)

Seven commits covering one feature batch, one engine bug, and one architectural cleanup that closes a recurring class of bugs.

### What landed

- **"Buy all" button on the inspiration tree** (`8bbded7`). New `buyAllAffordableTreeParts` action in `treeSlice` uses a greedy "cheapest affordable next" loop: each iteration finds the lowest-cost affordable upgrade across all unlocked stages and buys one level, repeating until nothing's affordable. Maximally drains gold (greedy + geometric per-level cost growth = optimal). Capped at 10000 iterations. Button lives in the TreeRoute upgrades header, disabled when nothing's affordable.

- **11 new fame skill-tree nodes + 7 new capability tags** (`8bdf6b6`, `40da6f5`). Filled the underbuilt Office branch and added depth to canvas/inspiration paths. Nodes:
  - Office (5): `gold_diggers` (user renamed from `master_painter`) — `class_goldsmith`; `recruiter` — `queue_slot`; `hire_manager` — `roster_slot`; `accelerator` — `worker_xp_mult`; `bookkeeper` — `hire_cost_reduction`.
  - Canvas-depth (3): `afterburner` — `combo_decay_reduction`; `prismatic_eye` — `crit_gold_bonus`; `expanding_horizon` — `canvas_size_bonus`.
  - Inspiration (2): `enlightenment` — `ascend_threshold_reduction`; `patron` — `inspi_mult_bonus` (parent: `poke_tree`).
  - Workshop (1): `apprentice_pool` — hardcoded inventory slot like the existing chests.
  
  Six new selectors in `multipliers.ts` plus `getCritGoldBonus` wired into `canvasTick`'s crit path. `comboEffectiveChance` and `fameOnAscend` extended with optional decay / threshold-reduction params (backward-compatible defaults). 9 focused tests cover each new capability selector. All new selectors use `countCapability` so authoring more nodes with the same tag stacks linearly.

- **Office black-screen regression fix** (`a66f3fb`). The new `getHireCostMultiplier` reads `state.purchasedNodes`, but QueueCard's helperState (`{ officeLevel } as GameStore`) didn't include it → `countCapability` crashed on `Object.entries(undefined)` → React unmounted. Subscribed to `purchasedNodes` and threaded through useMemo deps. The third instance of this exact bug class (canvas NaN preview, Office black-screen v1, now Office black-screen v2). Triggered the next item.

- **Typed `Pick<GameStore, ...>` selector signatures across the board** (`47f2794`). Closes the `as unknown as GameStore` escape hatch that enabled the recurring helperState bug. Each selector now declares the minimum fields it reads:
  - **`Pick<GameStore, "purchasedNodes">`** — `getNodeLevel`, `hasNode`, `sumLevels`, `hasCapability`, `countCapability`, `getCanvasTrackUnlocked`, `getInspiMultiplier`, `getColorTreeContribution`, `getRainbowMultiplier`, `getSkillTreeSpeedContribution`, `getTreeUpgradeCostMultiplier`, `getAffixMagnitudeBonus`, `getWorkerXpMultiplier`, `getHireCostMultiplier`, `getComboDecayReduction`, `getCritGoldBonus`, `getAscendThresholdReduction`.
  - **`Pick<GameStore, "paintMastery">`** — `getPmMultiplier`.
  - **`Pick<GameStore, "equipped">`** — `getEquippedContribution`.
  - **`Pick<GameStore, "roster">`** — `getOfficeContribution`.
  - **New exported `CanvasMultiplierInputs` type** — union of all fields canvas multipliers read. `getCanvasGoldMultiplier`, `getCanvasSpeedMultiplier`, `getCritChance`, `getComboBaseChance`, `getCanvasSize` all take it. Components (PaintingRoute, StatsRoom) type their helperState as `: CanvasMultiplierInputs` instead of `as unknown as GameStore`. TS now catches missing fields at compile time.
  
  Net result: the three bugs that hit us (canvas NaN, Office black-screen v1, Office black-screen v2) would all have failed to compile under the new guard. Zero `as GameStore` escapes remain in canvas/office UI code.

- **Multi-sale-per-tick fix — crit now actually scales at high speeds** (`f41f4df`, `7003c0b`). Old `canvasTick` fired *exactly one sale per call* and discarded leftover time beyond `effectiveTime`. Result: at high `speedMult` (or any state where `effectiveTime < 16ms` RAF delta), throughput was throttled to 60 sales/sec regardless of underlying speed. Crit (×10 faster) showed no visible gold/sec lift once base canvas was already sub-second — the extra speed had nowhere to go. Now `canvasTick` loops over the deltaSeconds budget, finishing as many canvases as time covers per tick; re-rolls crit/combo each iteration; refreshes state between iterations so PM compounds correctly. Safety cap at 1000 sales/tick. Regression test asserts ≥8× more sales/sec at 100% crit vs no-crit (geometric ~10×) — would fail under the old throttle.

### Tests + build

- **746 tests passing across 80 files** (was 736 before this batch; +10 net for new capabilities + Buy-all + multi-sale + crit regression).
- `npx tsc --noEmit` clean. `npm run build` clean. Bundle ≈ 164 KB gzipped (under 250 KB DoD).

### Lessons preserved

- **`as` casts on partial state are landmines.** Three bugs hit the same pattern (component constructs `{ field1, field2 } as unknown as GameStore`, selector reads a field not in the stub, runtime crash). The fix is to make the cast unnecessary: narrow selector signatures to typed Picks so TS catches mismatches at compile time. Apply the same pattern wherever else `as unknown as GameStore` appears (workshop, constellation, ascension, tree routes still have one each — defer until something breaks).
- **The greedy "cheapest first" sweep is optimal under geometric per-level cost growth.** When a per-level cost grows by a fixed ratio (e.g., ×1.5), buying the cheapest part first always gives more total levels for the same gold than other orderings. The `buyAllAffordableTreeParts` action exploits this.
- **One-sale-per-tick throttles invisibly cap crit / speed late game.** Originally the throttle was a defensive choice ("exactly one sale per tick" was even commented). It's wrong: when `effectiveTime < frameDelta`, the engine is dropping sales. Multi-sale loop with a safety cap is the correct shape. Future content that boosts canvas speed (workers, items, tree nodes) won't silently regress now.
- **Capability tags via `countCapability` make per-level-stacked nodes cheap to add.** Six of the seven new capabilities are pure additive multipliers via `countCapability(state, tag) × constant`. Authoring a new node with the same tag adds another level worth of effect — no engine changes needed. Pattern to keep using for future content.
- **JSON-driven node config means rename-with-content-preservation is free.** User renamed `master_painter` → `gold_diggers` mid-session. Engine reads the capability tag, not the ID; only one test referenced the literal ID and needed updating. Mid-session renames are a natural part of authoring.

### Next

Open ends:
- Goldsmith class node now exists (`gold_diggers`) but unwired in playtest — verify in browser that purchasing it lets Goldsmith candidates trickle.
- Crit-not-working perception bug: user reported it after `f41f4df` shipped. Regression test passes. Probable cause was stale HMR; needs hard-refresh + Stats-tab verification of crit chance. Tracked.
- Four `as unknown as GameStore` casts remain in `WorkshopRoom`, `ConstellationRoute`, `TreeRoute`, `AscensionRoute`. None has triggered a bug yet; leave until one does, then apply the same typed-Pick pattern.

---

## Size rework + review-driven fixes (2026-05-11)

Nine commits after the post-Office polish, driven by a formal `requesting-code-review` pass plus a user-requested Size system rework.

### What landed

- **Review-pass fixes** (`386264b`). Critical: `awardOfficeXp` no longer credits `officeXp` when the roster is empty — spec §4.3 said "emergent from roster activity," but the slice was silently leveling the Office from canvas sales before any worker was ever hired (so a player opening Office for the first time would walk into a fully-tier-unlocked office with fast trickle). Companion test renamed + assertions inverted. Plus integration test for additive stacking across canvas + items + workers (closes the gap where unit tests covered each source in isolation but not their sum). Minors: `useMemo` on StatsRoom `helperState`; `LEVEL_UP_CAP` extracted and dev `console.warn` when it binds on `applyWorkerLevelUps` / `applyOfficeLevelUps`; `screenToSvg` dev-warn on null CTM; explicit L0 guard in `getOfficeTierCap`; one-line comment on `Worker.affixes` shared-ref with `Candidate`.
- **Craftsmanship 5× weaker than designed** (`a90e494`). `workshopSlice.craft` was passing the raw fame-node level (1–5) to `rollAffixes` where it expected percentage points (5–25 from `getAffixMagnitudeBonus`). Selector existed and was correct; the consumer bypassed it and reinvented (incorrectly) the math. At Craftsmanship 5, players were getting +5pp shift instead of +25pp. Fix: `workshopSlice.craft` now calls `getAffixMagnitudeBonus(state)` directly. Regression test added (asserts every rolled magnitude ≥ 27 at L5, which fails under the old bug).
- **CanvasStage hover mislabeled workers as "Colors"** (`2deb828`). The sell-price hover reverse-engineered `colorSum = goldMult / rainbow − 1 − items − sellPrice`. Post-Office, `getCanvasGoldMultiplier` also includes worker contribution, so worker bonuses were displayed under the Colors line. Total was correct; the breakdown lied. Added explicit Workers line + subtracted from colorSum.
- **Size rework — single unified value** (`18a4c32`). Replaces the dual `sizeLevel`/`sizeMult` model. Size is now ONE number, base 1, with all sources contributing additively (canvas size-track level × `SIZE_PER_LEVEL=0.15`, equipped `+size%` items, hired workers' `+size%` affixes, and any future fame nodes via the `+size%` capability). Canvas gold scales as **size²**, canvas time scales as **size** — so doubling size quadruples gold and doubles time, making bigger canvases strictly more efficient per second (gold-per-second = (BASE/TIME_BASE) × size, linear and unbounded). Replaces `SIZE_GOLD_PER_LEVEL` + `SIZE_TIME_PER_LEVEL` with the single `SIZE_PER_LEVEL`; `canvasGold(size, multiplier)` and `canvasTime(size)` shed the `sizeMult` parameter; `getSizeMultiplier` becomes `getCanvasSize`. All consumers updated: `canvasSlice`, `PaintingRoute`, `CanvasStage` hover, `StatsRoom` Size block (now Base / Canvas / Items / Workers + Gold factor (size²) + Time factor (size)). The user's choice: +15% per level, additive composition, gold chain `BASE × size² × sellMult × PM × combo`.
- **Three follow-up size fixes**:
  - `651a3e3`: `PaintingRoute.helperState` was missing `sizeLevel`, so the canvas's "next sale gold" preview rendered `(e^NaN)NaN`. Added.
  - `bbd12d7`: canvas title showed "Tier 18 · Tier 18" past size 10 because `STAGE_NAMES` only covers 0–10 and the fallback `Tier N` collided with the title's "Tier N · " prefix. Title now reads `— {stageName} —` only; tier number stays in `tierBadge` below.
  - `a591ddc`: removed `ScalingMathPanel` from the bottom info bar. The same scaling info now lives in the Stats tab with cleaner breakdowns.

### Tests + build

- **736 tests passing across 80 files** (was 738 after the post-Office polish; net −2 from removing the ScalingMathPanel suite, +5 from integration / Craftsmanship / size tests).
- `npx tsc --noEmit` clean. `npm run build` clean. Bundle ≈ 162 KB gzipped JS (under 250 KB DoD).

### Lessons preserved

- **Selectors-that-wrap-math are the contract; consumers must call them.** Craftsmanship's bug was the canonical anti-pattern: a selector (`getAffixMagnitudeBonus`) existed and did the right math, but `workshopSlice.craft` bypassed it and recomputed (wrong) inline. The pattern is now grep-able: any direct `getNodeLevel(state, "<id>") * constant` outside `multipliers.ts` is a smell. A quick repo-wide sweep after each new selector lands would catch this.
- **Reverse-engineered breakdowns are stale-by-default.** `CanvasStage.sellHoverBody` derives `colorSum` by subtracting known sources from the total multiplier. When a new source (Office workers) lands in the multiplier function, the breakdown lies until someone explicitly subtracts the new source. Better pattern: `StatsRoom` adds each source as an explicit line (additive construction). The mislabel will recur whenever something new gets wired into `getCanvasGoldMultiplier` and CanvasStage isn't updated.
- **Spec §4.3 "emergent from roster activity"** is the design promise. `awardOfficeXp` violated it silently because canvas-sale path calls it unconditionally. The guard belongs in the action itself, not the caller — a single early return is more robust than asking every future caller to remember the precondition.
- **Single-value models beat dual-axis models for player-facing concepts.** The dual `sizeLevel` (integer canvas upgrade count) + `sizeMult` (fractional items+workers multiplier) was technically correct but conceptually muddled — adding the two via "+30%" / "+10%" breakdown looked additive but actually compounded. The unified `size` value with `size²` gold and `size` time is harder to *implement* (multi-file refactor) but easier to *reason about* (one number, one formula).
- **`helperState` is a maintenance liability.** Several consumers construct `as unknown as GameStore` stubs with hand-picked fields. When a new selector lands that reads a different field (e.g., `getCanvasSize` now reads `state.sizeLevel`), every helperState in the codebase silently breaks. The `(e^NaN)NaN` regression came from exactly this. Worth considering a typed helper like `subsetGameStore(...)` that errors at compile time when fields are missing — but YAGNI for now.

### Next

The Stats panel surfaces canvas-axis multipliers only; PM and inspi-mult are still invisible there. Goldsmith class remains unauthored (no fame node grants `class_goldsmith`). The `helperState` pattern noted above is fragile and would benefit from a typed helper if/when it bites again.

---

## Post-Office playtest polish (2026-05-11)

Nine commits after Painter's Office landed. Each surfaced from in-session browser playtesting.

### What landed

- **Build break fixed** (`5622d3c`). Task 19 left 4 `TS2532` errors in test files that broke `tsc -b` but not `tsc --noEmit`. Added `!` non-null assertions on `s.queue[0]` / `s.roster[0]` / `s.roster[1]` indexed access. `npm run build` now passes; bundle ≈ 160 KB gzipped JS (under 250 KB DoD budget).
- **Constellation pan + zoom + MiniMap viewport** (`e53b85d`, `8ef26b9`, `5cafabf`, `477acb5`, `71f34eb`). New `viewport.ts` pure module with `clampZoom`, `clampPan`, `zoomAt`, `panBy`, `centerOn`; shared viewport state in `ConstellationRoute` drives both the interactive `<StarCanvas>` and the `<MiniMap>` indicator. Wheel = cursor-anchored zoom (non-passive listener, `preventDefault`-ed); left-drag = pan; double-click = reset. Drag-vs-click discrimination via 3px movement threshold + `onClickCapture`. MiniMap renders a translucent stroked rect at the current viewport bounds and supports click-to-jump (centers the main view there). VIEWBOX is now computed from the actual node bounding box plus 880 px of margin (80 padding + 800 future growth), so the whole tree fits at default zoom and there is room for new nodes in every direction.
- **Constellation pan-clamp evolution**. Initial strict clamp (entire viewport must sit inside VIEWBOX) made dragging dead at zoom 1; relaxed to "viewport center inside VIEWBOX" (gave ±half-viewport pan room); then added `PAN_BLEED = 1` so the user can drag past VIEWBOX bounds by a full extra viewport in every direction. Three iterations because each smaller fix surfaced a tighter UX expectation the next playtest.
- **Skill tree merge** (`76b8716`). Designer's localStorage draft predated subproject 2's capability tags, so saving from it stripped `size_matters` / `big_picture` / `genius_episode` / `consistency` / `fast_learner` / `unrelentless` from the JSON — permanently locking the canvas Size/Crit/Combo tracks. Merged the 6 lost nodes back into the user's new layout, keeping their additions (`monk_internship`, `entrepreneur`, `education`, `free_will`) and fixing `entrepreneur`'s capability from the bogus `"Office_tab"` to `["roster_slot", "queue_slot"]`. Layout positions later refined (`a7f6072`).
- **Office tab crash fix** (`ac4a37d`). `QueueCard` used `useGameStore(s => getHireCost(s, candidate))` — selector returned a fresh `Big` instance each call → Zustand "getSnapshot should be cached" → max-update-depth → React unmounted the tree → blank dark screen. Fixed by pulling `officeLevel` as a primitive and computing the Big inside `useMemo` keyed on `(officeLevel, candidate)`.
- **Stats tab** (`d740cc1`, `b7fd3eb`, `d6357b1`). New right-rail tab below Lab in `RoomRail`, always enabled. `StatsRoom.tsx` shows each canvas-axis multiplier (Sell Price / Speed / Crit / Combo / Size) with a per-source breakdown: Canvas upgrade, Skill tree, Items, Workers. Multiplicative lines (Rainbow, Size factor) render below the additive ones; the displayed total reflects the full multiplicative product. Three new helper selectors in `multipliers.ts` — `getColorTreeContribution`, `getRainbowMultiplier`, `getSkillTreeSpeedContribution` — wrap previously-private logic for UI use without duplicating it. Size handling is a special case: the canvas Size upgrade is a *multiplier on the sell-price additive sum*, not an additive contribution to it, so Size shows up in two places — its own block (with canvas/items/workers lines) and as a multiplicative line in the Sell Price block.
- **Scrollbars styled** (`5b699f1`). Thin 8 px scrollbars on `--bg-stone-d` tracks with `--ink-line` thumbs (hover lightens to `--ink-3`). Applied globally in `src/index.css`. Covers all scrollable panels including StatsRoom, OfficeRoom, WorkshopRoom, and dev tools.

### Tests + build

- **738 tests passing across 81 files** (was 725 after the Office handover; +13 net for `viewport.test.ts`).
- `npx tsc --noEmit` clean; `npm run build` clean; bundle ≈ 160 KB gzipped JS.

### Lessons preserved

- **Zustand selectors that return fresh objects each call cause infinite loops.** When a selector wraps a function that constructs a new `Big` / array / object per call, Zustand sees a new identity every render and re-runs the selector forever. Fix: subscribe to the primitive inputs (state field) and compute the derived object via `useMemo` keyed on those inputs. The error surfaces as "The result of getSnapshot should be cached" → max-update-depth → blank dark screen because React unmounts the tree.
- **localStorage drafts in dev tools can shadow file edits silently.** The SkillDesigner's `loadDraft()` reads `localStorage` first and only falls back to the JSON file when storage is empty. After we updated the JSON in tree on disk, the editor kept loading the stale draft. The editor has no "Reload from file" button; the recovery path is manual (`localStorage.removeItem('artdle:skill-design:draft')` + refresh). Worth adding the button if this pattern bites again.
- **Pan/zoom clamps trade safety for vibe.** Strict bounds (viewport must stay inside content) feel dead at default zoom; relaxed bounds (allow over-pan into empty space) feel alive. The right balance is content-aware: compute the content bounding box, then add explicit "future growth" margin around it, then let the user pan-bleed up to one viewport beyond that margin. Three constants make the intent legible: `PADDING` (breathing room around current nodes), `FUTURE_GROWTH` (empty space for additions), `PAN_BLEED` (over-pan ratio).

### Next

Open ends from this session: Goldsmith class still has no fame node granting `class_goldsmith` (only Speedrunner is reachable via `free_will`); user can author one in the designer when ready. The Stats tab covers canvas-axis multipliers but doesn't yet surface PM mult or inspiration mult — could be added if it'd be useful in playtesting.

---

## Painter's Office (shipped on `main`, 2026-05-11)

**Status:** Shipped. Subproject 3 of 3 in the Painter's Office decomposition. The passive idle counterpart to the Workshop: a trickle queue of rolled worker candidates, Hire/Reject/Fire decisions, per-worker geometric XP levelling, and an Office Level meta-progression that survives ascend. Workers buff the single canvas through the same shared affix pool as the Workshop, wired additively into every multiplier.

**Plan:** `docs/superpowers/plans/2026-05-11-painters-office.md`. **Spec:** `docs/superpowers/specs/2026-05-10-painters-office-design.md`.

### What landed

- **Balance constants + formulas** (`core/balance.ts`): `workerXpToNext(level)` geometric scale, `officeXpToNext(level)` for Office Level, `trickleSeconds(officeLevel)` trickle rate, `hireCost(officeLevel, candidate)` gold cost, `computeOfficeTierProbabilities(officeLevel)` weighted tier roll, `OFFICE_TIER_AFFIX_COUNT`, `OFFICE_TIER_UNLOCK_LEVEL`, `XP_GOLD_FRACTION`, `levelScale`.
- **Class config** (`config/officeClasses.ts`): `generalist`, `goldsmith`, `speedrunner` classes with per-kind weight ranges (e.g., Goldsmith `+sell_price% [3,7]`, Speedrunner `+speed% [3,7]`); `GENERALIST_CLASS_WEIGHT = 3`, `SPECIALIST_CLASS_WEIGHT = 1`. Classes gated by capability tags (`class_goldsmith`, `class_speedrunner`).
- **Roll engine** (`core/officeRoll.ts`): `rollWorkerClass` (capability-gated weighted pool), `rollWorkerWeights` (per-kind weight tuple with reroll-on-all-zero guard), `rollWorkerAffixes` (weighted pick sampling capability-filtered kinds), `rollCandidate` (full pipeline composing class → weights → affixes → tier). Weight tuple is ephemeral — not stored on the worker.
- **`officeSlice`** (`store/officeSlice.ts`): state (`officeLevel`, `officeXp`, `queue`, `roster`, `trickleTimer`), actions (`tickOffice`, `hireFromQueue`, `rejectFromQueue`, `fireWorker`, `awardOfficeXp`, `resetOffice`), selectors (`getRosterCap`, `getQueueCap`, `getClassUnlocked`, `getOfficeTierCap`, `getHireCost`, `getOfficeContribution`). `getRosterCap` / `getQueueCap` delegate to `countCapability` so each level of a user-authored fame node contributes +1 slot.
- **Ascend hook** (`systems/ascend.ts`): `resetOffice()` call wipes queue + roster + trickleTimer while preserving `officeLevel` and `officeXp`.
- **Save migration v12 → v13** (`store/index.ts`): seeds new office fields at defaults; `officeLevel` and `officeXp` intentionally preserved if already present. `SAVE_VERSION` bumped to 13.
- **Multiplier wiring** (`core/multipliers.ts`): `getOfficeContribution(state, kind)` sums `affix.magnitude` across all roster workers' affixes for a given `AffixKind`. Wired additively into `getCanvasGoldMultiplier`, `getCanvasSpeedMultiplier`, `getCritChance`, `getComboBaseChance`, and `getSizeMultiplier`.
- **SkillDesigner chips** (`dev/skillDesigner`): quick-add chips for `roster_slot`, `queue_slot`, `class_goldsmith`, `class_speedrunner` extend the subproject-2 chip set.
- **UI panel components** (`components/painting/`): `OfficeRoom.tsx` (340 px right-rail panel), `OfficeLevelHeader.tsx` (level + XP bar + tier cap + trickle period), `QueueCard.tsx` (candidate display with Hire/Reject), `WorkerCard.tsx` (roster member with affix list + Fire button), `FireConfirmModal.tsx` (confirmation modal). CSS via `OfficeRoom.module.css` (mirroring Workshop CSS convention).
- **RoomRail switching** (`components/painting/RoomRail.tsx` + `routes/PaintingRoute.tsx`): `RoomRail` accepts `activeRoom` + `onSelect` props; Office tab shows when `getRosterCap(state) >= 1` (at least one fame node with `roster_slot` purchased). `PaintingRoute` holds local `activeRoom` state and conditionally renders `<OfficeRoom>` vs `<WorkshopRoom>`.

### Tests + build

- **725 tests passing across 80 files** (was 663 before this subproject; +62 net). Tests cover balance formulas, roll engine (rollWorkerClass, rollWorkerWeights, rollWorkerAffixes), officeSlice actions + selectors, XP levelling, ascend integration, and multiplier contribution.
- `npx tsc --noEmit` clean. `npm run build` (`tsc -b`) fails on 4 pre-existing `TS2532` ("Object is possibly 'undefined'") errors in `tests/store/officeSlice.test.ts:118` and `tests/store/officeSlice.xp.test.ts:21,22,38` — `noUncheckedIndexedAccess` on `s.queue[0]` / `s.roster[0]` / `s.roster[1]`. Fix is 4 non-null assertions (`!`) or narrowing guards; deferred as out-of-scope for Task 19 (`Modify only: docs/HANDOVER.md`). Bundle size could not be measured (build blocked by these errors). Prior task sweeps ran `npx tsc --noEmit` (excludes test project refs) but not `npm run build`, which is why the errors were not caught earlier.

### Lessons preserved

- **`countCapability` is the levelled sibling of `hasCapability`.** When a capability needs to contribute a quantity (roster slots, queue slots) rather than a boolean, `countCapability` sums `node.level` across all nodes tagging that capability. This parallelism is now explicit in `skillTreeSlice.ts` and should be the pattern for any future count-based capability.
- **Per-worker random weight profiles are ephemeral; only the rolled affixes are stored.** `rollWorkerWeights` produces a per-kind weight tuple consumed immediately by `rollWorkerAffixes` and then discarded — it is never stored on the `Worker` record. The variance surfaces through the affix list the player sees. Don't be tempted to store weights for display: the spec's decision was "naturally surfaces through the rolled affix list."
- **`Big`-vs-`number` boundary lives at the multiplier return, not inside the contribution sum.** `getOfficeContribution` sums `affix.magnitude` (plain JS numbers) and returns a raw number; `getHireCost` operates on a `Big` result from the start because the hire cost formula mixes `officeLevel`-based scaling with a `Big` floor. The boundary rule: use `Big` when the value itself can exceed `Number.MAX_SAFE_INTEGER` or is monetary/inspiration-scale; keep contribution sums as numbers since magnitudes are bounded small integers.

### Next

All prerequisites for v1.x Office feature extensions are in place: capability-tag gating, `countCapability` for slot caps, per-worker affix system, multiplier wiring, save migration. Future waves can add new worker classes, tier expansions, or Office Level perks by authoring fame nodes and extending class config — no engine changes required.

---

## Post-shipping polish (2026-05-10, after affix-pool-rework)

Seven commits of in-session playtest fixes after subprojects 1 + 2 landed. Each surfaced during browser testing.

### What landed

- **`+size_gold_per_level%` renamed to `+size%`** (`7f55fb8`). User feedback: the long name was unnecessary "shenanigans" — the mental model is just "bigger canvas = more gold + more time," so the affix is `+size%` and scales the *effective sizeLevel* symmetrically. Both gold AND time formulas now consume `getSizeMultiplier(state)` (renamed from `getSizeGoldPerLevelMultiplier`). `canvasTime(sizeLevel, sizeMult = 1)` gained an optional 2nd arg matching `canvasGold`'s shape. Save migration **v11 → v12** wipes inventory + equipped (old magnitudes don't translate; gameplay implications changed).
- **ScalingMathPanel reflects `sizeMult`** (`84d0a03`). Reference panel's gold + time formulas display `× sizeMult` so the math stays accurate when `+size%` items are equipped.
- **Crit RNG bug fixed** (`d95fdcd`). canvasTick rolled crit only when `canvasProgress === 0`, but after a sale the slice sets `canvasProgress: leftover` (typically > 0). So the gate failed on every canvas after the first → players never saw crits even at high crit chance. Fix: roll the next canvas's crit **inside the sale path itself** rather than waiting for the next tick's progress-=-0 check.
- **Per-kind affix magnitude ranges** (`4f0e7e5`). Old uniform `5..15` range across all 5 kinds was unbalanced — `+crit_chance%` is non-linearly strong (10× speed on hit compounds at stack) and `+combo_chance%` is weak (fixed +10%/link with decay). New `AFFIX_MAGNITUDE_RANGE` record per kind:
  - `+sell_price%` / `+speed%` / `+size%`: 5..15 (baseline)
  - `+crit_chance%`: 2..8 (smaller pp)
  - `+combo_chance%`: 5..20 (wider pp)
  Targets rough EV equivalence at 5-legendary stacking (~1.5..1.75× output multiplier across kinds).
- **Progress bar rubberband fix** (`45256d6`). The `.fill` and `.progressFill` divs had CSS transitions (200ms/100ms) that animated DOWN when progress snapped from ~100% → ~leftover% on sale. Fix: key both divs by `canvasNumber` (= `lastSale.id`); React re-mounts on sale, CSS transitions restart from 0. No CSS changes — the transitions stay (they're what makes in-canvas filling smooth); only the re-key timing changed.
- **PM uncapped** (`a8cfa7f`). Two caps were limiting Paint Mastery:
  - `pmFromLifetime` had a 30-iteration loop bound (~10^93 lifetime gold ceiling, ~30k PM).
  - `pmMult` called `pm.toNumber()` → saturated at `Number.MAX_SAFE_INTEGER` (~9e15) → multiplier capped at ~81.
  
  Fixes: loop bound 30 → 100 (covers ~10^303, practical infinity); `pmMult` switches to `pm.add(1).log10().toNumber()` (break_eternity's native `.log10()` operates on the Big directly, no precision loss). At PM = 1e20, mult ≈ 101. At 1e50, ≈ 251.
- **PM scaling linearized** (`ab2db71`). Even with the cap removed, players hit PM ~1000 at lifetime gold 1M and saw it freeze: the phase-ratcheting design made each next +1 PM cost another 1M gold (then 1B, then 1T, ×1000 per phase). Replaced with **linear `PM = floor(lifetimeGold / 1000)`** forever. Continuous growth: every 1000 g of lifetime earnings → +1 PM, regardless of how high lifetime gold goes. Existing PM values preserved across the change; only the formula that grows PM changed. `pmFromLifetime` body collapsed from 30-iteration phase loop to a single `.div(1000).floor()`; `pmThreshold` now constant `1000`. The PM mult curve (`1 + 5 × log10(PM + 1)`) still does the smoothing — log of linear = log of lifetime gold, asymptotically gentle without phase plateaus.

### Tests + build

- **663 tests passing** (was 680; net –17 from removing phase-ratcheting test cases that no longer apply). All new linear-PM behavior covered.
- tsc clean. Lint clean. Bundle: ~157 KB gzipped JS (negligible drift). Under the 250 KB DoD budget.

### Lessons

- **State transitions need explicit reset triggers.** The crit bug came from assuming "the next tick's canvasProgress === 0 check will fire" — but the sale path sets canvasProgress to `leftover` (positive). When state convention is "this flag triggers re-roll," the re-roll must happen at the boundary where the next-state is constructed (the sale path), not deferred to a future tick that depends on a fragile invariant.
- **CSS transitions + React keys = clean visual reset.** When a value should "snap" on a discrete event but smoothly animate otherwise, key the element by an event counter. React replaces the DOM node, transitions restart. Cleaner than conditional transition disabling.
- **`break_eternity.js` has Big-native log/exp/etc.** When stacking caps come from `pm.toNumber()` → JS-number saturation, switch to `pm.log10()` / `pm.exp()` etc. — the Big stays in precision through the operation, only the final return value drops to a JS number.
- **Phase-ratcheting designs read as "capped" to players.** A 1000× ratchet between phases makes each phase boundary a wall — players hit it, watch PM stall, and call it broken. Two layers of curve-shaping (phase ratchet + log multiplier) double up on the smoothing and produce flat plateaus. One log-shaper is enough; let the underlying input grow linearly and let `pmMult`'s log do the rest.

---

## Affix pool rework + capability tags (shipped on `main`, 2026-05-10)

**Status:** Shipped. Subproject 2 of 3 in the Painter's Office decomposition. The workshop affix pool is rewritten to match the canvas-depth axes; the 3 advanced affixes are gated at craft-time by capability tags on user-authored skill-tree nodes (so node IDs are free-form game-design choices, not engine constraints).

**Plan:** `docs/superpowers/plans/2026-05-10-affix-pool-rework.md`. **Spec contract:** §6 of `docs/superpowers/specs/2026-05-10-canvas-depth-design.md`.

### What landed

- **`AffixKind` enum** rewritten: `+canvas_gold% / -paint_time%` → `+sell_price% / +speed% / +crit_chance% / +combo_chance% / +size_gold_per_level%` (5 kinds total). Magnitude range still 5–15% per affix; Craftsmanship skill-tree node still shifts both bounds.
- **Multiplier consumers** all wired:
  - `+sell_price%` → `getCanvasGoldMultiplier` (additive, alongside item bonus + colors + sell-price level + rainbow)
  - `+speed%` → `getCanvasSpeedMultiplier` (additive, alongside basic_technique / muscle_memory / speed level)
  - `+crit_chance%` → `getCritChance` (additive, clamped at 1.0)
  - `+combo_chance%` → `getComboBaseChance` (additive, clamped at 1.0)
  - `+size_gold_per_level%` → new `getSizeGoldPerLevelMultiplier` (multiplicative on `SIZE_GOLD_PER_LEVEL` inside `canvasGold(sizeLevel, mult, sizeGoldMult)` — extended with optional 3rd arg)
- **`getPaintTimeMultiplier` deleted** entirely — its non-linear `v / (1 - v)` magnitude conversion was unintuitive; new `+speed%` stacks additively. canvasTick + PaintingRoute simplified accordingly.
- **Roll-time gating via capability tags:** `rollAffixes(tier, state, magnitudeBonus)` takes state, filters the pool by `getCanvasTrackUnlocked`. The 3 advanced affixes only roll when the corresponding canvas track is unlocked. No wasted rolls.
- **Capability-tag system** (the architectural unlock):
  - `SkillNodeConfig` gains `readonly unlocks: ReadonlyArray<string>`. Default `[]` for nodes without the field.
  - New selector `hasCapability(state, capability)` — scans purchased nodes (level ≥ 1) for any whose `unlocks` array contains the capability string.
  - `getCanvasTrackUnlocked(state, "size" | "crit" | "combo")` → delegates to `hasCapability(state, "canvas_<trackId>")`. Sell price + speed return `true` unconditionally (always-unlocked tracks).
  - Engine reads capability strings, never node IDs. **Node naming is now a pure game-design decision.**
- **Existing user-authored nodes tagged:**
  - `size_matters` → `unlocks: ["canvas_size"]`
  - `genius_episode` → `unlocks: ["canvas_crit"]`
  - `unrelentless` → `unlocks: ["canvas_combo"]`
  - `gear_up` continues to use its hardcoded ID for the palette slot — left untouched in this subproject (could be migrated to `unlocks: ["palette_slot"]` later for consistency).
- **`/dev/skill-designer` UI** updated: each node form exposes the `unlocks` field as a comma-separated text input + 4 quick-add chips (`canvas_size`, `canvas_crit`, `canvas_combo`, `palette_slot`). Storage migrates legacy nodes to `unlocks: []` automatically.
- **Workshop UI:** `WorkshopRoom` affix label map updated for the 5 new kinds (`+X% sell price`, `+X% speed`, `+X% crit chance`, `+X% combo chance`, `+X% size gold/level`).
- **Canvas hover body:** `<CanvasStage>` `sellHoverBody` references the new affix names; the gold breakdown now includes a separate "Sell Price (Lv N)" line and the base-gold formula factors in `sizeGoldMult`. Combo line appears when chain > 0.
- **Save migration v10 → v11:** wipes inventory + equipped (game unreleased; magnitudes from `-paint_time%` don't translate cleanly to `+speed%`). Workshop level + XP preserved (long-tail meta).

### Tests + build

- **671 tests passing across 76 files** (was 653 after canvas-depth; +18 net for affix pool + capability tags).
- tsc clean. Lint clean (only pre-existing `main.tsx` warning).
- Bundle: **157.30 KB gzipped JS** (was 156.37 KB; +0.93 KB). Under the 250 KB DoD budget.
- 14 commits from `5b568a3` (plan) → `3a7b5d7` (capability-tag refactor).

### Lessons preserved

- **Node IDs are game-design, not engine concerns.** When the user pointed out that the engine's hardcoded `unlock_canvas_*` IDs forced their node naming, the right fix was to introduce a capability-tag layer — the engine reads what it needs, the designer names nodes thematically. The `unlocks: string[]` field is the API.
- **`getEquippedContribution(state, kind)` already returns fractional sums.** Five new consumers added; none accidentally double-divides by 100. The convention is documented inline in `workshopSlice.ts` at the function definition.
- **Migration wipes are fine pre-release.** Magnitudes from `-paint_time%` (where `v / (1 - v)` math applied) don't translate to `+speed%` (where additive applies). Wipe is the practical move; v9 → v10 (canvas-depth) and v10 → v11 (this subproject) both wipe with rationale.

### Next

Subproject 3 — Painter's Office. Sketch design at `docs/superpowers/specs/2026-05-10-painters-office-design.md`; numbers TBD until this subproject's affix pool is in production. Now that pool exists, the Office spec can resolve its TBDs and become plan-ready.

---

## Canvas depth — 5 upgrade tracks (shipped on `main`, 2026-05-10)

**Status:** Shipped. Subproject 1 of 3 in the Painter's Office decomposition (see `docs/superpowers/specs/2026-05-10-painters-office-design.md` for the parked Office sketch). The canvas's single `canvasTier` upgrade is replaced by **5 independent upgrade tracks**, each levelled in gold; sell-price + speed unlocked from start, size + crit + combo gated by user-authored fame skill-tree nodes.

**Spec:** `docs/superpowers/specs/2026-05-10-canvas-depth-design.md`. **Plan:** `docs/superpowers/plans/2026-05-10-canvas-depth.md`.

### What landed

- **5 tracks, each with its own gold-cost curve `BASE × 1.5^currentLevel`:**
  - **Sell Price** (unlocked from L1, `+10%` gold per level, base cost 100g)
  - **Speed** (unlocked from L1, `+5%` speed per level, base cost 100g)
  - **Size** (gated, `+30%` gold AND `+15%` time per level — net positive, base cost 1000g, replaces the old tier² scaling)
  - **Crit** (gated, `+1%` chance per level, fixed 10× speed on hit i.e. "90% faster", base cost 5000g)
  - **Combo** (gated, `+2%` base chain chance per level, fixed `+10%` gold per chained link, decay -5pp per current link, base cost 5000g)
- **Schema:** `CanvasState` drops `canvasTier`; adds `sellPriceLevel`, `speedLevel`, `sizeLevel`, `critLevel`, `comboLevel`, `comboChain`, `isCritThisCanvas`. All 5 levels + chain reset on ascend (Workshop pattern: only the institution survives, not the run-state).
- **Track unlocks** read by `getCanvasTrackUnlocked(state, trackId)` from `skillTreeSlice`. Engine recognises 3 well-known fame node IDs the user authors via `/dev/skill-designer`:
  - `unlock_canvas_size`
  - `unlock_canvas_crit`
  - `unlock_canvas_combo`
  Each grants `+1 unlock` (level ≥ 1 = unlocked). Until purchased, the matching TrackCard renders Locked and the action no-ops.
- **`canvasTick` rewrite:** Crit rolled at canvas start (when `canvasProgress === 0`) and stored in `isCritThisCanvas` for the canvas's lifetime; effective time = `canvasTime(sizeLevel) / (speedMult × critFactor)`. On sale, gold = `canvasGold(sizeLevel, mult) × comboBonusFactor(comboChain)` (combo applies the PRIOR chain). After sale, combo rolls with `comboEffectiveChance(base, chain)` decay; chain extends on hit, resets to 0 on miss. `isCritThisCanvas` resets to `false` on sale.
- **Multipliers:** `getCanvasGoldMultiplier` adds `SELL_PRICE_PER_LEVEL × sellPriceLevel` to the additive bonus alongside item affixes + color tree. `getCanvasSpeedMultiplier` adds `SPEED_PER_LEVEL × speedLevel`. New: `getCritChance(state)` and `getComboBaseChance(state)`, both clamped at 1.0.
- **`<TrackCard>`** parameterised tile renders 5 cells in `<CanvasUpgradesStrip>` (the 5-cell grid that v2.0 left empty for this). Locked variant for gated tracks. Hover info via `<Hoverable>` shows `<Track> — Level N` + current effect + next-level cost (or "Locked" + skill-tree prompt).
- **`<CanvasStage>`** prop renamed `tier` → `sizeLevel`; gains `comboChain` + `isCrit` props. New badges: 🔥 ×N (top-left, when chain > 0) and CRIT pulse (top-right, when current canvas crits).
- **`<TierCard>`** component deleted. `tierUpgradeCost`, `MAX_TIER`, `TIER_UPGRADE_BASE`, `TIER_UPGRADE_RATIO` removed from `balance.ts`. `upgradeTier` action removed from `canvasSlice`.
- **`<ScalingMathPanel>`** updated for the new model: gold formula shows `10 × (1 + 0.30 × sizeLevel) × Xx`, time shows `2 × (1 + 0.15 × sizeLevel)s ÷ Xx`, "Tier Upgrade Cost" replaced by "Sell Price Upgrade (Lv N)".
- **Save migration v9 → v10:** drops `canvasTier`, seeds the 7 new fields with defaults. Game unreleased; no translation of the old 1–10 tier onto the new tracks per spec §8.
- **Affix pool unchanged** in this subproject. The §6 contract (sell_price / speed / crit_chance / combo_chance / size_gold_per_level affix kinds) is reserved for **subproject 2 (affix pool rework)**.

### Tests + build

- **653 tests passing across 76 files** (was 628 baseline; +25 net).
- tsc clean. Lint clean (only pre-existing `main.tsx` warning).
- Bundle: **156.37 KB gzipped JS** (was 156.34 KB; effectively flat). Well under the 250 KB DoD budget.
- 19 commits from `7eb8766` (plan) → `fb65579` (final fix from end-of-impl review).

### Post-merge actions

1. **Author the 3 fame skill-tree unlock nodes** via `/dev/skill-designer`. Engine recognises `unlock_canvas_size` / `unlock_canvas_crit` / `unlock_canvas_combo` (any level ≥ 1 = unlocked). Set fame costs to taste — these gate the 3 advanced tracks.
2. **Subproject 2 — Affix pool rework.** Spec handshake at `2026-05-10-canvas-depth-design.md` §6: rename `canvas_gold` → `sell_price`, `paint_time` → `speed`, add `crit_chance` / `combo_chance` / `size_gold_per_level` kinds. Update workshop affix rolling + `multipliers.ts` to consume the new kinds. New `SAVE_VERSION` bump.
3. **Subproject 3 — Painter's Office.** Sketch design in `2026-05-10-painters-office-design.md`; numbers TBD until subproject 2 ships.

### Next

Subproject 2 (affix pool rework) — see §6 of the canvas-depth spec for the exact contract.

---

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
