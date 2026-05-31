# Artdle Web — Handover

## What's next

**Next content wave — v1.2: Subjects + Quality axis.** Per `docs/PORT_PLAN.md` §2.1 and
`docs/specs/2026-04-25-canvas-design.md` §7: **Subjects** (5 starter + 15 derived) with per-subject **10-tier
mastery**, plus the **Quality axis**. The v2.0 visual redesign is **shelved** (confirmed 2026-05-29) — v1.2
content targets the live game directly, no v2 dependency. Starting prompt for a fresh session in this directory:
> Read CLAUDE.md and docs/HANDOVER.md. v1.1 is shipped; starting v1.2 — Subjects + per-subject mastery + the
> Quality axis. Read docs/specs/2026-04-25-canvas-design.md §7 for the source design. Use brainstorming →
> writing-plans → subagent-driven-development.

**Open follow-ups from the 2026-05-31 pm wave.**
- **Fusion crit/combo over-cap on legacy saves.** The v30 migration caps duplicate crit/combo to the larger
  single roll — but a save *already* migrated under the earlier sum-everything build (`b042d0e`) has those values
  summed and **can't be un-summed**. Such an item stays over-cap until the player re-rolls it (M&A cross-affix
  fuse, or discard + craft). A blanket fix would need a v31 one-time clamp, but the "correct" ceiling is
  magnitude-multiplier-dependent — discuss before building.
- **Equipped-items flank tuning.** Position/size are CSS knobs in `EquippedItemsOverlay.module.css`
  (`--disc-size`, `bottom`, `left`/`right`). The icon badge sits on a black disc with a small margin; for
  edge-to-edge framing, crop the sprite cell tighter in `itemSprites.ts`.

**Repo housekeeping (do soon).**
- **Imported-but-untracked assets — fresh clone would fail to build.** `workerAvatarMap.ts` imports
  `assets/images/Workers/worker_{2,3,4}.png` and `CanvasSoldSfx.tsx` imports `assets/sounds/…`, but those files
  are **untracked in git** (show as `??`). Deploys only work because `npx vercel --prod` uploads the local
  working dir, not git. Commit them (also `assets/images/achievment icons/`).
- **Stale untracked plan files** in `docs/superpowers/plans/` (2026-05-17/23/25) — commit or delete.

---

## GitHub bug fixes + fusion rework + equipped-items display (2026-05-31, pm) — SHIPPED

> **All on `master`, deployed to production.** `master` HEAD = **`2985e4c`**. Live bundle **`index-DSu1zstQ.js`**
> at https://artdle-web.vercel.app (deploy: `npx vercel --prod` after **every** push — Vercel builds local code,
> not from git). Full suite green at **1208 tests**; `npx tsc -b` clean. **`SAVE_VERSION` bumped 29 → 30**
> (migration v30 aggregates item affixes — see Fusion below). This wave was direct small-fix work off five
> in-game Report-a-Bug issues plus follow-up requests; no brainstorm/spec/plan loop.

**GitHub bug reports #3–#7.**
- **#3 canvas not flushed on tier-up** (`cefdc36`). `canvasNumber` (= `canvasesSold`) is unchanged by `tierUp()`,
  so the settled-canvas reset, its React `key`, and `useRevealQueue` all kept the previous tier's painted cells
  overlaid on the new tier. Fixed by keying canvas identity on **`(tier, canvasNumber)`** in `CanvasStage`;
  `useRevealQueue`'s id type widened to `number | string`.
- **#4 worker XP too punishing** (`69ab5b8`). Eased the level curve **`3000 × 1.9^(n-1)` → `1000 × 1.5^(n-1)`**
  (`WORKER_XP_BASE` / `WORKER_XP_GROWTH`) — a worker could barely reach L2 in a whole ascend (the XP pool ≈ run
  fame, split across the roster). Re-tuned the accelerator-pool + XP-readout tests to the new boundaries.
- **#5 tree images** (`b3b429b`). Only `phase1–6` were imported, so tree tiers 6–9 all clamped to `phase6`.
  Imported `phase7–10`; each of the 10 tiers now maps to its own backdrop (`TreeScene`).
- **#6 crit-chunks affix value** (`f5edff2`, then corrected by `f779277`). First mis-read as glyph alignment
  (shipped a CSS fix, then reverted). The real issue: crit-chunks rolled tiny **1–5** magnitudes while the other
  affixes roll **15–66**, and `getCritChunks` reads magnitude as a *percent* (so 1–5 floored to no effect).
  Harmonized crit-chunks to the sell/speed range per tier in `AFFIX_MAGNITUDE_RANGE`. **Lesson: read the bug's
  *intent* — "harmonize the values" ≠ "align the display."**
- **#7 merged items show `+N`** (`f5edff2`). Fused items now show `+{fuseCount}` on the tier badge (e.g.
  `Epic +2`) in the Workshop and the new flank display.

**Ascend screen previews worker levels** (`6c8f66d`). New pure `countWorkerLevelGains` / `previewAscendLevelGains`
in `workerAscend.ts` mirror `applyAscendXp`'s pool split **without rolling stats or consuming the RNG** — a
per-render preview must not desync the real ascend's rolls (explicit test asserts the RNG is untouched + parity
with `applyAscendXpToWorker`). `FamePreviewCard` shows **"+N worker levels"** under the fame value.

**Fusion rework.**
- **Per-tier gain bands** (`9250d4a`). The flat 5%–50% slice made high-magnitude legendary fuses feel weak (a
  200-mag drop could add only +10). New **`FUSE_MAGNITUDE_PCT_RANGE`** (normal 10–25% … legendary 30–45%); each
  affix still absorbs `round(pct × dropMag)` of the **drop** (% of the drop, not the target — no compounding
  runaway).
- **Affix aggregation + crit/combo single-roll cap** (`b042d0e`, `e361bdc`, `c807276`). Items now carry **one
  entry per affix kind**. `rollAffixes` removes crit/combo from the pool after one pick (they never stack);
  `aggregateAffixes` collapses same-kind rolls — **sell/speed sum** (gameplay-neutral; the multipliers already
  sum per kind), **crit/combo keep the largest single roll** (never summed — so a single item can't reach e.g.
  515% crit). **`SINGLE_ROLL_AFFIX_KINDS` = {crit_chunks, combo_chance}.** The **v30 migration** applies this to
  existing items. *(Iterated: first shipped sum-everything to "preserve earned power" per advisor, then the user
  explicitly wanted crit/combo capped, so reverted to max-for-crit/combo. Caveat: an already-migrated save that
  was summed can't be un-summed — a player's pre-existing over-cap item stays until re-rolled.)*
- **Duplicate-kind transfer fix** (`766aa51`). Fusion's drop lookup was `new Map(drop.affixes.map(...))`
  (last-wins, silently discarded a duplicate kind's magnitude). Now sums per kind — robust even though
  aggregation already keeps real items unique-kind.

**Equipped-items display flanking the canvas** (`871aad9`, `f4c7c86`, `2cf9018`, `12da3ae`). New
**`EquippedItemsOverlay`** + **`itemSprites.ts`**: two upward-triangle clusters of large (104px) discs pinned to
the stage's bottom corners — brush/palette/easel on the left, hat/apron/boots on the right. Each disc slices the
per-tier **3×2 sprite sheet** (`src/assets/images/items/Items_{tier}.png`) via CSS `background-position`.
**Filename case matters** — `Items_Epic` / `Items_Legendary` are capitalised, the rest lower-case; the PNGs were
untracked and are now committed (an unresolved import would fail the case-sensitive Vercel build). Slot states:
locked → 🔒, empty → grey disc, equipped → tier icon on a black fill, fusion-ready + affordable → rotating
rainbow ring (circular analog of the Workshop caterpillar). `pointer-events: none` (display-only); reuses
`getUnlockedSlotKinds` / `getFusionTarget` so it stays in sync with the Workshop.

**Constellation cluster roots render purple** (`967c616` teal → superseded by `2985e4c` purple). Each cluster's
starter node (`SKILL_CLUSTERS[].rootNodeId`) uses the **`--inspi` purple** accent instead of gold across its
circle fill/stroke, glow halo, and level text (`StarCanvas`), so the entry node of all 7 clusters is visually
distinct. (Teal was tried first but read off against the gold tree.) Non-root nodes unchanged.

> **Docs note:** this handover was audited + trimmed in the same session — waves for 2026-05-24 and earlier (plus
> the v2.0/v1.1/v1.0 history) now live in `HANDOVER_ARCHIVE.md`, and a top-of-file **"What's next"** section was
> added (v1.2 pointer + open follow-ups + the imported-but-untracked-assets housekeeping flag).

---

## Constellation clusters + cluster designer + school banking + achievement ladders (2026-05-31) — SHIPPED

> **All items below are on `master` and deployed to production.** `master` HEAD = **`87fae6e`**.
> Live bundle **`index-5ksZ1mR1.js`** at https://artdle-web.vercel.app (deploy: `npx vercel --prod` — Vercel
> builds local code, not from git push, so always deploy after pushing). Full suite green at **1180 tests**;
> `npx tsc -b` clean. `SAVE_VERSION` unchanged at **29** (no migration needed this wave — see school note).
> Constellation + cluster-designer ran the full brainstorm → spec → plan → subagent-driven loop; school +
> achievements were direct (user flagged them as small). Specs/plans in `docs/superpowers/{specs,plans}/2026-05-3{0,1}-*`.

**TOOLING — the real typecheck is `npx tsc -b`.** The root `tsconfig.json` is a project-references stub
(`"files": []`), so `tsc -p tsconfig.json` checks **nothing** and falsely reports clean. Use `tsc -b` (or
`npm run build`). This burned time this session. The old "office/catchup tsc red" note is **stale** — `tsc -b`
is fully clean now.

