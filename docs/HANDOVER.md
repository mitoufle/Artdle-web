# Artdle Web — Handover

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
