# Phase 6 — Ship v1.0

**Date:** 2026-05-03
**Status:** Spec — pending plan + execution
**Predecessors:** Phases 0+1+2+3+4+5 shipped. Phase 5 cross-cutting carry-overs (C-1 testid, C-2 invariant JSDoc) addressed. Repo at 239/239 tests, 82.77 KB gzipped, 24 commits ahead of `origin/main`.

---

## 0. Provenance — decisions made in this brainstorm

- **Methodology:** option B — playtest-iterate. Phase 6 splits into **6a** (planned upfront, no playtest needed) → **playtest pause** (~30-60 min on a fresh save) → **6b** (planned post-playtest, balance + affix tuning informed by playtest findings).
- **Polish carry-overs from Phase 2 final review:** bundle #1 (`.flush().catch()`), #2 (no-op telemetry hook scaffold), #5 (consolidate `visibilitychange` to one orchestrator). Defer #3 (canvas test 9 dedupe) and #4 (split `tickAll`'s 3-assertion test) to a future test-cleanup window — they don't deserve a v1.0 commit slot.
- **Motion targets:** all 4 — the 3 named in PORT_PLAN §5.13 (floating gold-text on canvas finish, tree stage transition fade, fame increment pulse on ascend) plus the optional WorkshopPopup mount/unmount fade. The popup fade is the cheapest of the four (~5 lines) and the C-1 testid fix exists specifically so this lands friction-free.
- **Closing mechanics (treated as checklist, not brainstorm decisions):**
  - README scope: B (player + dev, ~150 lines, with 2-3 screenshots).
  - Screenshots: Claude takes them via `npm run dev` during 6a's deploy-verification step; user can swap them later from a real play save if desired.
  - Push to `origin/main`: at end of 6a, before the playtest pause, so the v1.0-RC repo is review-able on GitHub during playtest.
  - Tag `v1.0`: pushed annotated tag (`git tag -a v1.0 -m "..."` + `git push --tags`) at end of 6b. No formal GitHub release.
  - Deploy target: local validation only (`npm run build` + `npm run preview`). No GitHub Pages / Vercel in v1.0.

---

## 1. Phase 6a — task list (10 tasks, planned upfront)

Each task = test → fail → impl → pass → commit, per `docs/agent_docs/workflow.md`.

### Motion polish

1. **Floating gold-text on canvas finish.** New `src/ui/widgets/FloatingGoldText.tsx`. PaintingView mounts it inside `<AnimatePresence>` keyed on a per-sale event source. Animation: `y: 0 → -40, opacity: 1 → 0` over 800ms, then unmounts. Event source: a transient `lastSaleAt: number | null` field on `canvasSlice` (set in the sale tick step, cleared after the animation; alternatively a sale-counter that the component watches). Pick whichever is simpler for testing.
   - Tests (new file `tests/ui/widgets/FloatingGoldText.test.tsx`): renders the text when `lastSaleAt` is set; unmounts after the timeout window; honors `prefers-reduced-motion` (skip the animation, just briefly show + clear).

2. **Tree stage transition fade.** Wrap the HomeView stage card in `<AnimatePresence mode="wait">` keyed on `currentStage`. `initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}` over ~300ms. Honor `prefers-reduced-motion`: skip the fade, swap immediately.
   - Tests (extend `tests/ui/views/HomeView.test.tsx`): advance the tree slice through stage 0 → 1; assert old stage's testid disappears and new one appears.

3. **Fame increment pulse on ascend.** New `<FamePulse>` component (or a `useEffect`-driven className toggle inside the existing fame `<CurrencyDisplay>`). Detects fame increase via `useEffect` watching the value; triggers a one-shot scale (1 → 1.15 → 1) + color flash (gold → fame token) over ~500ms. Honor `prefers-reduced-motion`: skip the pulse.
   - Tests: render BottomBar with fame=10, update store to fame=15, assert the pulse class/data-attr toggles within the component update.

