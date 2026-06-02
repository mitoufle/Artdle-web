# Artdle Web — Code Audit (2026-06-02)

**Scope:** engine / store / systems layer (`src/core`, `src/store`, `src/systems`) read in
depth. UI layer (`src/components`, `src/routes`) spot-checked only — selector discipline
verified, no deep dive. Findings ranked by impact (empirical bug history + blast radius),
not by where they appear in the tree.

---

## 1. Two sources of truth: `*Design.json` ⇄ hand-coded TS (highest impact)

**Pattern:** `src/config/skillTreeNodes.ts`, `skillClusters.ts`, `achievementConfig.ts`,
`schoolResearches.ts` are hand-written. The dev designers emit `src/config/*Design.json`
as a "spec," and a human+agent then **manually transcribe** node IDs, parents, costs,
cluster regions, and effects into the TS. There is **no codegen** (confirmed — the JSON is
referenced only in comments; `package.json` has no generate script). Worse, the decoupling
isn't even clean: `src/components/constellation/nodeLayout.ts` imports the JSON *at runtime*
for node positions + edges, while logic lives in TS — so the two must agree or the
constellation breaks.

**Why it's the #1 finding:** by the handover's own record this is the single largest source
of *shipped* bugs — the constellation skill-tree desync (`4f33733`), the cross-cluster edge
pile-up, the "designer defaults `clusterId: inspiration`" gotcha, the recurring
"reassign in BOTH files" warnings. The `skillClusters.test.ts` / `clusterGuard`
agreement tests are a **band-aid over a design that shouldn't need one** — they detect drift
instead of preventing it. The memory note `project_designer_json_decoupled` was itself
already corrected once because the "decoupled" claim was false for the constellation.

**Challenge / direction:** pick one source of truth.
- Either **generate** `skillTreeNodes.ts` / `skillClusters.ts` from the JSON at build time
  (a prebuild script + the existing agreement tests as a CI check), so a save in the
  designer can't diverge from runtime; or
- Read effects from a typed data format directly (the capability-tag system already makes
  effects data-driven — see §7 — so the *logic* wiring is the only thing still hand-coded,
  and even that could be a discriminated-union effect descriptor in the JSON).

The current "author-as-spec, agent hand-wires" pipeline is a deliberate workflow choice, but
it externalizes correctness to a manual step and a guard test, and it keeps costing bugs.

---

## 2. ~255 lines of dead migration code (easiest win, airtight)

**`src/store/index.ts:149–401`.** The `migrate()` chain is sequential `if (fromVersion < N)`
blocks with no early return **until line 404**:

```ts
if (fromVersion < 23) {
  return {} as unknown as GameStore;   // full wipe
}
```

Control-flow trace: any save at `fromVersion < 23` executes **every** block v2…v22
(lines 149–401) and then has all of it discarded by this unconditional wipe; blocks 24–30
never run for it. A save at exactly 23 skips 2–22 (conditions false) and runs only 24–30.
**Net: lines 149–401 only ever execute on saves that are about to be thrown away.** They are
dead. Every comment in that range also says "game unreleased — wipe," confirming no real
user is preserved by them.

**Challenge / direction:** collapse v2…v22 to the single wipe. Keep the version-history
comments if you value the changelog, but delete the ~255 lines of transform logic. This
removes a large, intimidating, untested-in-practice surface and makes the *live* migration
path (v24→v30, the only one that runs on real saves) legible.

---

## 3. Per-frame `5 × set()` + hand-maintained "cherry-pick return" (fragile + precedent for the fix exists)

**Pattern:** `tickAll` (`store/index.ts:684`) calls `treeTick → canvasTick → skillTreeTick →
workshopTick → schoolTick`, each its own slice action doing its own `set()`. So **5 store
commits per frame at ~60fps**, each notifying subscribers. Each tick does:

```ts
const draft = { ...state } as GameStore;   // shallow clone
canvasTickPure(draft, dt);                 // pure, copy-on-write mutations
return { canvasProgress: draft.canvasProgress, critChunks: draft.critChunks, /* …13 fields… */ };
```

