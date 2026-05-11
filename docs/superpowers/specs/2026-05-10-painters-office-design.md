# Painter's Office — Design Spec

**Date:** 2026-05-10 (initial sketch) / 2026-05-11 (revised: prereqs shipped, decisions resolved)
**Status:** Plan-ready. Prereqs (canvas depth, affix pool rework) shipped on `main`. All TBDs resolved through brainstorm 2026-05-11.

---

## 1. Concept

The Painter's Office is the idle-flavoured counterpart to the Workshop. Where the Workshop is the active "click → craft → equip" loop, the Office is the passive "watch the queue → keep the good ones → wait while they level" loop. Both systems buff the same canvas through the same shared affix pool, distinguishing themselves by interaction style and curve shape rather than effect type.

A player who likes active item-shopping invests in the Workshop. A player who likes idle/auto loops invests in the Office. The two are complementary engines on the same chassis; both scale infinitely.

---

## 2. Placement in the roadmap

PORT_PLAN.md originally flagged Painter's Office at v2.0 with the four-verb sketch *"hire / level / evolve / specialize, additional canvases."* This spec reframes those verbs against current shipped systems (single canvas with 5 upgrade tracks, Workshop tiers + 5-affix pool with capability-tag gating, 17-node skill tree DAG) and against a "lean MVP" constraint:

- **hire** → passive trickle queue + Hire/Reject decisions
- **level** → per-worker geometric XP scaling, fully passive (no Train button)
- **evolve** → reframed as **Office Level** gating tier ceiling + tier-roll quality + trickle rate
- **specialize** → reframed as **class system** with each class behind a fame-tree capability tag
- **additional canvases** → dropped; workers buff the single existing canvas

Multi-canvas is not part of this design. If parallel canvases return later, that is a separate spec.

---

## 3. Data model

### Worker (run-state, wiped on ascend)

```
Worker = {
  id:       string         // UUID
  class:    "generalist" | "goldsmith" | "speedrunner" | ...  // extensible
  tier:     Tier           // common..legendary, fixed at hire
  level:    number         // uncapped integer ≥ 1
  xp:       Big            // toward next level (Big past L~15)
  affixes:  Affix[]        // count = tier-derived (1..5), kinds rolled per per-worker weights
}
```

The per-worker rolled weight tuple is **ephemeral** — used only during the affix roll at hire, neither stored on the worker nor displayed. The natural variance surfaces through the rolled affix list.

### Office (mixed: level/xp persist on ascend; queue + roster are run-state)

```
OfficeState = {
  level:        number          // persists ascend
  xp:           Big             // persists ascend (Big past mid-game)
  queue:        Candidate[]     // trickle output, run-state
  roster:       Worker[]        // run-state
  trickleTimer: number          // seconds-since-last-candidate, run-state
}

Candidate = Worker without { level, xp }   // before hire; level=1, xp=0 on hire
```

### Affix

Reuses the schema from the Workshop — `{ kind: AffixKind, magnitude: number }`. AffixKind enum is identical to the Workshop's 5-kind pool from subproject 2 (`+sell_price%` / `+speed%` / `+size%` / `+crit_chance%` / `+combo_chance%`).

### Save schema impact

- New `officeSlice` adds: `level`, `xp`, `roster`, `queue`, `trickleTimer`.
- `level` and `xp` survive ascend; rest is wiped by `resetOffice()` in the ascend orchestrator.
- New `SAVE_VERSION` bump (current is v12 from the post-shipping polish; this becomes v13).

---

## 4. Core mechanics

### 4.1 Hire (passive trickle queue)

Candidates appear in the queue at a rate controlled by Office Level. Each candidate is a freshly rolled, fully visible (no hidden stats) worker template. The player browses the queue and either:

- **Hire** a candidate → pay the hire cost in gold, move them into the roster (if roster cap allows)
- **Reject** a candidate → free, removes them from the queue, no rest timer (candidates are random each trickle, so "the same candidate" doesn't exist)

**Trickle rate** (`§11.1` resolved):

```
trickleSeconds(officeLevel) = max(5, 60 × 0.97^officeLevel)
```

| Office L | Trickle (s) |
|---|---|
| L1 | 58 |
| L10 | 44 |
| L30 | 24 |
| L60 | 9.6 |
| L100 | 5 (floored) |
| L150+ | 5 (floored) |

Past L100 the trickle floor binds; Office Level continues to scale tier-roll probability (until L100 there too) but not trickle rate. See `§7.2` for the intentional plateau note.

**Queue overflow** (`§11.2`b resolved): when the queue is at cap, **trickling stops** until the player hires or rejects. Player can step away indefinitely and return to a preserved queue.

**Queue cap** (`§11.2`a resolved): driven by **skill-tree capability tags**, not Office Level. New capability: `queue_slot`. Each purchased fame node with `unlocks: ["queue_slot"]` in its tags contributes +1 to the queue cap. Engine selector `getQueueCap(state)` sums contributions. Default with no nodes purchased: 0 (queue is invisible / disabled). User authors nodes via `/dev/skill-designer` to expose the queue.

**Hire cost** (`§11.4` resolved): function of tier, affix magnitude sum, and Office Level. A min-roll Legendary is cheaper than a max-roll Legendary.

```
hireCost(worker, officeLevel) =
  tierBase(tier)
  × qualityFactor(worker)
  × officeLevelFactor(officeLevel)
```

Where:
- `tierBase(tier)` — gold anchor per tier. Sketch: `{ common: 100, magic: 1000, rare: 10000, epic: 100000, legendary: 1000000 }`.
- `qualityFactor(worker)` — lerps `[1, Q_MAX]` based on `sum(magnitudes) / sum(maxMagnitudes for tier)`. Sketch: `Q_MAX = 5`. So a worker with all-min rolls costs 1× tier base; with all-max rolls costs 5× tier base.
- `officeLevelFactor(L)` — geometric scaling: `1.10^L`. At L1 ≈ 1.1×, L20 ≈ 6.7×, L50 ≈ 117×. Keeps hire cost meaningful as the gold economy grows. (Big-valued past L~30.)

Specific constants are playtest tunable; the *shape* is locked.

**Hire cost is displayed on the queue card** so the player can compare price vs quality at a glance.

**Visibility:** candidate full stats (class, tier, affix list with kinds + magnitudes, hire cost) visible before hire. Browse, not gamble.

**Office Level effect on the queue** (locked):
- Caps highest tier that can roll (see `§6`)
- Speeds up trickle rate (`§4.1` above)
- Shifts tier-roll probability distribution (`§6`)

### 4.2 Level (per-worker, pure passive XP)

**Single XP source:** every canvas sale grants XP, split **equally** across the roster.

```
xpPerSale = goldSold × XP_GOLD_FRACTION   // single tuning knob, sketch: 0.01
xpPerWorker = xpPerSale / rosterSize       // equal share
```

XP gain is Big-valued (canvas gold is already Big). Distribution is equal share, not proportional to worker contribution — keeps re-rolling viable (a freshly-hired Legendary levels at the same rate as your old Common).

**No Train button.** The Office is fully hands-off after hire/reject decisions. Office Level's trickle-rate acceleration is the throughput lever, not per-worker training.

**Effect of a level — geometric scaling** (`§11.10` resolved):

```
levelScale(L) = 1.04^L
```

| Level | levelScale |
|---|---|
| L1 | 1.04 |
| L10 | 1.48 |
| L20 | 2.19 |
| L50 | 7.1 |
| L100 | ~50.5 |
| L500 | ~6.5M |
| L1000 | ~1.6 × 10^17 |

The whale-worker dynamic is the design intent: a Common-tier worker leveled to L80 outscales a freshly-hired Epic. Returns Big past L~30; `getOfficeContribution(state, kind)` must accept Big input and return Big output.

The `0.04` per-level constant is playtest tunable; the geometric shape is locked.

**No level cap. No new affixes from levels.** Slot count is fixed at hire via the worker's tier.

**XP-to-next curve.** Exponential: `workerXpToNext(L) = base × 1.15^L`. Concrete `base` is playtest TBD; `1.15` is the locked growth ratio. Big-valued past L~15.

### 4.3 Office Level (passive, institutional)

**Source:** Office XP equals **the sum of per-worker XP gains** (mirror, no damping).

```
officeXpGain = Σ xpPerWorker (across all hired workers)
            = xpPerSale × rosterSize / rosterSize
            = xpPerSale                           // simplifies to per-sale XP pot
```

So Office XP per sale = `goldSold × XP_GOLD_FRACTION`, independent of roster size (the per-worker division cancels with the summation). Mirroring is total-XP-conserving: bigger roster doesn't slow Office XP, doesn't speed it up.

**XP-to-next curve — steeper than worker curve:**

```
officeXpToNext(L) = officeBase × 1.30^L
```

Concrete `officeBase` is playtest TBD; `1.30` is locked. The steeper growth (1.30 vs worker's 1.15) is **how the spec encodes "Office levels are expensive, long-tail meta-progression."** Without this steeper curve, mirror-state Office XP would grow at the same nominal pace as the slowest worker, defeating the long-tail intent. Document this rationale next to the constant in `balance.ts`.

**Effect of Office Level:**
- Caps highest tier in the trickle queue (`§6`)
- Speeds up trickle rate (`§4.1`)
- Shifts tier-roll probability (`§6`)
- Persists across ascends (institutional meta-progression)

**No paid speedup.** Office Level is purely emergent from roster activity.

### 4.4 Fire (manual roster management)

Each roster card has a fire button. Firing removes the worker, freeing the roster slot (the player then has a slot to spend on a future hire). The fired worker is permanently gone — they don't return to the queue.

**Confirmation gate**: fire shows a confirmation dialog with the worker's class / tier / level / affixes so the player sees what they're losing. Single extra click; no lock-toggle clutter on the roster card. Modal pattern to be verified against project's existing component library at plan-write time (project doctrine forbids Radix tooltips but doesn't preclude inline confirmation states).

---

## 5. Classes

Three MVP classes. Each defines a **weight RANGE** over the 5 AffixKinds. Per-worker behavior:

1. For each AffixKind, roll an **integer weight** in the class's range (`rngInt(min, max)`).
2. If the resulting weight tuple sums to 0 (only possible for Generalist), **reroll** the weights.
3. Use those per-worker weights for affix kind sampling during the worker's affix rolls.

This produces per-worker variation *on top of* the natural sampling variance — two Goldsmiths can have meaningfully different specialty profiles, not just different random outcomes from a shared distribution.

**Class weight ranges:**

| Class | sell | speed | size | crit | combo |
|---|---|---|---|---|---|
| Generalist | [0, 4] | [0, 4] | [0, 4] | [0, 4] | [0, 4] |
| Goldsmith | [3, 7] | [0, 2] | [1, 3] | [0, 2] | [3, 7] |
| Speedrunner | [0, 2] | [3, 7] | [1, 3] | [3, 7] | [0, 2] |

Range midpoints encode the class identity (Generalist uniform 2/2/2/2/2; Goldsmith gold-heavy 5/1/2/1/5; Speedrunner speed-heavy 1/5/2/5/1). Ranges add ±2 spread per kind.

**Duplicate kinds allowed within a worker's affix list**, mirroring Workshop. Stacking is additive (per the existing affix pool). A max-rolled hyper-pure Goldsmith might end up with `[+sell × 4, +combo × 1]`.

**Class roll distribution** (`§11.9` resolved): when a candidate is rolled, the class is sampled by weight. Generalist weight = 3; each unlocked specialist class weight = 1. Normalized:

- Generalist only (default): 100% G
- + 1 specialist (one class unlocked): 75% G / 25% specialist
- + 2 specialists (both unlocked): 60% G / 20% Goldsmith / 20% Speedrunner

**Class gating — fame skill-tree capability tags:**

- `class_goldsmith` — at least one purchased fame node with this tag enables Goldsmith rolls
- `class_speedrunner` — same for Speedrunner

Future classes (quality-focused, crit-focused, etc.) extend the pattern: add a `class_<id>` capability and a class-weight = 1. The engine reads capabilities via the existing `hasCapability(state, tag)` selector.

Generalist is always available (no capability gate). It's the default class — the Office without any class fame nodes still produces Generalist candidates.

**Class is rolled at hire**, fixed for the worker's lifetime. Class never changes.

---

## 6. Tiers

Reuses the v3.1 Workshop tier system (5 tiers with 1–5 affix slots). Tier-cap thresholds are **compressed relative to Workshop's**, to compensate for the steeper Office Level XP curve and keep each tier unlock reachable in a comparable real-time arc.

| Tier | Affix slots | Office Level gate |
|---|---|---|
| Common | 1 | L1 |
| Magic | 2 | L3 |
| Rare | 3 | L8 |
| Epic | 4 | L20 |
| Legendary | 5 | L40 |

**Tier never changes for a worker.** Once rolled, fixed for life. Players keep rare-roll workers and discard low-tier ones; high-tier rolls become rare and special (Diablo-loot mental model).

**Tier-roll probability** (`§11.8` resolved): same algorithm as Workshop v3.1 — linear interp from `(unlock_level, min%)` to `(L100, max%)`. Common fills the residual. Sketch ranges (playtest tunable):

| Tier | Min % (at unlock) | Max % (at L100) |
|---|---|---|
| Magic | 5% | 60% |
| Rare | 5% | 50% |
| Epic | 5% | 30% |
| Legendary | 5% | 20% |

Reuses `computeTierProbabilities()` from `workshopRoll.ts` with the Office's threshold table — same engine helper, different unlock map.

---

## 7. Multipliers — how workers buff the canvas

### 7.1 Aggregation

Workers' affixes feed into the same canvas-multiplier functions as Workshop items. Stacking is **additive within an affix kind, across all sources** (workers + workshop items + skill tree).

```
totalGoldMultiplier = 1
  + Σ (workshop equipped items' canvas_gold magnitudes)
  + Σ (hired workers' canvas_gold magnitudes × levelScale(worker.level))
  + Σ (skill-tree contributions)
```

Same pattern for `+speed%`, `+crit_chance%`, `+combo_chance%`, `+size%`.

**No per-source magnitude caps. No Office-side scalar.** Both Workshop and Office scale infinitely (Workshop via Craftsmanship magnitude shifts + tier rolls; Office via uncapped levels + roster growth). They distinguish on *interaction style and curve shape*, not magnitude budget. The earlier "balance corollary" (worry about 25 worker-affix-instances swamping Workshop's 2) is deleted: both systems live in the same Big-arithmetic infinite-scaling regime, and the global multipliers (PM, ascend cycles) absorb any local imbalance.

### 7.2 Office Level plateau (intentional)

Office Level levers are designed around L1–L100. Past L100:

- Trickle rate floors at 5s (would otherwise drift to 2.9s at L100, sub-second beyond)
- Tier-roll probabilities plateau at their L100 max
- Tier ceiling reached at Legendary by L40 — no higher tier to unlock

So Office Level past L100 keeps growing (mirror state with worker XP sum, no cap on level number) but doesn't change *mechanical levers*. The plateau is intentional — the spec doesn't extend the ramps further because high-Office-Level players are well into PM-driven and skill-tree-driven scaling regimes where the Office is already a mature engine.

If future skill-tree nodes want to read Office Level past L100 (e.g., a fame node gated at "Office Level ≥ 200"), the level number is available; the *mechanical* effects just plateau.

---

## 8. Reset on ascend

Mirror Workshop pattern:

| Field | Persists ascend? |
|---|---|
| `office.level` | ✅ |
| `office.xp` | ✅ |
| `office.roster` | ❌ wiped |
| `office.queue` | ❌ wiped |
| `office.trickleTimer` | ❌ reset |

The institution is permanent meta-progression; the team is run-state. `performAscendOrchestrator` calls `officeSlice.resetOffice()` in the same pass as `workshopSlice.resetWorkshop()`.

---

## 9. UI placement

The Office mounts in the existing `office` tab in `<RoomRail>` (currently visible-but-disabled placeholder). The tab activates when:

```
getRosterCap(state) ≥ 1
```

`getRosterCap(state)` sums contributions from purchased fame nodes carrying `unlocks: ["roster_slot"]`. Until the user authors and the player purchases such a node, the Office tab stays disabled — same pattern as `gear_up` for the palette slot.

### 9.1 Layout (340px right-rail panel — same slot Workshop uses)

Three vertical sections, top to bottom:

1. **Office Level header**
   - Current Office Level
   - XP bar to next level
   - Tier-cap reminder ("Up to Magic" / "Up to Rare" / etc.)
   - Trickle period ("New candidate in ~Xs")

2. **Trickle queue** — up to `getQueueCap(state)` candidate cards. Each card:
   - Class badge + tier color
   - Affix list (kind + magnitude)
   - **Hire cost** (large, prominent)
   - Hire button (disabled if `gold < hireCost` or `roster.length ≥ rosterCap`)
   - Reject button

3. **Roster** — up to `getRosterCap(state)` worker cards. Each card:
   - Class badge + tier color
   - Level + XP-to-next bar
   - Affix list
   - **Fire button** (opens confirmation modal showing what's being lost)

Hover info on every interactive surface (queue cards, roster cards, Office Level header) routes through `hoverInfoSlice` (the v1.x hover-info pattern — no Radix tooltips).

### 9.2 Tab switching

Clicking the Office tab in RoomRail swaps `<WorkshopRoom>` for `<OfficeRoom>` in the rail slot, identical to how Workshop currently lives there.

---

## 10. Prerequisites (status: shipped)

This spec was originally gated behind two prerequisite subprojects. Both are now shipped on `main`:

### 10.1 Canvas depth — Subproject 1 ✅ shipped

5 upgrade tracks replacing canvasTier (sell_price / speed / size / crit / combo). See `docs/superpowers/specs/2026-05-10-canvas-depth-design.md`.

### 10.2 Affix pool rework — Subproject 2 ✅ shipped

5-kind AffixKind enum matching canvas tracks, capability-tag gating for advanced affixes. See `docs/superpowers/plans/2026-05-10-affix-pool-rework.md`.

### 10.3 Painter's Office — Subproject 3 — this spec

Ready to plan.

---

## 11. Resolved decisions (was: TBDs)

All 12 TBDs from the sketch and 4 open questions from §14 have been resolved through the 2026-05-11 brainstorm.

| # | TBD | Resolution |
|---|---|---|
| 11.1 | Trickle rate curve | `trickleSeconds(L) = max(5, 60 × 0.97^L)` — geometric decay with floor. |
| 11.2 | Queue cap | Skill-tree-driven via `unlocks: ["queue_slot"]` capability. Overflow = stop trickling. |
| 11.3 | Tier-cap by Office Level | L1/3/8/20/40 (Common/Magic/Rare/Epic/Legendary). Compressed vs Workshop's L1/5/15/35/70. |
| 11.4 | Hire cost | `hireCost = tierBase(tier) × qualityFactor(worker) × 1.10^L`. Quality factor lerps [1, 5] on magnitude sum. |
| 11.5 | Training cost-per-XP | N/A — no Train button. Pure passive XP. |
| 11.6 | XP-per-canvas-sale + share rule | `xpPerSale = goldSold × XP_GOLD_FRACTION`, distributed **equal share** across roster. |
| 11.7 | Office XP fraction | 100% mirror of summed worker XP; pacing comes from the steeper `officeXpToNext` curve. |
| 11.8 | Tier-roll probability table | Same algorithm as Workshop's `computeTierProbabilities()`, applied to the compressed thresholds. Sketch min/max %: see §6. |
| 11.9 | Class roll distribution + class unlocks | Generalist weight 3, each unlocked specialist weight 1. Specialists gated by fame-tree capability tags. |
| 11.10 | Per-level magnitude scaling | `levelScale(L) = 1.04^L` (geometric, uncapped, Big-valued past L~30). |
| 11.11 | Per-source magnitude multipliers | N/A — no balance compensation needed; Workshop + Office both scale infinitely. |
| 11.12 | Affix kinds + class weighting tables | Per-worker weights rolled from class weight RANGES (§5 table). Generalist `[0,4]` per kind with reroll on all-zeros. |

Original §14 open questions:
- **Speedrunner unlock** → resolved (fame-tree node, `unlocks: ["class_speedrunner"]`).
- **Train resource (gold vs inspi)** → resolved (no Train button at all).
- **Rest timer on rejected candidates** → resolved (n/a — candidates are random each trickle).
- **Lock toggle on roster cards** → resolved (no lock toggle; confirmation dialog on fire is sufficient).

---

## 12. Out of scope for this design

- **Multi-canvas / parallel canvas slots.** Workers buff the single existing canvas.
- **Worker specialization (sub-class branching).** Class is fixed at hire; no evolve-into-subclass mechanic.
- **Worker tier promotion.** Workers are fixed-tier; tier improvement comes from re-rolling at higher Office Level.
- **Train button / paid XP.** Pure passive.
- **Active hire mechanics.** Queue is passive trickle; no paid refresh.
- **Worker portraits / individuality.** Identity doesn't matter — workers are stat-rolled units, not characters.

---

## 13. Engine surface

For implementation planning:

### 13.1 New files

- `src/store/officeSlice.ts` — `OfficeSlice extends OfficeState`. Actions: `tickOffice(deltaSeconds)`, `hireFromQueue(candidateId)`, `rejectFromQueue(candidateId)`, `fireWorker(workerId)`, `resetOffice()`.
- `src/config/officeClasses.ts` — class definitions: id, capability tag (if any), weight ranges per AffixKind, class-roll weight.
- `src/core/officeRoll.ts` — `rollCandidate(state)` (one trickle's worth), `rollWorkerClass(state)`, `rollWorkerWeights(class)`, `rollWorkerAffixes(class, tier, weights, state)`. Mirrors `workshopRoll.ts` patterns.
- `src/components/office/` — `<OfficeRoom>`, `<QueueCard>`, `<WorkerCard>`, `<OfficeLevelHeader>`, `<FireConfirmModal>`.

### 13.2 Balance constants (`src/core/balance.ts`)

All numbers live here with Vitest tests:

- `TRICKLE_BASE_SECONDS = 60`, `TRICKLE_DECAY = 0.97`, `TRICKLE_FLOOR_SECONDS = 5`
- `OFFICE_TIER_UNLOCK_LEVEL = { common: 1, magic: 3, rare: 8, epic: 20, legendary: 40 }`
- `OFFICE_TIER_PROB_RANGES` = `{ magic: [0.05, 0.60], rare: [0.05, 0.50], epic: [0.05, 0.30], legendary: [0.05, 0.20] }`
- `LEVEL_SCALE_GROWTH = 1.04`
- `WORKER_XP_GROWTH = 1.15`, `WORKER_XP_BASE` (tuning TBD)
- `OFFICE_XP_GROWTH = 1.30`, `OFFICE_XP_BASE` (tuning TBD)
- `XP_GOLD_FRACTION` (tuning TBD — sketch 0.01)
- `HIRE_TIER_BASE = { common: 100, magic: 1000, rare: 10000, epic: 100000, legendary: 1000000 }`
- `HIRE_QUALITY_MAX = 5`
- `HIRE_OFFICE_LEVEL_GROWTH = 1.10`

### 13.3 Selectors

- `getRosterCap(state)` — sums skill-tree `roster_slot` capability contributions.
- `getQueueCap(state)` — sums skill-tree `queue_slot` capability contributions.
- `getClassUnlocked(state, classId)` — for non-Generalist classes, checks `hasCapability(state, "class_<id>")`.
- `getOfficeTierCap(state)` — max tier rollable at the current `office.level`.
- `getOfficeContribution(state, kind)` → `Big` — sums `worker.affix.magnitude × levelScale(worker.level)` across roster for the given AffixKind. **Big-valued at high levels.**
- `getHireCost(worker, state)` → `Big` — function in `§4.1`. Big-valued past Office L~30.

### 13.4 Big arithmetic discipline

These return / consume Big:

- `levelScale(L: number): Big` — Big past L~30
- `workerXpToNext(L: number): Big` — Big past L~15
- `officeXpToNext(L: number): Big`
- `getOfficeContribution(state, kind): Big`
- `getHireCost(worker, state): Big`
- `xpPerSale = goldSold × XP_GOLD_FRACTION` — Big (gold is Big-valued)

Anywhere these flow into a comparison or display, follow the existing `break_eternity.js` discipline (use `.gte()`, `.lt()`, `.toString()` formatting from `@/core/formatter`, never `.toNumber()` on values that may exceed `Number.MAX_SAFE_INTEGER`).

### 13.5 Tick integration

`tickAll` currently runs `treeTick → canvasTick → skillTreeTick → workshopTick`. Add `officeTick` at the tail:

- Advance `trickleTimer += deltaSeconds`.
- If `trickleTimer ≥ trickleSeconds(officeLevel)` AND `queue.length < getQueueCap(state)`:
  - `trickleTimer -= trickleSeconds(officeLevel)`
  - Push a new `rollCandidate(state)` onto the queue
  - (Loop in case a long tick should produce multiple candidates, but cap at `queueCap`.)
- XP distribution happens in **the canvas sale path**, not in `officeTick` — when a sale fires, add `xpPerSale` to each hired worker and add `xpPerSale` to `office.xp`, then resolve level-ups.

### 13.6 Ascend hook

In `performAscendOrchestrator`, after the existing `workshopSlice.resetWorkshop()` call, add `officeSlice.resetOffice()`.

### 13.7 Save migration

- Bump `SAVE_VERSION` from v12 → v13.
- Add `office` defaults to migrating saves: `{ level: 0, xp: Big(0), queue: [], roster: [], trickleTimer: 0 }`.
- No data to migrate from old saves (Office didn't exist).

### 13.8 RoomRail update

`office.enabled` becomes `getRosterCap(state) ≥ 1` (computed selector) instead of hard-coded `false`.

---

## 14. Implementation order (suggestion for plan-write)

When this spec is decomposed into a plan, suggested phase ordering:

1. Engine foundation: officeSlice schema, balance constants, ascend hook, save migration. Tests in `tests/store/officeSlice.test.ts` + `tests/core/balance.test.ts`.
2. Roll engine: `officeRoll.ts` (class roll, weight roll with reroll-on-zero, affix roll). Tests cover the full roll pipeline.
3. Tick + XP: `tickOffice`, canvas-sale XP hook, level-up resolution. Tests cover trickle, level-up, ascend reset.
4. Hire cost selectors + actions: `getHireCost`, `hireFromQueue`, `rejectFromQueue`, `fireWorker`. Tests cover gold deduction, slot allocation, confirmation flow.
5. Capability tags: extend skill-designer UI for new capability strings (`roster_slot`, `queue_slot`, `class_goldsmith`, `class_speedrunner`). Selectors `getRosterCap`, `getQueueCap`, `getClassUnlocked`.
6. Multiplier wiring: extend `getCanvasGoldMultiplier`, `getCanvasSpeedMultiplier`, `getCritChance`, `getComboBaseChance`, `getSizeMultiplier` to include Office contributions via `getOfficeContribution`. Tests cover additive stacking with Workshop.
7. UI: `<OfficeRoom>` + cards + modal. Hover info wiring.
8. RoomRail enable. Polish playtest.

Final tuning numbers for `XP_GOLD_FRACTION`, `WORKER_XP_BASE`, `OFFICE_XP_BASE`, hire-cost tier-bases, etc., will be tuned in playtest after the engine is wired and the first end-to-end loop is exercisable.