**Constellation redesign — hubless seven clusters** (spec/plan `2026-05-30-constellation-clusters`, SHAs
`1236024`…`bf03e6a`, `4b1b461`). Replaced the single FAME hub with **7 independent themed clusters**
(`src/config/skillClusters.ts`): Inspiration, Colors, Workshop (absorbs the 2 speed nodes), Crit, Combo,
Office, School. Every node carries a `clusterId`; the **5 cross-cluster prereq links were cut** so each
cluster is a self-contained DAG with exactly one root (= "each cluster has a starting node"). **All clusters
open from start — fame cost is the only gate** (no hidden crit→combo coupling; verified). Completion is
**derived** (`clusterComplete` = all member nodes maxed) and grants a placeholder `completionBonus` capability
tag via `hasCapability` (no multiplier consumes it yet — real bonus values are a later gameplay pass). FAME
hub retired from runtime + designer; new pure **`core/clusterLayout.ts`** lays each cluster out in its own
region of one pannable sky (`computeClusterLayout` + `constellationViewbox`, `WORLD_PAD` baked in so positions
are one shared coordinate space). `StarCanvas` gained a per-cluster completion-art `<image>` layer (inert —
`completionArtPath` is `null` for all 7 until art exists). Default viewport now **frames the Inspiration
starter cluster** (zoom 2.2) instead of the whole ~2920×1880 sky (which rendered nodes as tiny dots).

**Designer ⇄ game layout unified + stale positions cleared** (`e2ea934`, `38fef5a`, `cf338ef`). The skill
designer had used its own FAME-radial `autoLayout` while the game used the cluster layout → positions never
matched. Both now consume `computeClusterLayout` over the same clusters, so **a star dragged in the designer
lands exactly where the game renders it**. Also **cleared 22 stale authored positions** in
`skillTreeDesign.json` (leftovers from the old FAME-radial designer, 2026-05-23 — they jammed half the nodes
near the origin in both views). `autoLayout.ts` deleted (orphaned).

**Cluster authoring in the skill designer** (spec/plan `2026-05-31-cluster-authoring-designer`, SHAs
`98a3985`…`affc862`, `cf338ef`). `DesignFile` gained `clusters[]` (`DesignCluster {id,name,theme,rootNodeId,
region}`); the 7 clusters are **seeded into `skillTreeDesign.json`**. New **"+ Add Cluster"** + `ClusterListRail`
+ `ClusterForm` (name/theme/read-only-id/root-picker/delete); node form's cluster picker reads `design.clusters`;
new clusters **auto-place** in empty sky (`nextClusterRegion`); validation flags **one-root-per-cluster** +
empty + unknown-clusterId. **Author-as-spec:** the game still reads hand-coded `SKILL_CLUSTERS` — when the user
saves a new cluster, the agent wires it into `skillClusters.ts` (+ reconciles node `clusterId`s) per
**`docs/agent_docs/cluster-authoring-handoff.md`**; a guard test enforces TS⇄JSON agreement on id/name/root/region.
> **Designer reads `localStorage` draft `?? file`.** A user's browser holds a draft that **overrides**
> `skillTreeDesign.json` — they must hit **Reset** in the designer to pick up file changes. Fresh-profile
> headless smoke masks this. `/constellation` is gated by the `unlockedConstellation` store flag (set on first
> fame) and `main.tsx` force-redirects every boot to `/tree`, so headless smoke must seed `window.useGameStore`
> (DEV build only) + click the nav link rather than navigate by URL.

**School — research progress is banked, not discarded** (`d7cb506`, `e7635a5`). The School's stop button
discarded a research's elapsed time. Renamed `cancelResearch` → **`pauseResearch`**: it now **banks** the
remaining seconds per research in a new persisted `researchProgress: Record<string,number>` on the school
slice; `startResearch` **resumes** from the bank if present. **Clicking another research switches** (pauses +
banks the active one, starts/resumes the clicked one). Persisted (survives ascend + reload) — note school was
already never reset on ascend; the only thing wiping progress was the old Cancel. No `SAVE_VERSION` bump:
the new field defaults via the persist shallow-merge with `initialSchoolState`. School room shows paused
researches as "⏸ Paused — X left (click to resume)".

**Achievements — gold + tree-tier ladders extended by 6 each** (`87fae6e`). Pure data in
`achievementConfig.ts` + `achievementsDesign.json` (no engine changes — reuses `canvas_gold_pct` /
`lifetime.goldgain` / `tree.tier`). Gold ladder after Piggy Bank/Millionaire/Nerbard Alnaurt: **Trillionaire
`1e12` → Octillionaire `1e27`** (×1000 threshold, +5% gold per rung, 0.30→0.55). Tree ladder after T2/T3/T4:
**T5→T10** (`tree.tier ≥ 5…10`, flat +100% gold each; all reachable — tree has 10 stages). Config test
(`tests/config/achievementConfig.test.ts`) locks the ladder values. Conditions compare via
`lifetimeGold.toNumber()` (float), so `1e12`…`1e27` thresholds are fine.

---

## Office UX + painting-view redesign + audio + ascend reveal wave (2026-05-30) — SHIPPED

> **All items below are merged to `master` and deployed to production.** `master` HEAD = **`b63b678`**.
> Live bundle **`index-oN6rSVhE.js`** at https://artdle-web.vercel.app (deploy: `npx vercel --prod`).
> `SAVE_VERSION` is now **29**. Full suite green at **1122 tests**. Each feature ran the full
> brainstorm → spec → plan → subagent-driven execution → final review → ff-merge → deploy loop;
> specs in `docs/superpowers/specs/2026-05-30-*`, plans in `docs/superpowers/plans/2026-05-30-*`.