The return is a **hand-maintained allowlist** of fields the pure function might have touched.
If a pure tick starts mutating a field not in that list, the mutation is silently dropped.
This is exactly the bug class the handover keeps hitting (museBurstTimer needing conditional
inclusion; school fields needing to be added to the canvasTick return; the "Pick fan-out
caught by tsc -b" notes).

**The tell:** `systems/catchup.ts` already does the *right* thing — one draft, run all five
pure ticks against it, **one `setState(draft)`**. The live path and the offline path use the
same pure functions but **opposite commit strategies**. That divergence is itself a smell and
a latent correctness gap (the two paths can disagree about what gets persisted).

**Challenge / direction:** unify on the catchup pattern for the live tick too — clone once in
`tickAll`, run all pure ticks against the draft, commit once. One notification per frame
instead of five, and the fragile cherry-pick lists disappear (commit the whole draft, or use
Immer/structural sharing). The pure-mutation layer (`pureMutations.ts`) is already built for
draft-style mutation; the slices are fighting it.

---

## 4. Multi-painter tick is *not* step-size invariant — and offline catch-up made it live

**`src/core/canvasTickPure.ts`.** The discrete-event scheduler advances per-painter `clocks`
by accumulation with a float `TIME_EPSILON` tie-break. The handover documents (Phase B/D)
that this is **not step-size invariant for multiple painters** and explicitly *accepted* the
tolerance "because workers aren't live until C/D." But:

- **It's live now.** `systems/catchup.ts` runs this exact scheduler at `delta = 10s` (≤24h)
  or `60s` (>24h). So every offline player *with workers* gets RNG-divergent crit/combo
  outcomes vs. having stayed online — and the divergence is sensitive to float drift in the
  tie-break. For an idle game where offline progress is a core mechanic, "offline ≠ online,
  non-deterministically" is a real design defect, not a parked tolerance.
- **Concrete tail-clipping bug in the same loop:** `MAX_SALES_PER_TICK = 1000` /
  `MAX_STROKES_PER_TICK = 1e6` (lines 23–26). Live 16ms frames never approach these. A 60s
  catch-up step at high throughput can — and when the loop breaks on `sales < MAX_SALES_…`,
  the **remaining `budget` is silently discarded** (the clocks aren't even advanced for the
  unspent time on that break path). That's lost gold/progress an online player would have
  earned. Reachability needs a high speed multiplier × large step, so verify before treating
  as a hard bug, but it's a falsifiable "offline < online" gap.

**Challenge / direction:** rebuild the scheduler around **absolute next-stroke times** in a
priority queue (`nextStroke[id] = now + interval`), popping the min and pushing
`now + interval`. Step-invariant by construction — no epsilon, no per-step accumulation
drift — and it makes the cap a true clip of *time* rather than a silent budget drop. A fix is
only complete when {gold, crits, maxCombo, per-worker strokes} all match across step sizes
(the handover's own bar).

---

## 5. Global mutable singleton RNG (known-adjacent; root cause of the "don't consume the RNG" gymnastics)

**`src/core/rng.ts`.** One module-level `_seed`, seeded from `Date.now()`, **not persisted**,
shared by canvas crit/combo, workshop rolls, and worker-ascend rolls. Consequences:

- The elaborate `workerAscend.ts` "preview must NOT consume the RNG" code
  (`previewAscendLevelGains`, the explicit "RNG untouched" test) exists *only* because a
  preview render would otherwise perturb the one global stream that the real ascend draws
  from. That's accidental complexity created by the global.
- Any reordering of `rng()` calls across systems silently changes all downstream outcomes —
  brittle for a codebase that prizes "bit-exact solo equivalence."
- True deterministic replay (the property catch-up wants) is impossible while the seed lives
  in a process global outside the save.

**Challenge / direction:** if determinism matters, thread a seeded stream through the tick
(or per-system streams) and persist the seed; then previews can use a throwaway fork and the
gymnastics vanish. If determinism *doesn't* matter (plausible for an idle game), then the
"don't consume the RNG" machinery is over-engineering — say so and delete it. Pick a lane.

---

## 6. Typecheck gating is a trap (already in memory — restating for completeness)

Root `tsconfig.json` is a references stub (`"files": []`), so `tsc -p tsconfig.json` checks
**nothing** and reports clean. Only `tsc -b` (what `npm run build` runs) is real, and the
handover notes ~25 baseline `tsc -b` errors in *test* files that are **not gated** (the green
bar is vitest + `vite build`). So type errors can accumulate in tests indefinitely.
**Direction:** make `tsc -b` (incl. tests) a CI gate, or split a test tsconfig that's also
checked. Low effort, closes a blind spot.

---

## 7. Things that are *good* (don't "fix" these)

- **Capability-tag effect system** (`hasCapability`/`countCapability`): nodes carry free-form
  `unlocks` tags and the engine reads tags, not node IDs. This is the *right* altitude — new
  nodes wire in by tag without touching the engine. (This is also why §1's JSON→TS gen is
  tractable: effects are already data-driven; only the node *graph* is hand-transcribed.)
- **`CanvasMultiplierInputs` `Pick<>` type** (`multipliers.ts:28`): forcing helper-state stubs
  to satisfy a typed input set is a deliberate, effective guard against the "stub forgot field
  X → NaN gold" regression class. Keep it.
- **`pureMutations.ts` copy-on-write**: nested objects are reassigned, not mutated in place,
  so the `{...state}` shallow clone in slices is actually safe. Sound.
- **Throttled IDB adapter** with `flush()`/`discard()`: ≤1s loss bound on crash, zero-loss on
  graceful close. Clean.
- **UI selector discipline**: no bare `useGameStore()` subscriptions; tick-driven values
  (gold, `painterClocks`, `canvasProgress`) are isolated in leaf components
  (`StrokeCycleBorder`, `WorkerAvatars`, `BoundCanvasStage`) so 60fps re-renders don't
  cascade. Convention holds where spot-checked.

---

## 8. Doc drift (cheap to fix)

- **CLAUDE.md says "No offline progress in v1"** and "audio / achievements out of scope," but
  `systems/catchup.ts`, `CanvasSoldSfx`, and the whole achievement system are shipped and
  live. CLAUDE.md's "Out of scope (for now — v1)" list is stale. Update it so a fresh session
  isn't misled.
- Untracked-but-imported assets (worker avatars, canvas-sold sfx, achievement icons) — a
  fresh clone fails to build; deploys only work because Vercel uploads the working dir.
  Already flagged in HANDOVER "repo housekeeping"; commit them.

---

### Suggested order of attack
1. **§2 dead migration** — 30 min, zero risk, big legibility win.
2. **§1 JSON→TS codegen** — highest bug-prevention ROI; do the skill tree first (most churn).
3. **§3 single-draft tick** — adopt the catchup pattern; removes a live bug class.
4. **§4 absolute-time scheduler** — correctness for offline players with workers.
5. **§5 / §6** — decide-and-document; low code, removes ambiguity.