4. **WorkshopPopup mount/unmount fade.** Wrap the inner card (`data-testid="workshop-popup-card"`) in `<motion.div>` inside `<AnimatePresence>` keyed on `open`. Backdrop stays plain CSS (no Motion). Fade duration ~200ms. Honor `prefers-reduced-motion`: skip the fade, snap open/close.
   - Tests: existing 10 WorkshopPopup tests must continue to pass against the testid selector. C-1 already proved Motion-proofness; no new test needed here.

### Persistence polish carry-overs from Phase 2

5. **`persistedAdapter.flush().catch()` in `main.tsx`.** Both `visibilitychange` and `beforeunload` handlers. Route the rejection through the telemetry hook from task 7 (task 7 is therefore a precondition — plan-writing must order 7 before 5).
   - Tests (extend `tests/store/persistence-integration.test.ts`, the established home for cross-cutting persistence tests since the Phase 4 final-review fix): force `flush()` to reject, fire the lifecycle event, assert telemetry hook was called with `("persist.flush", err)`.

6. **Consolidate `visibilitychange` listener into `src/systems/lifecycle.ts`.** Currently registered in `main.tsx` (for persist flush) and inside the tick loop (for pause/resume). Move both to a single orchestrator that registers once and fans out. Same for `beforeunload`.
   - Tests (new file `tests/systems/lifecycle.test.ts`): spy on both `flush` and the tick-pause action, fire one `visibilitychange` event, assert both fire in the documented order (flush first, then pause).

7. **No-op telemetry hook scaffold (`src/systems/telemetry.ts`).** Exports `onError(err: Error, context: string) => void` with a default implementation `console.error(\`[\${context}]\`, err)`. Wire `tickLoop` errors, `persistedAdapter.flush()` rejections, and any other prod-error site through it. v2.0+ swaps the default for a real sink (Sentry, Logtail, custom backend).
   - Tests (new file `tests/systems/telemetry.test.ts`): default sink calls `console.error`; setting a custom sink replaces it; resetting to default works.

### Closing mechanics

8. **README write-up** + 2-3 screenshots committed to `docs/screenshots/`. Sections: project description (1 paragraph), tech stack, "How to play" (3-4 sentences on the loop), screenshots, dev setup (clone/install/run/test/build), project map (link to `CLAUDE.md` and `docs/`), wave roadmap pointer (link to PORT_PLAN §2.1). ~150 lines.
   - Screenshots captured via `npm run dev` (Claude does this during the dev-server window in task 9). Filenames: `home-tree.png`, `painting-canvas.png`, `ascension-ready.png`.