**Bug-report button — wired live.** `/api/report-bug` (Vercel serverless fn) opens a GitHub issue. Needs
the **`GITHUB_TOKEN`** env var in Vercel — it's a **Sensitive** var, so `vercel env pull` returns it blank
by design. Feature works ONLY on the deployed site (plain `vite` 404s — it's a serverless function). The
mute/volume etc. is unrelated. Commits `8f69c5a`…`c75dd09` + token set in Vercel + name fix.

**Shell — hover info moved into the bottom bar** (`67cee2e`). Removed the standalone 72px `InfoPanel`
strip; hover info now renders to the right of the currency chips in `BottomBar`.

**Click-to-paint fix** (`0a910da`). Clicking the canvas ran the whole multi-painter sim forward
(`canvasTick(playerInterval)`), making every worker's stroke bar leap. Added a **`playerOnly`** mode to
`canvasTickPure` that advances only the player one stroke and merges worker clocks back unchanged.

**Worker identity + XP visibility** (`2026-05-30-worker-names-avatars-xp`). XP curve steepened to
**`3000 × 1.9^(level-1)`** (`balance.ts`); new persisted **`name` + `avatar`** on `Worker` (cosmetic
`Math.random`, NOT the seeded rng); **save migration v28→v29**. Names + avatars are **normalized distinct
per roster** in `reconcileRoster` (`distinctNames`/`distinctAvatars`, self-heal on load — no migration).
SHAs `af7228f`, `bd84629`, `ba23e41`, `41ceb90`, `d32c688`.
> **Windows gotcha:** a helper named `workerAvatars.ts` collided case-insensitively with the
> `WorkerAvatars.tsx` component → imports resolved to the wrong file ("Element type is invalid").
> Renamed to **`workerAvatarMap.ts`** (`96ea471`). Don't create case/extension-only filename twins.

**Painting-view redesign** (`2026-05-30-painting-stage-redesign`). Canvas widened (upgrades row dropped);
worker avatars now **flank the easel** (avatar 2&3 left, 1&4 right), larger, each with a **gold stroke-cycle
ring**, **teal XP bar**, **teal `Lv N`**, name above, and a **shake+tilt on each stroke** (`WorkerAvatars`
rewrite; proc = `painterClocks[id]` drop → remount-key replays the keyframe). Progress bar removed; sell
price moved to the top under the tier button. SHAs `3957a9d`, `352b0e6`, `95d18fb`.

**Upgrade panel redesign** (`2026-05-30-upgrade-panel-redesign`). `TrackCard` → compact frameless **pills**
(icon · name · `L#` · cost; effect/rate on hover), 2-col `CanvasUpgradesStrip`, clear affordable vs
unaffordable styling. The Speed card's stroke-cycle indicator became **`StrokeCycleBorder`** sweeping the
panel — an **SVG `<path>` perimeter stroke** (`pathLength=1` + `stroke-dasharray`) so it advances uniformly
and starts top-center (a conic-gradient looked non-linear on a rectangle). `BoundSpeedTrackCard` deleted.
SHAs `f47745a`, `441ebeb`, `51a2f3d`, `c0d5f11`.

**Canvas-sold sound** (`53b8207`…`237931e`). `CanvasSoldSfx` leaf in the App shell plays
`src/assets/sounds/Canvas_sold.mp3` on each sale (`statsRun.canvasesSold` increment), via **Web Audio**
(GainNode → can amplify a quiet clip above the 1.0 `<audio>` cap). Gain = `volume × 20` capped at 8, so the
**music volume slider + mute button** both govern it (silent at 0). NOTE: fires on EVERY sale globally —
frequent in late game (worker auto-sales); throttle / route-scope is an easy follow-up if it's too much.

**Post-ascend worker level-up reveal** (`2026-05-30-post-ascend-reveal`). `WorkerRollReveal` rewritten:
side-by-side **worker cards** (avatar + name looked up from the roster by `id`, `Lv a→b`, 5-stat sheet at
before-values in white); a shared step walks the 5 stats `0→5` at **400 ms** in sync across cards, flipping
each **increased** stat to its after value in **teal** with a **`+#`** chip. `AscendCinematicOverlay`: 1st
blackout click **skips** to the end (hint "— click to skip —" → "— click to continue —"), 2nd **dismisses**;
no level-ups / reduced-motion → jump straight to the end. SHAs `bfaba03`, `8e465a6`, `6743478`, `b63b678`.

---

## Balance review: crit + tree shipped, office redesign started (2026-05-29)

Balance-review session covering three areas the user flagged: (1) office workers need a full
redesign, (2) `+crit_chunks` item affix overpowered, (3) inspiration-tree upgrades feel flat /
early upgrades die instantly.

> **✅ SHIPPED (2026-05-30).** The Painter's Office redesign (A1→A2→B→C→D) is **complete, merged to
> `master`, and deployed to production.** `master == origin/master == painter-office-redesign ==
> `175ad34`. Live bundle **`index-DDhVCB9l.js`** at https://artdle-web.vercel.app (verified: office
> strings present). Deployed via `npx vercel --prod` (Vercel builds local code, not from a GitHub
> merge). The `painter-office-redesign` branch is kept for follow-up smoke fixes.
>
> **⏳ Parked (user deferred):** the manual visual smoke (full click-through/occlusion pass, ascend
> roll-reveal visuals) and the `WORKER_XP_GROWTH` feel-test (veterans may flatline late-game —
> shipped at the default 1.15). Two UI-integration regressions were already found+fixed in a partial
> smoke (see "Post-merge fixes" below).
>
> **Repo note:** there is also a `main` branch (separate line) — CLAUDE.md designates `master` as the
> main branch, so the office work merged into `master`.

### ✅ Shipped to production (reviewed + tested)

**#2 Crit-chunks rebalance** (spec `docs/superpowers/specs/2026-05-29-crit-and-tree-rebalance-design.md` Part 1; plan `docs/superpowers/plans/2026-05-29-crit-chunks-percent-rebalance.md`):
- `getCritChunks` (`src/core/multipliers.ts`) now reads each equipped `+crit_chunks` magnitude as a
  **percent of the base** (`floor(BASE_CRIT_CHUNKS × (1 + Σ mag/100 × slotMult))`) instead of a flat
  add. A maxed legendary (4 crit rolls ~85) drops from ~85 strokes/crit to ~2. No save migration,
  no roll-path change. Commits `ebf2a25`, `1419caa`.
- UI: Workshop chips + hover labels show `+N%`; StatsRoom "Strokes per crit" → "Items (+N%)" line.
  Commit `8755505`. **Worker crit affixes intentionally still render as a count** (workers' branch
  in `getCritChunks` left as flat — the office redesign owns that path).

**#3 Inspiration-tree 10-tier rework** (spec Part 2; plan `2026-05-29-inspiration-tree-10-tier-rework.md`):
- `PART_MILESTONES`/`PART_MILESTONE_FACTORS` (`balance.ts`) → escalating back-loaded schedule
  `[10,25,50,100,200,400,800,1000]` × `[2,2,3,3,4,5,6,8]` (×34,560 at L1000). Commit `5c12e54`.
- `treeStages.ts` → **10 single-upgrade tiers**, `rate`/`baseCost` ramp ×5, `unlockInspiPerSec`
  ×10 ladder; dropped `unlockThreshold`. Part IDs `u1`..`u10`. Commit `32dbb8a`.
- `treeSlice.ts` → new `getTreeInspiPerSec`; `canGrowSapling` gates on total inspi/sec (any upgrade
  advances the unlock). Commit `2421029`.
- Save migration v25→v26 (wipe + reseed tree; tree resets each ascend so it's self-healing). Commit
  `fce8a57`.
- UI: StagePanel shows inspi/sec unlock progress; UpgradeRow shows next-milestone hint. Commits
  `524f01d`, `7ab0428` (hover-factor bug fix).

### 🚧 In progress: Office painter redesign (#1)

**Concept:** the old "idle Workshop clone" is replaced — workers become **autonomous mini-painters**
on the shared canvas, each with their own stroke rhythm, leveling slowly across ascends. Spec:
`docs/superpowers/specs/2026-05-29-office-painter-redesign-design.md` (read it first).

**Locked design (from brainstorm):**
- Each worker has 5 stats: **speed, crit chance (cap 50%), strokes-per-crit, combo chance** are
  PERSONAL (used only when that worker paints); **gold per canvas** is a MULTIPLIER on the player's
  gold (the one shared-aggregate stat). Resolution to "whose gold sets the sale price."
- Shared canvas, discrete-event multi-painter tick: each painter strokes at its own
  `chunkInterval(speed)`; crit/strokes-per-crit per painter; on sale, `workerGoldFactor` ×
  player gold; combo chain is canvas-level, rolled by the completing painter's combo chance.
- Workers level **only at ascend** via increment rolls (`applyStatLevelUp`); **persist** across
  ascends. Ascend-XP pool scales with run gold, split contribution-weighted + baseline floor.
- Post-ascend **roll screen** (hook into `AscendCinematicOverlay`) reveals each worker's level-ups.
- Acquisition: worker slots unlocked via fame tree (`roster_slot`), spawn level-1; small cap; old
  hire/reject/trickle-queue + Office Level all REMOVED.
- Classes = stat-roll bias profile; mastery framework hook. **Class roster + unlock graph DEFERRED
  to a separate content spec.**

**Phase split (each its own plan, execute subagent-driven):**
- ✅ **A1 — Worker model + roll engine** (DONE, reviewed, green). Plan `2026-05-29-office-A1-worker-model.md`.
  New files only: `src/core/workerModel.ts` (`WorkerStats`, `createBaseStats`, `applyStatLevelUp`)
  + `balance.ts` constants (`WORKER_BASE_STATS`, `WORKER_PCT_INCREMENTS`,
  `WORKER_STROKES_PER_CRIT_INCREMENTS`, `WORKER_CRIT_CHANCE_CAP`). Commits `c746e8a`, `9d65373`.
- ✅ **A2 — Office-slice rewrite + remove old wiring** (DONE, reviewed, green). Plan
  `2026-05-29-office-A2-slice-rewrite.md`. Commits `93d1bf6` (slice rewrite + engine rewiring +
  v27 migration + minimal OfficeRoom), `d6a4801` (delete orphaned roll/class/old-UI), `60e2f55`
  (spawn wiring: `reconcileRoster` into `buyNode` + Bootstrap rehydration gate).
  `officeSlice.ts` is now `{ roster: Worker[] }` with `createWorker()`/`reconcileRoster()` (spawn-to-cap,
  idempotent)/`resetOffice()` (keeps roster, zeroes `strokesThisRun`)/`getRosterCap`. `Worker =
  {id, classId, level, xp:Big, stats:WorkerStats, mastery, strokesThisRun}`. **Workers now contribute
  NOTHING to canvas math** — `roster` was removed from `CanvasMultiplierInputs` (structural guarantee).
  Deleted: `officeRoll.ts`, `officeTickPure.ts`, `officeClasses.ts`, old office UI
  (`QueueCard`/`FireConfirmModal`/`OfficeLevelHeader`/`WorkerCard`), `awardOfficeXpPure`, and the
  hire/queue/Office-Level wiring. Save `v26→v27` drops `officeLevel`/`officeXp`/`queue`/`trickleTimer`
  + resets roster to `[]`; `reconcileRoster()` repopulates at runtime.
  > **A2 pulled one sliver of C forward:** `resetOffice()` already keeps the roster (workers persist
  > across ascend) — its body had to change since it referenced deleted fields. Phase C must NOT
  > re-implement worker persistence; it only renames the `ascend.ts` call site and adds the XP pass.
- ✅ **B — Multi-painter canvas tick** (DONE, reviewed, green). Plan
  `2026-05-29-office-B-multi-painter-tick.md`. Commits `bb37bbc` (`getWorkerGoldFactor`), `af00d26`
  (transient `painterClocks` state), `542c044` (frozen solo golden master + step-invariance net),
  `e8fd0bd` (the discrete-event scheduler rewrite), `d5cc9c6` (hardened player-only crit-stats test),
  `858cf3c` (store integration + skipped multi-painter step-invariance guard).
  `canvasTickPure` is now a discrete-event scheduler over player + every worker on the shared canvas;
  timing decoupled from fill (`canvasProgress` = integer completed-chunk count; per-painter cadence in
  transient `painterClocks`, keyed `"player"` + worker ids). Sale gold = `canvasGold × workerGoldFactor
  × comboBonusFactor(chain)`; combo chain rolled by the completing painter's combo base; per-worker
  `strokesThisRun` accumulates. `canvasSlice.canvasTick` now persists `painterClocks` + `roster`.
  **Solo equivalence is bit-exact** (frozen golden master `{gold 1942.5, sales 11, crits 116,
  maxCombo 1}` reproduced by the rewrite; the unified path needed no empty-roster fast-path).
  > **LOCKED in B (a C/D decision to revisit):** crit/combo STREAK stats (`currentCritStreak`,
  > `maxCritStreak`, `critsLanded`, `maxComboChain`) are PLAYER-strokes-only — worker strokes don't
  > perturb them (guarded by a real discriminator test, inversion-verified). `canvasesSold`/`goldEarned`
  > count all painters. C/D: decide whether worker crits should feed those achievement stats.
  > **KNOWN GAP deferred to C/D:** the MULTI-painter scheduler is NOT step-size invariant — per-event
  > float drift in `painterClocks` flips near-simultaneous painters' tie-break between small (live ~16ms)
  > and large (catch-up 10s/60s) steps, diverging RNG outcomes (~8% crits / 600s, measured). **Solo is
  > bit-exact** (Phase B's actual bar). Workers aren't live until C/D merge, so it's latent. Guard:
  > skipped test `canvasTickPure.equivalence.test.ts` → "multi-painter step-invariance (KNOWN GAP)"
  > (un-skip to see it fail). **C/D owns the decision:** either rework to absolute next-stroke scheduling
  > so multi-painter is step-exact, OR set an explicit catch-up-vs-live tolerance. A fix is incomplete
  > unless ALL of {gold, crits, maxCombo, per-worker strokes} equalize across step sizes (an epsilon
  > tie-break alone is not enough — empirically decide with a multi-painter probe before claiming fixed).
- ✅ **C — Ascend XP + persistence + skill-node migration** (DONE, reviewed, green). Plan
  `2026-05-29-office-C-ascend-xp.md`. Commits `363cdec` (constants + `getWorkerXpPoolMultiplier`),
  `7541d8c`/`1634df7` (pure `workerAscend.ts`: `splitAscendPool` + `applyAscendXpToWorker`), `51f82a1`/`c29dcaf`
  (`applyAscendXp` action + `lastAscendRoll` capture), `1d9f355` (ascend wiring + `resetOffice` removed),
  `795c78b` (skill-tree collapse + v28 refund), `7062d30` (dead-code cleanup).
  Workers now level at ascend: `ascend.ts` calls `state.applyAscendXp(big(fameGain))` (anchor = fame
  gained — log-compressed, one-line swap to change); pool split baseline-floor + `strokesThisRun`-weighted;
  per-worker xp→levels each rolling `applyStatLevelUp`; `mastery` increments per level; `strokesThisRun`
  resets; `lastAscendRoll` (transient before/after snapshot) captured for D's roll screen. `resetOffice`
  is GONE (`applyAscendXp(big(0))` subsumes it).
  Skill tree collapsed: deleted `education`/`free_will`/`recruiter`/`bookkeeper`/`gold_diggers`;
  `hire_manager`+`accelerator` reparented to `entrepreneur`; `entrepreneur` keeps `roster_slot` only;
  `accelerator` repurposed to ascend-XP boost (`worker_xp_mult`); **`unlock_school` reparented onto
  `accelerator`** (user decision — `gold_diggers` was its only parent; keeps Painting School reachable).
  Save `v28` deletes the 5 dead nodes from `purchasedNodes` + refunds 90,200 fame.
  > **Feel-test flag for D/playtest:** at default `WORKER_XP_GROWTH=1.15`, a level-50 veteran gains ~0
  > levels from a max-fame pool (cap-safe but possibly *dead*-feeling late-game). Tune `WORKER_XP_GROWTH`
  > (curve steepness), not just `WORKER_BASELINE_XP_FRACTION`, if veterans flatline.
  > **Correction applied:** the A2 "dead-code" list wrongly included `workerXpToNext`/`WORKER_XP_*` —
  > C resurrects them as the level curve, so they were KEPT (only the genuinely-dead office machinery deleted).
  > **`skillTreeDesign.json` was left out of sync here — that was a BUG** (it broke the constellation; see
  > "Post-merge fixes"). `src/components/constellation/nodeLayout.ts` imports that JSON for node POSITIONS +
  > EDGES, so skill-node changes must update BOTH `skillTreeNodes.ts` (logic) AND `skillTreeDesign.json`
  > (geometry). It is now synced (commit `4f33733`).
- ✅ **D — UI (final phase)** (DONE, reviewed, green, **merged + deployed**; manual smoke parked).
  Plan `2026-05-29-office-D-ui.md`. Commits `23b9b79` (shared `workerStatDisplay` helpers), `9b376f8`
  (post-ascend `WorkerRollReveal` in the cinematic blackout + `clearAscendRoll` on dismiss/reduced-motion),
  `aa9f120`/`408f810` (on-canvas `WorkerAvatars` — self-subscribing isolated overlay, `pointer-events:none`,
  right-edge rail to avoid the bottom HUD, next-stroke fill from `painterClocks`/`chunkInterval`),
  `3a65611` (office tab → per-worker stat-sheet cards), `30d00f8` (housekeeping: deleted the accepted-tolerance
  skipped test, 0 skipped now). Both deferred decisions resolved won't-fix: **worker crits stay player-only**;
  **multi-painter catch-up step-invariance tolerance ACCEPTED** (idle-game offline sim — no scheduler rework).
  Pure UI, no engine change. The isolation guard was rebuilt to a falsifiable `chunksPerCanvas`-spy counter
  (the original Profiler version was vacuous — it wrapped the avatar subtree).
  > **PARKED (post-deploy) — manual visual smoke (needs a human eye on the running app):** with ≥1 worker
  > in the roster, confirm (1) avatars appear by the canvas + cooldown bars animate toward each next stroke;
  > (2) **clicking the easel still paints** (the `pointer-events:none` overlay doesn't eat clicks — render
  > tests can't prove this); (3) no occlusion of canvas art / progress bar / gold preview / tier+combo badges;
  > (4) ascend with an office → blackout shows the worker `Lv X→Y` + increments, dismiss clears; (5) ascend
  > with NO office → normal blackout, no reveal artifacts. Also eyeball the reveal's gold accent vs the
  > cinematic's teal/lavender (minor). `worker_1.png` is 703KB — candidate for a polish-pass downsize.

### Post-merge fixes (2026-05-30, found in a partial smoke before parking the rest)
- **`4f33733` — constellation skill-tree desync.** Phase C Task 5 collapsed the office skill branch in
  `skillTreeNodes.ts` (logic) but NOT in `skillTreeDesign.json`, which `src/components/constellation/nodeLayout.ts`
  imports for node **positions + edges**. Result: deleted nodes' stars vanished but their edges + the old parent
  links (`free_will→hire_manager`) still drew → dangling edges + phantom deps. Fixed by syncing the JSON (delete
  the 5 nodes, reparent `hire_manager`/`accelerator`→`entrepreneur`, `unlock_school`→`accelerator`, strip
  `queue_slot`). JSON id-set now == TS id-set (44=44), 0 dangling edges. **Lesson:** skill-node changes update
  BOTH files. Corrected the misleading `project-designer-json-decoupled` memory (the JSON IS in the runtime graph
  for the constellation, contrary to what it claimed).
- **`175ad34` — speed-card cadence fill dead (Phase B regression).** `BoundSpeedTrackCard` drove its next-stroke
  fill from `canvasProgress`'s fractional part, but Phase B made `canvasProgress` an integer chunk-count (per-painter
  sub-stroke timing moved to `painterClocks`). Fixed: drive `cycleProgressPct` from `painterClocks['player']/chunkInterval`;
  exported `PLAYER_ID` from `canvasTickPure`. Swept all other `canvasProgress` consumers — only this one read the
  fraction (`BoundCanvasStage` floors deliberately). 4 new tests lock it.

### Status
- **1088 passing, 0 skipped** on `master` (1084 after D + 4 from the speed-card fix); `npx vite build` clean.
  `master == origin/master == painter-office-redesign == 175ad34`. `SAVE_VERSION = 28`.
- **Production:** live at https://artdle-web.vercel.app, bundle **`index-DDhVCB9l.js`** (verified office strings).
- `npx tsc -b --noEmit`: ~25 pre-existing baseline errors in TEST files (NOT a gate — green bar is
  vitest + `vite build`; prod deploy via `npx vercel --prod` is not gated on `tsc -b`). No new tsc
  errors in non-test source from A2/B/C/D. A cleanup pass on the test-file tsc errors would be welcome.
- **Next session:** finish the parked manual smoke (D bullet) + the `WORKER_XP_GROWTH` feel-test. Work on the
  `painter-office-redesign` branch, re-deploy via `npx vercel --prod`, then fast-forward `master` again.
- Memory corrected this session: the **v2.0 visual redesign is shelved** (user confirmed none planned);
  `project_v12_scope.md` updated — don't gate work behind a v2.

### Notes & lessons
- The whole balance review was brainstormed with the user before any code (office identity, crit %
  model, tree generators). User prefers terse direction + me driving; gets overwhelmed by abstract
  math/number-picking — keep tunables off their plate ("we'll feel-test in play").
- Execution was subagent-driven (implementer → spec review → code-quality review per task). The
  reviews caught real bugs (the UpgradeRow hover `×milestoneMult*2` was wrong under escalating
  milestones — fixed in `7ab0428`).

### Commits (branch `painter-office-redesign`, in order)
`94182cd` specs · `bf3f86d` crit plan · `ebf2a25` crit engine · `1419caa` crit stats mirror ·
`8755505` crit UI · `330e201` tree plan · `5c12e54` tree milestones · `32dbb8a` tree config ·
`2421029` tree unlock gate · `fce8a57` tree migration · `524f01d` tree UI · `7ab0428` tree hover fix ·
`e07a3b0` office A1 plan · `c746e8a` office worker constants · `9d65373` office worker model ·
`510f7a0` office A2 plan · `93d1bf6` office A2 slice rewrite + engine rewiring · `d6a4801` office A2
delete orphans · `60e2f55` office A2 spawn wiring ·
`fa6050e` office B plan · `d2c75c5` office B plan fix · `bb37bbc` B workerGoldFactor · `af00d26` B
painterClocks state · `542c044` B golden master · `e8fd0bd` B multi-painter scheduler · `d5cc9c6` B
harden crit-stats test · `858cf3c` B store integration + step-invariance guard ·
`bf47637` office C plan · `e5a8f7e` C plan fixes · `363cdec` C constants+selector · `7541d8c`/`1634df7`
C pure xp engine · `51f82a1`/`c29dcaf` C applyAscendXp+roll · `1d9f355` C ascend wiring (resetOffice removed) ·
`795c78b` C tree collapse+v28 refund · `7062d30` C dead-code cleanup ·
`d666737` office D plan · `46283c9` D plan fixes · `23b9b79` D stat helpers · `9b376f8` D roll reveal ·
`aa9f120`/`408f810` D on-canvas avatars · `3a65611` D office tab cards · `30d00f8` D housekeeping (0 skipped) ·
`4f33733` fix constellation JSON desync · `175ad34` fix speed-card cadence fill · **merged → master + deployed prod**

---

## Post-rework polish, regressions found, dev surface (2026-05-27)

After the 2026-05-26 chunk-domain rework deployed, the user playtested and surfaced a series of fixes. All landed; production now on bundle `index-B56w_Qgb.js`.

### What landed

**Per-chunk gold drip reverted (`25ddba0`).** The spec called for gold to drip per chunk; user playtested and it felt wrong. Reverted to lump-sum payout on canvas sale. The chunk-by-chunk progress display stays, but gold is now credited as a single lump when a canvas completes (matching classic feel). `lastSale.amount` carries the full canvas total again. Crit still adds bonus chunks — its reward is "sale fires sooner," not "free gold mid-canvas."

**TierUpgradeCard moved to canvas overlay (`6a835ce`).** Was sitting above the upgrade strip in a card form; user wanted it as a horizontal banner overlay at the top of the canvas image, replacing the static "— Tier N · StageName —" title. Now: pill-shaped semi-transparent banner with `Tier N · StageName → Tier N+1  |  cost gold`; rainbow conic-gradient affordability border when funds suffice; `e.stopPropagation()` on click so the canvas paint-click underneath doesn't also fire.

**Progress bar redesign (`02fea27` → `44f305f`).** Two-step fix.
- First pass (`02fea27`) reverted the bar label to seconds-based because the chunk-format string was being rendered as malformed nonsense ("5/10s / 10s"). Patched the wrong axis — user wanted chunks, and discrete fill, not continuous.
- Real fix (`44f305f`): bar fill is now DISCRETE (floored to integer completed strokes — visibly jumps one step per stroke completion); label reads `Painting · 5 / 10 strokes`. **Player-facing wording changed from "chunk" to "stroke"** across the UI: StatsRoom CanvasBlock rows ("Strokes per canvas", "Interval per stroke", "Gold per stroke"), "Strokes per crit" stat name, all four `+crit_chunks` affix labels (WorkshopRoom/QueueCard/WorkerCard/FireConfirmModal), "Crit chance (per stroke)", and the canvas click `aria-label`. Internal field names (`canvasProgress`, `chunkCount`, `chunkInterval`, `+crit_chunks`) stay — only strings the player sees changed.

**Speed card: live stroke rate + cycle-fill (`f04a232`).** Speed TrackCard now displays `0.20 strokes/s` below its effect line, and the card's background fills horizontally over the sub-stroke cycle (0→100% per chunkInterval, snaps back at each stroke completion). Implemented via two optional props on `TrackCard` (`rateLine?`, `cycleProgressPct?`) that are no-ops when omitted, plus a new `BoundSpeedTrackCard` wrapper that subscribes to `canvasProgress`. The subscription is scoped to the wrapper so PaintingRoute body isolation (BoundCanvasStage perf-guard) still holds.

**TopBar sticky locks for Ascension + Constellation (`9955aec`).** Both tabs now lock until the player first crosses the unlock threshold; once unlocked they STAY unlocked forever (survive ascends, fame-spending). Implementation:
- `metaSlice`: new `unlockedAscension` + `unlockedConstellation` boolean fields with idempotent setters.
- `SAVE_VERSION` 24 → 25 with migration that pre-unlocks for any existing save where `ascendCount > 0`, `inspiration >= 10000`, or `fame >= 1`.
- `TopBar`: subscribes to derived BOOLEAN conditions (`canAscend(...)`, `fame.gte(1)`), NOT raw `Big` currencies — re-renders only on threshold-cross events, not per-tick. `useEffect` flips the persistent flag once the condition is true.
- Locked tabs render with the existing lock badge + tooltip naming the unlock condition.

**Dev console surface `__artdle` (`1805eef`).** Single-player game, no secrets — exposed `window.__artdle` with handles to `store` (useGameStore), `runCatchupSimulation`, `catchup(seconds)` shortcut, and `persistedAdapter`. Example: `__artdle.catchup(7200)` instantly credits 2h of offline progress to the live store (uses the same simulation the boot flow does).

### Status

- **1073 / 1073 tests passing.**
- `npx vite build` clean.
- `npx tsc -b --noEmit`: still the 24 pre-existing baseline errors (verified at start of chunk-domain rework — zero added by these post-rework fixes).
- Production: `index-B56w_Qgb.js`. Live.

### Notes & lessons

- **`feedback_ask_before_patching_visual_bugs.md` was authored mid-session** after I patched the wrong axis on the progress bar ("5/10s / 10s" — I assumed THAT was the bug and switched to seconds; user actually wanted chunks + discrete fill). The lesson: on vague UI-regression reports, ask a clarifying multiple-choice question BEFORE editing. Linked from MEMORY.md.
- **The per-chunk gold drip lesson**: spec design choices marked "reversible if playtest hates it" by the advisor genuinely are — but should be flagged in the spec as risk. Worth tightening the spec template if this becomes a pattern.
- **The dev `__artdle` surface should grow** if more debugging needs arise. Don't over-design — add helpers as they prove useful. `catchup(seconds)`, `store`, and `persistedAdapter` cover the common cases.

### Open follow-ups

- **24 pre-existing tsc baseline errors** still untouched. Separate cleanup project.
- **Bot-sim pacing** flagged in the original rework HANDOVER still applies — the bot can't reach T2 in a 24h sim at `TIER_UPGRADE_COST_BASE = 1000`. Needs real-play data; if too steep, tune the constant. The new `__artdle.catchup()` helper makes manual feel-testing easier.
- **TierUpgradeCard click vs canvas click**: relies on `e.stopPropagation()` — works but is a soft bond. If a future canvas click handler ever uses capture-phase, the propagation guard wouldn't stop it. No issue today.

### Commits (in execution order, most recent last)

`25ddba0` revert(canvasTickPure): pay gold as lump sum on canvas-sale, not per chunk
`02fea27` fix(painting): progress bar label back to seconds (wrong axis fix — superseded)
`44f305f` fix(painting): discrete stroke-based progress bar + 'stroke' player wording
`f04a232` feat(painting): Speed card shows live stroke rate + cycle-fill progress
`9955aec` feat(topbar): sticky locks on Ascension + Constellation tabs
`1805eef` chore(dev): expose __artdle on window for console debugging

---

## Canvas chunk-domain rework — landed, pending browser verification (2026-05-26)

Eighteen-task rework executed via subagent-driven plan. Spec: `docs/superpowers/specs/2026-05-26-canvas-chunk-domain-design.md`. Plan: `docs/superpowers/plans/2026-05-26-canvas-chunk-domain-rework.md`.

### What landed

**Engine (chunk-domain):**
- `src/core/balance.ts` — added `BASE_CHUNK_INTERVAL=5`, `BASE_GOLD_PER_CHUNK=1`, `TIER_UPGRADE_COST_BASE=1000`, `CELL_RENDER_CAP=640`, `chunksPerCanvas(T)`, `goldPerChunk(level, mult, T)`, `tierUpgradeCost(T)`, `chunkInterval(speedMult)`. Deleted `CANVAS_TIME_BASE`, `canvasTime`, `timeFactor`, `COST_GROWTH_BASE`, `costTierFactor`, `sizeUpgradeCost`, `SIZE_PER_LEVEL`, `SIZE_COST_BASE`. `canvasGold(mult, tier)` no longer takes `size`. Four `*UpgradeCost` helpers lost their `_tier` placeholder.
- `src/core/canvasTickPure.ts` — full rewrite to integer-chunk-progress model. `canvasProgress` is now a FLOAT in `[0, chunkCount)`. Per-chunk gold drip via `goldPerChunk`. `lastSale` fires on the canvas-completing chunk. Crit unchanged in spirit (skips last chunk, bonus chunks spill across canvas boundaries). Multipliers hoisted out of hot path.
- `src/core/multipliers.ts` — `getCanvasSize` deleted; `sizeLevel` dropped from `CanvasMultiplierInputs`.

**State:**
- `src/store/canvasSlice.ts` — `sizeLevel` field gone, `upgradeSize` action gone, auto-tier-up gone. `tierUp()` is now gold-gated (`gold >= tierUpgradeCost(canvasTier)`); preserves within-tier upgrade levels; only resets in-canvas state (progress, comboChain, critChunks).
- `src/store/index.ts` — `SAVE_VERSION` 23 → 24. Migration: resets `canvasProgress`, drops `sizeLevel`, strips `+size%` from equipped/inventory/roster, refunds fame for the 3 removed size skill nodes using their actual per-level cost tables.

**UI:**
- `src/components/painting/TierUpgradeCard.tsx` (new) — dedicated card above the upgrade strip. Rainbow conic-gradient affordability border via shared `src/styles/rainbowBorderAffordable.module.css` (extracted from `AchievementToast.module.css` so both stay in sync).
- `src/routes/PaintingRoute.tsx` — chunk-domain props through BoundCanvasStage; Size TrackCard removed.
- `src/components/painting/BoundCanvasStage.tsx` — props swapped to `chunkInterval`/`chunkCount`; click handler calls `canvasTick(chunkInterval)` (one chunk).
- `src/components/painting/CanvasStage.tsx` — variable cell grid via `getCanvasCellLayout(tier)` (new helper in `canvasArt.ts`). Cell cap at 640. At T8+, multiple chunks per cell with `Math.floor(chunkIdx / chunksPerCell)` mapping + Set-based dedupe. `getSketchGridDim` deleted.
- `src/components/painting/StatsRoom.tsx` — `TierBlock` → `CanvasBlock` with chunk-domain rows (chunks/canvas, interval/chunk, gold/chunk, gold/canvas, GPS, base gold multiplier). `SizeBlock` deleted.

**Catalog:**
- `src/config/workshopAffixes.ts` — `+size%` affix removed from AffixKind union and all pools.
- `src/config/officeClasses.ts`, `src/core/officeRoll.ts`, `src/core/workshopRoll.ts` — worker/item roll pools no longer include `+size%`.
- `src/config/skillTreeNodes.ts` + `skillTreeDesign.json` — removed 3 size nodes (`size_matters`, `big_picture`, `expanding_horizon`); fixed `fast_learner.parentIds` cascade.
- `src/store/skillTreeSlice.ts` — `CanvasTrackId = "size"` literal removed.

### Status

- **1073 / 1073 tests passing** across 112 files.
- `npx vite build` — clean (~1s). Bundle `dist/assets/index-FXzWICKk.js` post-deploy.
- `npx tsc -b --noEmit` — 24 errors remain, ALL pre-existing baseline (verified by checking out `2b2e0ed^`; the rework introduced zero new tsc errors). Eight tsc errors caused by `+size%` removal were fixed in commit `43c34c8`.
- **Deployed to production** at https://artdle-web.vercel.app via `npx vercel --prod`. Live bundle verified to contain chunk-domain symbols (`chunkInterval`, `chunksPer*`, `tierUp`).

### Bot-sim warning — pacing concern

`tests/dev/bot-simulation.test.ts` updated to use the gold-gated tier-up (`gold >= tierUpgradeCost(canvasTier)`). With the steep `×1000`/tier cost ramp, the bot does NOT reach T2 in a 24-hour sim window under its existing ascend-heavy strategy (7 ascends, end-of-run G/s = 6.4, gold = 730). The T3→T4 ≥ T2→T3 × 0.9 inversion guard auto-skips when no tier-ups fire.

Reading: **the within-tier upgrade ramp (sell-price, speed, crit, combo + items + workers + skill tree) needs to deliver ~×100 gold growth between tier-ups to bridge the ×1000 cost / ×10 base income gap.** Bot data shows that's not happening in 24h of sim time. Two possible causes worth checking in playtest:

1. **Bot ascends too greedily.** Ascend-on-fame-available means bot never settles on a single run long enough to compound within-tier upgrades. Real player behavior may differ.
2. **The ramp is actually too steep.** Within-tier ceiling may be too low for the bridge. If playtest confirms, the dial is `TIER_UPGRADE_COST_BASE` (currently `1000`) — easy to tune (e.g. `100` for ×100/tier, or non-linear `100^T × T`).

Track for playtest validation before tweaking. The structural rework is correct; only the absolute numbers may need re-tuning.

### Manual verification checklist (before / during deploy)

When you next browse the dev or production build, walk through:

1. **T1 canvas paints chunk-by-chunk** — visible 5s/chunk at L0 speed; click advances 1 chunk visually.
2. **Gold drips per chunk** — gold counter ticks up smoothly, not in lump-sum bursts.
3. **`lastSale` flash fires on the canvas-completing chunk** — the FloatingGoldText animation still appears at canvas end.
4. **Buying a speed level visibly accelerates** the chunk paint.
5. **TierUpgradeCard appears above the upgrade strip** with `Tier 1 → Tier 2` and `1.00K gold`.
6. **Affordability border (rainbow conic-gradient)** appears when `gold >= 1000`.
7. **Clicking the card spends 1k gold and advances to T2** — `Tier 2 → Tier 3 / 1.00M gold` shows after.
8. **At T2, the canvas has 20 chunks** — visible 4×5 cell grid.
9. **Size TrackCard is GONE** from the upgrade strip.
10. **StatsRoom shows the new Canvas block** with chunk metrics (chunks/canvas, interval/chunk, gold/chunk, gold/canvas, GPS, base gold multiplier ×N).
11. **Existing save loads cleanly** — `sizeLevel` gone, FP refunded if size nodes were purchased, no `+size%` affixes on items/workers.
12. **At T3+** (after a few tier-ups): cell grid scales (40 cells at T3 = 5×8, etc.).
13. **No console errors** during normal play or canvas transitions.

If anything fails or surprises you, surface it — the bot-sim doesn't exercise the visual layer, so visual regressions need a human eye.

### Commits (in execution order, most recent last)

`3f7844c` core(balance): chunk-domain helpers
`208d9cf` feat(canvas): getCanvasCellLayout
`d96fd31` core(canvasTickPure): chunk-domain rewrite
`2759cd7` fix(canvasTickPure): goldEarned gate
`c7688a8` perf+fix(canvasTickPure): hoist multipliers, drop dead bonus-spill guard
`870729b` core(balance): drop size² from canvasGold
`196f883` core(balance): drop costTierFactor; delete sizeUpgradeCost + SIZE constants
`b604adc` core(multipliers): delete getCanvasSize
`794c45e` store(canvas): rewrite tierUp gold-gated; drop sizeLevel + upgradeSize
`70e7031` config(workshop): remove +size% affix from item rolls
`b729b84` config(skilltree+worker): remove canvas_size_bonus nodes and +size% worker affix
`f3aab67` ui(shared): extract rainbow conic-gradient border to shared CSS module
`527faff` feat(painting): TierUpgradeCard with rainbow-border affordability state
`f69ed95` ui(painting): wire chunk-domain props; remove Size TrackCard
`a456465` ui(canvas): variable cell grid for chunk-domain layouts (cap 640, chunksPerCell mapping)
`ad0d649` ui(stats): rename TierBlock → CanvasBlock; drop SizeBlock and Upgrade-costs row
`1ab3228` store(persistence): SAVE_VERSION 23 → 24 migration
`d1adf44` test(bot-sim): adapt to chunk-domain tier-up trigger
`d3a179c` core(balance): delete dead chunk-domain symbols + clean canvasSlice tests
`43c34c8` fix(ui,test): drop +size% AFFIX_LABEL entries + swap test fixtures
`49ce50e` docs(handover): chunk-domain rework landed (pending deploy + browser smoke test)
`6a835ce` ui(painting): move TierUpgradeCard to canvas-image overlay

### Open follow-ups

- **Browser-side smoke test (above checklist).** Required before declaring the rework playable.
- **`npx vercel --prod` deploy.** Not run yet — awaiting user signoff because this is a substantial visible change.
- **Playtest pacing.** Bot can't reach T2 in 24h — tune `TIER_UPGRADE_COST_BASE` if real-play feel matches.
- **24 pre-existing tsc baseline errors.** Not introduced by this work; cleanup is a separate project.
- **`getSketchGridDim` was deleted** but the underlying canvas-art-pool API stays. If any future feature needs grid dim, recompute from `getCanvasCellLayout(tier).rows × cols`.
- **Crit border duration** in CanvasStage stays at 600ms (from 2026-05-25 chunk-rendering rework). Worth a visual check at T8+ where multiple chunks crit-spill into a single cell — the border should still feel responsive.

---

## Canvas timing → chunk-domain rework — paused mid-brainstorm (2026-05-26) — [SUPERSEDED]

> Resolved by the work above. Kept for archaeology.

User wants to flip the canvas-paint model from "set time per canvas, time doubles per tier" to **chunk-domain**: clicks fill a chunk; the speed upgrade governs an auto-fill interval; tier-up doubles the chunk count (which mathematically doubles total auto-complete time, since per-chunk interval is fixed).

**Status:** brainstorm only. No code touched. Paused at the first clarifying question before any design decisions were made.

### Current system (for context when resuming)

- `canvasTime(size, tier) = CANVAS_TIME_BASE × size × timeFactor(tier)` in `src/core/balance.ts:168` — time-domain: total seconds-per-canvas is the designed number, chunk interval is derived.
- `canvasTickPure` (`src/core/canvasTickPure.ts:33`) converts seconds-progress into integer chunk units via `chunkTime = canvasTime / chunkCount`, then steps in PAID chunk boundaries with epsilon-tolerant arithmetic. Crit rolls per chunk; bonus chunks are free.
- Click-to-paint already exists — `src/components/painting/BoundCanvasStage.tsx:73` calls `canvasTick(paintTimeSec / chunkCount)` (= 1 chunk worth of seconds) per click.
- `chunkCount = getSketchGridDim(T)²` from `src/components/painting/canvasArt.ts:74`. Returns `round(5 × √2^(T-1))` capped at dim 20 → 400 cells. Cell count is already ~doubling per tier (T1=25, T2=49, T3=100, T4=196, T5+=400 capped).
- Speed: `SPEED_PER_LEVEL = 0.15` — additive +15%/level on a single `getCanvasSpeedMultiplier(draft)` multiplier in `multipliers.ts`. Matched to `SELL_PRICE_PER_LEVEL` so both canvas-depth tracks have identical marginal efficiency at any level (same cost curve, same per-level %).
- Size: scales time linearly (×size) AND gold quadratically (×size²).

### Open questions (asked but not answered)

Resume by working through these in order:

1. **Auto-fill at speed L0.** (a) Speed UNLOCKS auto-fill — L0 is clicks-only, L1+ enables ticking. Very active early-game; idle starts only after first purchase. (b) Generous base interval at L0; speed reduces it. Closer to current idle feel.
2. **Chunk count progression per tier.** Current grid is ~doubling but not exactly (25/49/100/196/400). User said "tier-up doubles chunks." Use existing curve, switch to clean doublings (25/50/100/200/400), or new base?
3. **Cap at T5+.** Current grid caps at 400 cells for rendering perf (see 2026-05-25 chunk-rendering rework). If chunks double per tier indefinitely, T6+ either breaks the cap (new render cost) or decouples chunk-count-for-balance from cells-rendered-as-pixels (bigger refactor).
4. **Size upgrade's new role.** Today size affects both time and gold (size² gold, size¹ time). In chunk-domain: drop the time half? Make size add chunks? Or just a flat gold multiplier?
5. **Base interval at speed L0** (or L1 if (a) is picked). Today T1 base = 10s ÷ 25 chunks = 0.4s/chunk. Keep that, or pick a new feel?
6. **Workshop / skill speed bonuses.** `basic_technique`, `muscle_memory`, item speed affixes are currently multiplicative on `getCanvasSpeedMultiplier`. Convert to interval-reduction or leave the multiplier path and apply it to the per-chunk interval?
7. **Save migration.** `canvasProgress` is persisted in seconds. Convert on load to a chunk count, or rename the field and bump `SAVE_VERSION`?
8. **`timeFactor` retirement.** Once chunk-domain lands, `timeFactor`, `canvasTime`, `CANVAS_TIME_BASE` may all be dead (unless kept for back-compat displays). Plan their removal as part of the rework or leave for a cleanup pass.

### Files touched during exploration

None — read-only exploration via Grep + Read.

### Resume prompt

Paste this to pick the brainstorm back up:

> Resume the canvas timing → chunk-domain rework brainstorm. The plan is to flip from "set time per canvas (tier doubles time)" to "chunk-domain: click fills a chunk, speed upgrade auto-fills a chunk per interval, tier-up doubles chunk count." See `docs/HANDOVER.md` 2026-05-26 entry for status and the 8 open questions to work through. Start by answering question 1 (speed L0 = clicks-only vs. generous base interval), then proceed in order.

---

## Tab navigation fix — pause tick loop + isolate canvas subscriptions (2026-05-25)

Three commits (`81cb2a1` runtime fix, `dff3578` HANDOVER, `d39b199` regression test), deployed (production bundle `index-D0XX0g7n.js`).

### What the user reported

"When I'm on the canvas screen and I click on the constellation tab it takes ages to load. but not for the other tabs." Later clarified: "It looks that the system is waiting for a canvas to be completed to allow changing tab."

### What was actually happening

Dev-only perf tracing on the navigation showed **5028ms click→paint on `/painting → /constellation`** (vs ~50ms for `/tree → /constellation`). During those 5 seconds:

- `App` was being invoked **548 times** (re-rendered, mostly aborted)
- `TopBar` was invoked **548 times** as a non-memoized child of App
- `ConstellationRoute` was invoked **186-260 times** before its first useLayoutEffect fired — React's concurrent renderer kept starting the render, getting interrupted, and restarting from scratch

The mechanism: **Zustand's high-frequency tick updates (canvasProgress every rAF, plus the other slice ticks) fired store changes that invalidated any in-progress concurrent render via React's useSyncExternalStore consistency checks**. ConstellationRoute is the heaviest route to render (~150 SVG elements + 7 continuously-animating twinkles), so it loses the race the longest — but the same starvation happens on every outgoing `/painting → *` transition; constellation just makes it visible.

The "waiting for canvas completion" feeling was a coincidence: a sale-flash typically draws the eye at the moment the constellation page finally commits, because both events happen seconds apart.

### The two-part fix

1. **`BoundCanvasStage`** (new component, `src/components/painting/BoundCanvasStage.tsx`) owns the five tick-frequency subscriptions previously at the top of `PaintingRoute`: `canvasProgress`, `comboChain`, `critChunks`, `lastSale`, `statsRun.canvasesSold`, plus the related action references (`clearLastSale`, `canvasTick`). PaintingRoute passes its already-computed low-freq props (`paintTimeSec`, `baseGold`, `chunkCount`, `sizeLevel`, `canvasTier`) down. Result: PaintingRoute's body (upgrades strip, 5 TrackCards, the active Room component, the RoomRail) no longer re-renders on every tick — typical render count during a 3-second nav dropped from ~730 to 6.

2. **Pause the tick loop during navigation.** `TopBar.tsx` NavLinks call `pauseTickLoop()` in `onClick` (before react-router fires its navigate). `App.tsx` resumes via `useEffect` on `location.pathname` change, which fires after the new route commits. Pause window is the duration of React's concurrent render of the new route — typically 50-200ms. During the pause, no tick-loop store writes happen, so no useSyncExternalStore invalidations can preempt the render.

After the fix: **61ms click→paint on `/painting → /constellation`, 2 renders per component** (the 2 is React StrictMode's dev-mode double-invocation; production runs would be 1).

| | Before | After |
|---|---|---|
| `/painting → /constellation` time-to-paint | 5028ms | 61ms (×82) |
| App invocations during nav | 548 | 2 |
| ConstellationRoute restart attempts | 186-260 | 2 |
| PaintingRoute renders during nav | 730 | 6 |

### Files

- `src/components/painting/BoundCanvasStage.tsx` (new, 84 lines). Owns the high-freq subscriptions; renders `CanvasStage` + `FloatingGoldText`.
- `src/routes/PaintingRoute.tsx`. Drops the five high-freq subscriptions + the derived `progressPct` / `comboFactor` / `nextSaleGold` (now computed inside BoundCanvasStage). Removed unused imports: `CanvasStage`, `FloatingGoldText`, `COMBO_PER_LINK`.
- `src/components/shell/TopBar.tsx`. Imports `pauseTickLoop` from `@/core/tickLoop`. NavLink `onClick` calls it before navigation if pathname is changing.
- `src/App.tsx`. Imports `resumeTickLoop`. `useEffect` on `location.pathname` resumes the loop after the new route commits. The dependency array means same-path clicks don't re-fire resume.

### Notes

- **Trade-off:** game state advances pause for the navigation window (50-200ms). At 60Hz, that's 3-12 missed frames of inspiration/gold accumulation. Imperceptible to the player; massively better than a 5-second tab switch.
- **The `tickLoop` already had `pauseTickLoop` / `resumeTickLoop` from the visibilitychange hook in `src/systems/lifecycle.ts`.** Those still work — both call sites (lifecycle + nav) are idempotent and don't conflict. If a user navigates while the tab is hidden, the lifecycle's pause is in effect; nav's pause is a no-op; on tab-show, both resume paths converge.
- **The asymmetry with `/tree → /constellation` is now explained.** TreeRoute doesn't subscribe to any per-tick-changing state (no canvasProgress, no inspiration directly — it derives inspiration display from `partLevels` which only changes on purchase). So leaving `/tree` doesn't have the invalidation source. After this fix, the asymmetry is gone — all transitions are fast.
- **Diagnostic instrumentation was deleted (`src/dev/navPerf.ts`).** It served its purpose during this diagnosis. If a similar performance bug recurs, restore it from git history at commit `342be6e..81cb2a1` range.
- **Regression test shipped in `d39b199`** (`tests/components/painting/BoundCanvasStage.test.tsx`). Two Profiler-based assertions:
  - PaintingRoute body re-renders ≤ 3 times after 30 simulated `canvasProgress` setStates. The 3-callback ceiling absorbs React StrictMode's 2× double-invoke in dev/test + 1 slot for batching variance; pre-fix behavior was ~60 callbacks, so the bound catches a regression by 20×+.
  - Sanity check that the visible progress display still updates when canvasProgress changes — guards against over-isolating (e.g. someone deletes BoundCanvasStage's subscription entirely).
  - The two together pin both sides of the architecture: PaintingRoute must NOT subscribe to per-tick state, BoundCanvasStage MUST.

### Status

- **1063 tests green** across 110 files (+2 from the new regression test). `npx tsc -b --noEmit` no new errors. `npx vite build` clean (5.85s).
- Production bundle `index-D0XX0g7n.js`. Live.

### Open follow-ups

- **Architectural cleanup of high-freq state.** The root cause was that high-freq tick state (canvasProgress) lives in the same Zustand store as low-freq game state. A future cleanup could split into two stores (or use refs / imperative DOM updates for `canvasProgress`-style data). The pause-on-nav stopgap is enough for now, but if other UI work (modals, heavy interactions) hits similar starvation, the architectural split becomes worth it.
- **Same fix for designer routes?** `/dev/*` paths bypass TopBar's NavLink (they're a separate Routes block in App). If the user navigates between dev routes during heavy tick activity, they'd see the same starvation. Low priority — dev routes are author-only.

---

## Canvas chunk rendering rework — cap at 400 + two-canvas hybrid + reveal queue (2026-05-25)

Five commits, deployed (production bundle `index-DMiA0i1P.js`). Plan at `docs/superpowers/plans/2026-05-25-canvas-chunk-rendering-rework.md`.

### What landed

User flagged a future-state perf concern: at T10 the uncapped `getSketchGridDim` formula `round(5 × sqrt(2)^(T-1))` would yield ~113×113 = 12,769 cells per canvas. The recent `dec6b0f` per-cell perf fix made each div cheap but the DOM-element count was still O(N). Beyond steady-state, the bigger risk was **crit storms**: a single crit can paint hundreds of chunks in one tick (engine fires `1 + N` per crit + canvas-end overflow), so the visual layer could be asked to start hundreds of CSS animations simultaneously.

Two changes that compose:

**1. Cap chunks at 400** (`getSketchGridDim` clamps at 20×20). T1–T4 unchanged (5/7/10/14 dims = 25/49/100/196 cells). T5+ all share the 20×20 = 400-cell grid. The cap affects BOTH engine chunk count (crit roll cadence, click-to-paint resolution) AND visual cells — the user opted to share the cap rather than decouple chunks-from-cells, which would have been a much larger refactor. Click-to-paint at T10 was 1/12,769 per click; now 1/400 — clicks become meaningfully impactful at high tiers, a UX improvement.

**2. Two-canvas hybrid + reveal queue** in `CanvasStage`:
- A single `<canvas>` element holds all "settled" cells as rasterized pixels. Whenever a cell finishes its 220ms pop-in animation, the renderer commits it via `drawImage` and forgets it — the cell no longer exists as a DOM element.
- A small overlay container holds ONLY the cells currently animating, max 8 at any frame. These keep the existing CSS pop-in animation (220ms `cellPopIn` keyframes with scale-back-ease) and the rainbow-border `sketchCellCrit` class (now for 600ms instead of the old 220ms, matching the existing crit-border animation duration).
- A new hook `useRevealQueue` mediates between the engine signal (`cellsRevealed` count) and the visual. When the engine reveals N cells in one tick, the hook pushes them into a FIFO and drip-feeds one into the in-flight pool every 50ms, capping in-flight at 8. Crit cells stay in-flight for 600ms (so their rainbow border completes); non-crit cells for 220ms.

Per-frame render cost is now O(in-flight) = O(1). T10 = T5 perf-wise. A 400-cell crit storm (the absolute worst case) takes ~20s to fully cascade, with max 8 simultaneous animations at any frame — a satisfying rainbow tsunami instead of a stutter spike.

### Files

- `src/components/painting/canvasArt.ts:74-81` — `getSketchGridDim` clamps via `Math.min(20, raw)`. Updated JSDoc to document the cap.
- `src/components/painting/useRevealQueue.ts` (new) — `useReducer`-based queue with three states (pending FIFO, in-flight pool max 8, settled list). `setInterval(50ms)` drives the drip + settle ticks. `performance.now()` for timing. Bucket-credit quirk: `startedAt = now - DRIP_INTERVAL_MS` so the in-flight duration check aligns with the next tick boundary (otherwise a cell promoted at t=50 and checked at t=270 would still show age 220ms < 220ms threshold and not graduate — see commit `25031dc` for the reasoning).
- `src/components/painting/CanvasStage.tsx` — sketch overlay block (was ~lines 194-218) replaced with a settled `<canvas ref={settledCanvasRef}>` + a small in-flight grid `<div data-testid="sketch-overlay-in-flight">`. Two `useLayoutEffect`s: one commits settled cells to the canvas via `drawImage`; the other clears the canvas + `committedRef` on `canvasNumber` change. Module-level `sketchImageCache` avoids re-decoding the same sketch PNG when committing multiple cells from it. The old `cellStaticStyles` and `revealRankByIndex` useMemos are gone.
- `src/components/painting/CanvasStage.module.css` — `.sketchOverlay` → `.sketchOverlaySettled` (no `display: grid`, just `position: absolute`). New `.sketchOverlayInFlight` for the grid container holding the in-flight cells. `.sketchCell` → `.sketchCellInFlight` AND switched from CSS transition (which doesn't fire on initial mount of a fresh DOM node — caught by an advisor review of Task 3's first cut) to a `@keyframes cellPopIn` animation with `fill-mode: forwards`. `.sketchCellCrit` unchanged.
- `tests/components/painting/canvasArt.test.ts` — three new tests for the cap + updated two pre-existing tests that hard-coded uncapped values at T6/T7.
- `tests/components/painting/useRevealQueue.test.ts` (new) — 6 hook tests covering empty start, queue advance, in-flight cap, settle-after-220ms, crit-cells-settle-after-600ms, canvas-change reset.
- `tests/components/painting/CanvasStage.test.tsx` — five existing tests in the "sketch overlay reveal" + "crit chunks" blocks updated to assert against the new structure (settled canvas presence, in-flight grid template, max-8 cap, eventual drain, crit class on in-flight cells).
- `tests/components/painting/CanvasStage.stress.test.tsx` (new) — two regression-guard tests for the queue cap under a worst-case 400-cell crit storm.

### Status

- **1061 tests green** across 109 files. `npx tsc -b --noEmit` no new errors. `npx vite build` clean (1s).
- Production bundle `index-DMiA0i1P.js`. Verified live: `sketch-overlay`, `sketchOverlayInFlight`, `sketchOverlaySettled` all present in the JS.
- Save schema unchanged. No migration needed — only render-layer + chunk-count formula changes.
- Bot-sim still passes the `T3→T4 / T2→T3 >= 0.9` non-inversion assertion (ratio 1.17 unchanged from the prior tier-cost rebalance).

### Notes

- **The implementer's-own advisor caught the pop-in animation bug during Task 3.** Initial cut used a `transition: opacity 220ms` on `.sketchCellInFlight` with `[data-revealed="true"]` toggling — but transitions don't fire on initial mount of a fresh DOM node (the property change must happen *after* mount). With cells mounting already revealed, no animation played. The fix was to use `@keyframes cellPopIn` with `animation-fill-mode: forwards` instead, which DOES run on mount. The unit tests passed both before and after the fix — visual regression coverage doesn't exist. If this pattern recurs (CSS transition on fresh mount), consider a browser-driven visual test.
- **jsdom doesn't implement `HTMLCanvasElement.getContext()`** — the canvas-commit effect runs but `ctx` is null in tests, so `drawImage` no-ops gracefully. Stress + CanvasStage tests log "Not implemented" warnings; ignore them.
- **The `useRevealQueue` `setInterval(50ms)` runs continuously**, even when nothing is queued. It's a small cost (one no-op dispatch per 50ms) but worth noting if the cells/canvas/anything ever scales to many concurrent instances. A future optimization could `clearInterval` when both `pending` and `inFlight` are empty.
- **`getCachedSketchImage` is module-level and never evicts.** Memory cost is small (~41 sketches × few MB each = tens of MB) but in principle grows without bound. Acceptable for a single-page game.
- **The stress test's 25s timeout for full-drain has ~4s slack** over the theoretical 20.6s minimum (400 cells × 50ms drip + 600ms crit tail). If anyone bumps `DRIP_INTERVAL_MS` or `CRIT_DURATION_MS`, also bump the stress test's `advanceTimersByTime(25_000)`.
- **The crit test in `CanvasStage.test.tsx` depends on `getCellRevealOrder(0, 25)` placing cell `0` early in the order.** If `canvasArt.ts`'s hash function changes, this test could become flaky.

### Open follow-ups

- **Manual visual verification.** Unit tests pass but the production deploy hasn't been visually verified yet. Confirm: (a) the sketch reveals cell-by-cell as before, (b) a crit triggers the rainbow border on freshly-painted cells, (c) the completed-canvas flash still plays, (d) no flicker on canvas transitions.
- **Speed-redesign integration.** User mentioned the next gameplay change is "speed determines time-between-chunks instead of time-per-canvas." That change lands naturally on top of this rework: the queue is already chunk-event-driven, so swapping the engine's per-canvas paint-time formula for per-chunk-interval is independent of the visual layer. No render code changes needed.
- **`setInterval` → `requestAnimationFrame`.** Real-time smoothness is fine at 50ms, but rAF would integrate better with the browser's rendering pipeline if we ever notice tearing. Tests would need to switch from fake timers to mocking `requestAnimationFrame`.
- **Cell rendering at T1 visually changed slightly.** With the queue stagger, a click at T1 (which advances by 1 chunk = 1 cell at the 1:1 mapping) now drip-feeds at 50ms even for a single cell. That's a 50ms latency that didn't exist before. Probably imperceptible but worth noting if click responsiveness ever feels mushy.

---

## Canvas tier cost rebalance — costTierFactor decoupled from tierFactor (2026-05-25)

Five commits, deployed (production bundle `index-CxhhTKYt.js`). Plan at `docs/superpowers/plans/2026-05-24-canvas-tier-cost-rebalance.md`.

### What landed

User reported: "Each canvas tier upgrade should provide an immediate boost to currency gain, but it should be harder to go to the next tier. T1→1H, T2→2H, T3→4H, … In the current state, it's easier to go from T3 to T4 than T1 to T2." The data confirmed it: at the old `tierFactor = 10^(T-1)` (which drove BOTH base gold scaling AND upgrade-cost scaling), the bot's T3→T4 wall-clock interval was **0.54× the T2→T3 interval** — a clear mid-tier inversion. Workshop level progression between T2 and T3 inflated the gold multiplier (WS:L33→L44, items getting better) faster than the geometric cost ramp could keep up. The pure-base math is already 2×/tier (cost ×10 ÷ income ×5 = 2), but non-reset multipliers (skill tree, items, workers, preserved size/crit/combo levels) compound between gate-clears and ate into the curve.

The fix is structural rather than numeric: split today's single `tierFactor` helper into two independent dials.
- `tierFactor(T) = 10^(T-1)` keeps its old role — drives `canvasGold` and (via per-level multiplier) the base gold curve. Unchanged. The immediate ×10 gold boost on tier-up survives.
- New `costTierFactor(T) = COST_GROWTH_BASE^(T-1)` (`COST_GROWTH_BASE = 20`) drives only the five `*UpgradeCost` functions. Costs now scale ×20/tier instead of ×10/tier.

Net effect (measured from the bot-sim, single committed run):

| | Before (X=10) | After (X=20) |
|---|---|---|
| T1→T2 | 16:49:56 | 16:49:56 (unchanged — T1 has no tier multiplier) |
| T2→T3 | 1:11:40 | 2:31:10 |
| T3→T4 | 0:38:45 | 2:56:20 |
| T3→T4 / T2→T3 | **×0.54 (INVERTED)** | **×1.17 (monotonic)** |

T1→T2 doesn't move because `costTierFactor(1) = 1`. T2→T3 doubles as designed. T3→T4 quadruples — enough to eliminate the inversion and push the ratio back above 1.0.

### Files

- `src/core/balance.ts` — added `COST_GROWTH_BASE = 20` constant + `costTierFactor` helper next to `tierFactor`. The five `*UpgradeCost` functions (sell-price, speed, size, crit, combo) now multiply by `costTierFactor(tier)` instead of `tierFactor(tier)`. JSDocs on `tierFactor` and the shared upgrade-cost block updated to reflect the narrower scopes.
- `src/components/painting/StatsRoom.tsx` — `TierBlock` was using a single `factor = tierFactor(tier)` for BOTH the "Base gold ×N" and "Upgrade costs ×N" display rows. Renamed local to `goldFactor`, added `costFactor = costTierFactor(tier)`, and the "Upgrade costs" row now reads from `costFactor`. The displayed multiplier matches what the engine actually charges.
- `tests/dev/bot-simulation.test.ts` — three changes during this work:
  1. `MAX_S` bumped from `3 * 60 * 60` to `24 * 60 * 60` (timeout 120s → 180s) so the bot has enough sim time to actually reach high tiers.
  2. Ascend decision now gates on `state.canvasTier === 1`. The bot still ascends to build the skill tree, but once it tier-ups to T2 it commits to the run instead of wiping back to T1 via `resetCanvas`. Without this guard, the bot oscillates T1↔T2 endlessly and never produces T3+ data.
  3. Per-tier event detection + post-run `=== Per-tier progression ===` summary block, plus a regression assertion `T3→T4 >= T2→T3 × 0.9` that fails if the inversion ever returns.
- `tests/core/balance.test.ts` — new `costTierFactor` describe block (5 tests) + per-function `scales with costTierFactor` tests on all 5 upgrade-cost helpers. 1050 tests green.

### Doc-vs-code drift spotted (not fixed)

While tracing the system, I noticed `src/store/canvasSlice.ts:33` describes `canvasTier` as "Preserved across ascends but reset on full wipe." But `performAscendOrchestrator` (`src/systems/ascend.ts`) calls `state.resetCanvas()` which sets the whole `initialCanvasState`, including `canvasTier: 1`. The actual behavior is "reset on ascend AND on full wipe." Either the comment is wrong or the code is — bot-sim confirms the code's behavior is what players experience. Out of scope for this rebalance; flag for a future decision pass.

### Status

- **1050 tests green** across 107 files. `npx tsc -b --noEmit` no new errors. `npx vite build` 6s clean.
- Production bundle `index-CxhhTKYt.js`. Verified live (`Upgrade costs` string present in CSS/JS — confirms the StatsRoom display change shipped).
- Save schema unchanged. No migration needed — the change is to upgrade-cost FORMULAS, not stored values. Existing saves at T2+ will just see steeper costs the next time they try to upgrade.

### Notes

- **The bot-sim's `canvasTier === 1` ascend guard is a permanent test change.** It changes what the test measures from "natural bot play" to "single-run tier climbing with skill-tree-build phase upfront." For the tier-balance question that's correct, but if downstream tests start relying on the old ascend cadence, factor a separate variant out.
- **`COST_GROWTH_BASE = 20` is a starting point, not a final number.** Bot data alone can't perfectly fit the user's stated "1H/2H/4H/8H" curve because the non-reset leak is *non-uniform* across tiers (workshop progression spikes gold mid-game in ways the linear cost ramp can't track). The fix eliminates the inversion the user could feel; the absolute pace may still need playtest-driven tuning, likely via a non-linear `costTierFactor` (e.g., `X^(T-1) × T^k`) or by attacking the workshop-leak directly.
- **`tierFactor` and `costTierFactor` are now two independent dials.** Tuning one doesn't move the other. A future "make the immediate-tier-up boost stronger" change just bumps `COST_GROWTH_BASE`'s gold-side sibling (or adds a third helper). The split is the load-bearing structural change; the X=20 choice can be revisited cheaply.
- **`SAVE_VERSION` did NOT need to bump.** No persisted fields changed — only formulas that read existing fields. A player with T3 in their save will pay 4× more for the next upgrade, but their level state is intact.

### Open follow-ups

- **Playtest validation.** The bot says the inversion is gone and the curve is monotonic. The user's stated curve was 1H/2H/4H/8H — bot data shows roughly 16:49 / 2:31 / 2:56 / [didn't reach T5 in 24h]. The ratios are flatter than user-stated; whether that's the right pace is a playtest question.
- **Non-linear `costTierFactor`.** If playtest says high tiers still feel too easy or low tiers too punishing, a non-linear curve like `costTierFactor(T) = 20^(T-1) × T` (or similar) would let early tiers stay forgiving while late tiers ramp harder. Don't write it pre-emptively.
- **The canvasTier-preserved-on-ascend doc drift.** Decide which side is correct and fix the other. If tier IS supposed to persist across ascends, that's a meaningful gameplay change (multi-run prestige) and probably wants spec discussion.
- **Bot AI tuning.** Without the `canvasTier === 1` guard, the bot ascends as soon as fame=5 is collectible and never climbs tiers. A more realistic ascend strategy (e.g., "ascend when expected fame gain is X× the current total" or "only ascend after reaching the current tier's gate") would let bot-sim measure tier balance under more player-realistic conditions.

---

## Older history — archived

Wave entries for 2026-05-24 and earlier (plus the v2.0 / v1.1 / v1.0 historical sections) were moved to [`HANDOVER_ARCHIVE.md`](./HANDOVER_ARCHIVE.md) on 2026-05-31 to keep this file lean. Nothing was deleted — the full log lives there.