9. **Deploy verification:** `npm run build` produces a clean `dist/` (under 250 KB gzipped per DoD #12 — currently 82.77 KB so massive headroom even after Motion). `npm run preview` serves it. Manually click through tree → paint → ascend → skill tree in the preview to confirm no rehydration bug, no asset-path bug, no Motion-induced regression.

10. **Push to `origin/main`** (24 prior + 6a's commits, ~10-12 new commits). No tag yet — the repo is at v1.0-RC state at this point.

### Phase 6a Definition of Done

- All 10 tasks committed.
- Test count: 239 + ~10-15 new tests = ~250-255.
- `npm run build` clean, `dist/` < 250 KB gzipped.
- `npm run preview` serves a working game.
- README renders correctly on GitHub (verify after push).
- `prefers-reduced-motion` honored on all 4 Motion targets (CSS media query short-circuits the animation).

---

## 2. Playtest pause — what to capture

You run a fresh save (clear IDB + reload) for ~30-60 minutes. Capture these informally (in conversation; no formal report needed):

- **Time to first ascend.** Target per PORT_PLAN §7 Phase 6: 5-15 min. Above 15 → `PALIER_BASE` too high or part rates too low or `CANVAS_GOLD_BASE` too low. Below 5 → opposite.
- **Time to second ascend.** Should be faster than the first (skill tree starts paying off). If slower → palier scaling or fame-spend gating is off.
- **Affix variety feel.** Does crafting feel like "the workshop just rolled another random %" or like "I wonder what I'll get this time"? If the former → expand the affix pool from 3 to 4-5 in 6b (PORT_PLAN §1.3 suggests `+ascend_palier_reduction%` and `+tree_part_cost_reduction%` as the additions).
- **Tree progression pacing.** Does each stage feel earned, or does Sapling/Tree unlock too quickly / too slowly?
- **Skill tree investment by ascend 5-10.** Does the first 1-2 nodes change the loop feel, or are they invisible? If invisible → node magnitudes too small.
- **Any UI bug surfaced by playing for real.** Things mocked tests can't catch: hover-info overlap, animation jank, save-restore visible glitches, etc.

---

## 3. Phase 6b — task list (planned post-playtest, lighter)

Exact task count depends on playtest findings. Skeleton:

11. **Balance constants pass.** Edit `src/core/balance.ts` and/or `src/config/treeStages.ts` based on playtest findings. Each constant change updates its corresponding test in `tests/core/balance.test.ts` in tandem (per CLAUDE.md: "Every formula in `src/core/balance.ts` has a Vitest test"). Likely touches a subset of: `PALIER_BASE`, `PALIER_GROWTH`, `FAME_LOG_K`, `TREE_PART_COST_GROWTH`, `CANVAS_GOLD_BASE`, `PAINT_TIME_BASE_SECONDS`; possibly `TREE_STAGES[*].parts[*].baseCost` / `rate` / `unlockThreshold`. Commit per logical tuning step (one commit per constant or per coordinated cluster), not one giant balance commit.

12. **Affix pool decision.** If playtest found the 3-affix pool thin, expand `src/config/workshopAffixes.ts` to add `+ascend_palier_reduction%` and/or `+tree_part_cost_reduction%`. Each new affix needs:
    - Type union extension (`AffixKind` literal).
    - Magnitude range constants (mirror existing 5-15%).
    - Multiplier wiring in `src/store/multipliers.ts` (the new affixes need to feed into ascend / tree-cost calculations respectively).
    - Tests in `tests/store/workshopSlice.test.ts` and `tests/store/multipliers.test.ts`.
    - JSDoc on `AffixKind` updated (it's a save-format-binding string per Phase 3 lesson #14).
    
    If playtest found the pool fine: skip this task entirely. Document the decision in the commit message of the v1.0 tag.

13. **`v1.0` annotated tag.** `git tag -a v1.0 -m "v1.0 — minimum playable loop. Tree, canvas, workshop, ascend, skill tree, save persistence. ~250 tests."`. Push tags. No formal GitHub release.

### Phase 6b Definition of Done

- All planned 6b tasks committed.
- Test count change updated in tandem (no balance change without its test update).
- Bundle still < 250 KB gzipped after any affix expansion.
- `v1.0` tag visible on GitHub's tags page.
- HANDOVER updated to v1.0-shipped state with pointers to v1.1+ wave roadmap.

---

## 4. Test impact summary

- **6a:** ~10-15 new tests across Motion (4 targets) + persistence polish (3 carry-overs) + telemetry. Mostly small focused tests; the largest new file is probably `tests/systems/lifecycle.test.ts` (~5 tests for the consolidated listener).
- **6b:** 0-3 new tests (affix expansion if it happens). Balance constant changes don't add tests — they update existing values in `tests/core/balance.test.ts`.
- **End-state target:** ~250-260 tests total. PORT_PLAN DoD #11 says "~120 tests" — we are far over because Phase 4 + Phase 5 added more UI tests than the original spec budgeted; this is fine, the ~120 was an estimate not a ceiling.

---

## 5. Files affected (for plan-writing)

### New

- `src/ui/widgets/FloatingGoldText.tsx`
- `src/systems/lifecycle.ts`
- `src/systems/telemetry.ts`
- `tests/ui/widgets/FloatingGoldText.test.tsx`
- `tests/systems/lifecycle.test.ts`
- `tests/systems/telemetry.test.ts`
- `README.md` (root)
- `docs/screenshots/home-tree.png`, `painting-canvas.png`, `ascension-ready.png`

### Edited

- `src/main.tsx` (delegate lifecycle to `systems/lifecycle.ts`; route flush rejection through telemetry)
- `src/core/tickLoop.ts` (route errors through telemetry; remove its own `visibilitychange` listener)
- `src/store/canvasSlice.ts` (add `lastSaleAt` transient field, set in the sale step)
- `src/ui/views/PaintingView.tsx` (mount `<FloatingGoldText>`)
- `src/ui/views/HomeView.tsx` (wrap stage card in `<AnimatePresence>`)
- `src/ui/widgets/CurrencyDisplay.tsx` or `BottomBar.tsx` (fame pulse decoration)
- `src/ui/popups/WorkshopPopup.tsx` (wrap inner card in `<motion.div>` inside `<AnimatePresence>`)
- `src/store/index.ts` (`partialize` strip extension if `lastSaleAt` is added — must NOT persist)

### 6b conditional edits

- `src/core/balance.ts`, `src/config/treeStages.ts`, `tests/core/balance.test.ts` (always)
- `src/config/workshopAffixes.ts`, `src/store/multipliers.ts`, `tests/store/workshopSlice.test.ts`, `tests/store/multipliers.test.ts` (only if affix expansion happens)

### Deleted

- None expected.

---

## 6. Open questions deferred to plan-writing

These are tactical questions the writing-plans step resolves, not brainstorm-level:

- Exact event-source mechanism for `<FloatingGoldText>` — `lastSaleAt` transient field vs. counter-based vs. event emitter. Pick whichever produces the cleanest test.
- Where the `prefers-reduced-motion` short-circuit lives — per-component `useReducedMotion()` hook from Motion, or a global CSS gate. Likely per-component since the targets are few.
- Telemetry hook API shape — function-export with module-level mutable default vs. a thin singleton. Lean function-export (simpler).
- Whether the `lifecycle.ts` orchestrator owns the `beforeunload` listener too, or only `visibilitychange`. Lean both — same problem, same orchestrator.
- README screenshot dimensions and whether to commit `.png` directly (LFS not configured; PNGs at low res are fine for GitHub render).

---

## 7. Carry-forwards (deferred beyond Phase 6)

Continuing from HANDOVER's "known low-priority issues":

- Phase 2 polish carry-overs **#3 and #4** — test cleanup; deferred to a future test-cleanup window.
- **Phase 3 final review minors** — `void set;` YAGNI in `performAscendOrchestrator`; workshopSlice determinism test tuple; Better Brush ceiling test; metaSlice "DO NOT call performAscend" risk.
- **Phase 4 minors** — helper-signature `Pick<>` narrow refactor; HomeView `flatMap` memoization (when stage count grows); equippedItems index-key swap (when drag-to-reorder ships).
- **Phase 5 final review carry-forwards** — `uiSlice` → `Set<PopupId>` when v2.0+ adds a 2nd popup; stable-identity keys for inventory/equipped maps before v1.5 drag-to-reorder.

These are NOT in scope for v1.0. They remain in HANDOVER's deferred list for the next phase that touches the relevant files.

---

## 8. Out of scope for Phase 6

- Painter's Office, Painting School, Expositions, audio, achievements, multi-art-form architecture, offline progress, PWA, backend, accounts. (Per CLAUDE.md "Out of scope (for now — v1)".)
- GitHub Pages or Vercel deploy. v1.0 ships as "deploy-ready" (`dist/` builds clean), not "deployed".
- Marketing-flavor README (badges, animated GIF, design philosophy).
- Formal GitHub release with `dist.zip` attachment.
- The full Motion library's advanced features (layout animations, drag, gestures). v1 uses only `motion.div` + `AnimatePresence`.
