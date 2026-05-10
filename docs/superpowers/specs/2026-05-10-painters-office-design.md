# Painter's Office — Design Sketch

**Date:** 2026-05-10
**Status:** Sketch — structure & verbs locked, numbers TBD until prereqs land.
**Implementation gate:** Two subprojects must ship first (see §10). This spec is captured early so design decisions are preserved; it is **not** plan-ready.

---

## 1. Concept

The Painter's Office is the idle-flavoured counterpart to the Workshop. Where the Workshop is the active "click → craft → equip" loop, the Office is the passive "watch the queue → keep the good ones → train" loop. Both systems buff the same canvas through the same shared affix pool, distinguishing themselves by interaction style rather than effect type.

A player who likes active item-shopping invests in the Workshop. A player who likes idle/auto loops invests in the Office. The two are designed as complementary engines on the same chassis.

---

## 2. Why now (placement in the roadmap)

PORT_PLAN.md flags Painter's Office at v2.0 with the four-verb sketch *"hire / level / evolve / specialize, additional canvases."* This sketch reframes those verbs against current shipped systems (single canvas, v3.1 Workshop tiers, 17-node skill tree DAG) and against a "lean MVP" constraint:

- **hire** → passive trickle queue
- **level** → per-worker hybrid XP scaling affixes infinitely
- **evolve** → reframed as **Office Level** gating tier rolls
- **specialize** → dropped for MVP
- **additional canvases** → dropped for this iteration; workers buff the single existing canvas

Multi-canvas is not part of this design. If "parallel canvases" returns later, it lands as its own scope, decoupled from the Office.

---

## 3. Data model

### Worker (run-state, wiped on ascend)
```
Worker = {
  id:       string         // UUID
  class:    "generalist" | "goldsmith" | "speedrunner"
  tier:     Tier           // Common..Legendary, fixed at hire
  level:    number         // uncapped, integer ≥ 1
  xp:       number         // toward next level
  affixes:  Affix[]        // count = tier-derived (1..5), kinds rolled per class weights
}
```

### Office (mixed: level/xp persist on ascend; queue is run-state)
```
OfficeState = {
  level:        number          // persists ascend
  xp:           number          // persists ascend
  queue:        Candidate[]     // trickle output, run-state
  roster:       Worker[]        // run-state
  trickleTimer: number          // run-state (seconds since last candidate)
}

Candidate = Worker without { level, xp }   // before hire; level=1, xp=0 on hire
```

### Affix
Reuses the schema from the Workshop — `{ kind: AffixKind, magnitude: number }`. The `AffixKind` enum is **expanded** in subproject 2 (§10.2) to cover the full canvas-axis surface.

### Save schema impact
- New persisted fields on a new `officeSlice`: `level`, `xp`, `roster`, `queue`, `trickleTimer`.
- `level` and `xp` survive ascend; rest is wiped by `resetOffice()` in the ascend orchestrator.
- New `SAVE_VERSION` bump (TBD; v9 → v10 if Office is the next migration).

---

## 4. Core mechanics — the three verbs

### 4.1 Hire (passive trickle queue)

Candidates appear in the queue over time. The player browses the queue and either:
- **Hire** a candidate → pay a cost, move them into the roster (if cap allows)
- **Reject** a candidate → free, removes them from the queue

**Trickle parameters (TBD numbers, set in §11):**
- Base trickle period (seconds between new candidates)
- Queue cap (max candidates waiting)
- Hire cost (probably gold; possibly tier-scaled)
- Trickle behaviour at cap: stop trickling vs evict-oldest
- Visibility: candidate stats are **fully visible** before hire (browse, not gamble)

**Office Level effect on the queue:**
- Caps the **highest tier** that can roll (e.g., L1 = Common only; L5 = up to Magic; L15 = up to Rare; L35 = up to Epic; L70 = up to Legendary — mirrors v3.1 Workshop tier gates).
- Increases trickle rate (faster candidates).
- Increases queue cap (more visible at once).
- Exact curves TBD.

### 4.2 Level (per-worker, hybrid XP)

**Passive source.** Every canvas sale grants XP to all hired workers. Distribution rule TBD (equal share vs proportional to worker contribution to the sale).

**Paid source.** Each worker has a per-worker "Train" button that converts gold (or inspi — TBD) into XP at some rate. Rate may scale with worker tier or office level.

**Effect of a level:**
- Multiplies the worker's affix magnitudes by a constant per level (curve TBD; user constraint: *"scaling needs to be rewarding"* — e.g., +5% per level additive, or ×1.04 per level multiplicative, or a hybrid breakpointed curve).
- No level cap.
- No new affixes from levels (slot count is fixed by tier at hire).

**XP-to-next curve.** TBD. Probably exponential: `xpToNext(L) = base × growth^L`. Growth tuned so a Common L20 worker is roughly equivalent to a Rare L1 worker (ballpark; tuning in §11).

### 4.3 Office Level (passive, institutional)

**Source.** Office XP = Σ XP gained by all hired workers. Office levels up automatically; no separate input.

**Effect.** Gates tier rolls in the trickle queue (§4.1). May also gate trickle rate, queue size, and the unlock of the third class (Speedrunner) at a milestone — TBD.

**No paid speedup.** Office Level is purely emergent from roster activity. This is the deliberate differentiator from Workshop Level, which is per-craft.

---

## 5. Classes

Three classes for MVP. Each class defines a weighted view over the shared affix pool. Workshop crafts roll evenly across the full pool; Office workers roll heavily within their class's specialty.

| Class | Specialty | Pool weighting (sketch) |
|---|---|---|
| Generalist | Balanced | Even weights — same as Workshop |
| Goldsmith | Gold focus | Heavy weight on gold-related affixes |
| Speedrunner | Speed focus | Heavy weight on paint-time-related affixes |

The actual weights and which affix kinds are "gold" vs "speed" depends on the affix-pool rework (subproject §10.2).

**Class is rolled at hire** alongside tier and affixes. Class never changes.

**Class roll distribution.** TBD. Could be uniform (1/3 each), or weighted (e.g., Generalist common, specialists rare). Office Level may unlock the third class at a milestone.

---

## 6. Tiers

Reuses the v3.1 Workshop tier system 1:1:

| Tier | Affix slots | Office Level gate (TBD, sketch) |
|---|---|---|
| Common | 1 | L1 |
| Magic | 2 | L5 |
| Rare | 3 | L15 |
| Epic | 4 | L35 |
| Legendary | 5 | L70 |

**Tier never changes for a worker.** Once rolled, fixed for life. Players keep rare-roll workers and discard low-tier ones; high-tier rolls become rare and special (Diablo-loot mental model).

Tier-roll probability per Office Level — same shape as v3.1 Workshop probability table (linear interp from `(unlock_level, min)` to `(L100, max)`).

---

## 7. Multipliers — how workers buff the canvas

Workers' affixes feed into the same canvas-multiplier functions as Workshop items. Stacking is **additive within an affix kind, across all sources** (workers + workshop items + skill tree).

```
totalGoldMultiplier = 1
  + Σ (workshop equipped items' canvas_gold magnitudes)
  + Σ (hired workers' canvas_gold magnitudes × levelScale(worker.level))
  + Σ (skill-tree contributions)
```

Where `levelScale(level)` is the per-worker level multiplier applied to that worker's rolled affix magnitudes.

**Why additive across sources, not multiplicative:** keeps numbers tractable, prevents runaway compounding when both Workshop and Office invest in the same affix kind. PM-mult remains the only multiplicative outer multiplier in the canvas pipeline.

**Balance corollary.** Combined Workshop + Office contribution per affix kind needs a soft target ceiling. With ~5 worker cap and ~5 affixes max per worker, there can be 25 worker-affix-instances stacking on a single kind, plus ≤2 workshop equipped items. Magnitudes need to be smaller per-instance than today's 5–15% workshop range, OR tuning needs explicit per-source magnitude multipliers. **Decided in §11.**

---

## 8. Reset on ascend

Mirror v3.1 Workshop:

| Field | Persists ascend? |
|---|---|
| `office.level` | ✅ |
| `office.xp` | ✅ |
| `office.roster` | ❌ wiped |
| `office.queue` | ❌ wiped |
| `office.trickleTimer` | ❌ reset |

The institution is permanent meta-progression; the team is run-state. Same shape as Workshop level vs inventory.

`performAscendOrchestrator` calls `officeSlice.resetOffice()` in the same pass as `workshopSlice.resetWorkshop()`.

---

## 9. UI placement

The Office mounts in the existing `office` tab in `<RoomRail>` (currently visible-but-disabled placeholder, alongside Workshop / School / Lab). The tab activates when the player owns ≥1 fame skill-tree node that grants `rosterCap ≥ 1` (the same pattern as the `gear_up` palette node in v3.1 — engine reads from skill-tree state, doesn't ship the gating node itself; user authors it via `/dev/skill-designer`).

**Layout (340px right-rail panel — same slot Workshop currently fills).**

Three vertical sections, top to bottom (sketch, exact widget design TBD):

1. **Office level header** — current Office Level + XP bar to next + tier-cap reminder ("Up to Magic").
2. **Trickle queue** — N candidate cards (visible). Each card: class badge + tier color + affix list + Hire / Reject buttons.
3. **Roster** — N worker cards. Each: same metadata as candidate + level + XP bar + per-worker Train button.

Hover info on every interactive surface (queue cards, roster cards, train, Office Level header) routes through `hoverInfoSlice` (the v1.x hover-info pattern — no Radix tooltips).

**Switching:** clicking the Office tab in RoomRail swaps `<WorkshopRoom>` for `<OfficeRoom>` in the rail slot, identical to how Workshop currently lives there.

---

## 10. Prerequisites (separate subprojects)

This sketch cannot proceed to a plan until two prerequisite waves ship.

### 10.1 Canvas depth — Subproject 1

Implement subjects, quality, palette, drops per `docs/specs/2026-04-25-canvas-design.md` §2–7. Without these new canvas axes, an "expanded affix pool" has nothing to hook into. The Office's class differentiation also collapses to "+gold% vs -time%" with no third dimension.

**Brainstorm and spec for this subproject begins immediately after this sketch is committed.**

### 10.2 Affix pool rework — Subproject 2

Expand `AffixKind` enum and the rolling logic to cover the new canvas axes from subproject 1, plus split per-source weighting if §7's balance corollary requires it. Update `multipliers.ts` to consume the new kinds. Save migration to map old AffixKind values forward (or accept a wipe — game still unreleased).

**Brainstormed after subproject 1's canvas-axis decisions are made**, since the affix pool depends on what canvas mechanics exist.

### 10.3 Painter's Office — this design, then

After subprojects 1 & 2 ship, this sketch is upgraded to a full plan-ready spec by:
- Resolving §11 TBDs (numbers).
- Confirming class affix weights against the actual affix pool from subproject 2.
- Confirming UI layout against any canvas-route changes from subproject 1.

---

## 11. TBDs (resolved after prerequisites land)

| # | TBD | Resolved when |
|---|---|---|
| 11.1 | Trickle rate curve (period as function of Office Level) | After subproject 2 (need affix pool to balance) |
| 11.2 | Queue cap curve (size as function of Office Level) | After subproject 2 |
| 11.3 | Tier-cap by Office Level table | After subproject 2 |
| 11.4 | Hire cost curve (gold per tier) | After subproject 2 |
| 11.5 | Training cost-per-XP rate | After subproject 2 |
| 11.6 | XP-per-canvas-sale value + worker share rule (equal vs proportional) | After subproject 2 |
| 11.7 | Office XP fraction of worker XP (e.g. 100% mirror, 25% damped) | After subproject 2 |
| 11.8 | Tier-roll probability table (mirrors Workshop §6) | After subproject 2 |
| 11.9 | Class roll distribution + Office Level milestones for class unlocks | After subproject 2 |
| 11.10 | Per-level magnitude scaling formula (`levelScale(level)`) | After subproject 2 |
| 11.11 | Per-source magnitude multipliers (if §7 balance requires it) | After subproject 2 |
| 11.12 | Affix kinds + class weighting tables | After subproject 2 |

---

## 12. Out of scope for this design

- **Multi-canvas / parallel canvas slots.** Workers buff the single existing canvas. If parallel canvases return later, it is a separate spec, decoupled.
- **Worker specialization (sub-class branching).** Dropped at brainstorm.
- **Worker tier promotion** (evolve = tier-up). Workers are fixed-tier; tier improvement comes from re-rolling new workers at higher Office Level, not promoting existing ones.
- **Active hire mechanics** (paid candidate slate, refresh button). The queue is purely passive trickle.
- **Worker firing animations / portraits / individuality.** Identity doesn't matter — workers are stat-rolled units, not characters.
- **Subjects/quality/palette wiring on the worker side.** That belongs to subprojects 1 & 2; the Office reads from whatever final affix pool exists.

---

## 13. Engine surface (sketch)

For when this becomes plan-ready:

- New file `src/store/officeSlice.ts` — `OfficeSlice extends OfficeState`, actions: `tickOffice(deltaSeconds)`, `hireFromQueue(candidateId)`, `rejectFromQueue(candidateId)`, `trainWorker(workerId, xpAmount)`, `resetOffice()`.
- New entry in tick order: `tickAll` currently runs `treeTick → canvasTick → skillTreeTick → workshopTick`. Add `officeTick` at the tail. Office tick advances `trickleTimer` + dispatches new candidates when the timer rolls over.
- New helper `src/core/multipliers.ts` extension — `getOfficeContribution(state, kind)` summing all hired workers' magnitudes for a given affix kind, including `levelScale`.
- New config `src/config/officeClasses.ts` — class definitions + weighted distribution tables.
- New selectors `getOfficeRosterCap(state)` (from skill-tree), `getOfficeTierCap(state)` (from office level), `getNextWorkerXp(level)` (formula).
- New ascend hook in `performAscendOrchestrator` — call `state.resetOffice()`.
- New save migration — bump `SAVE_VERSION`, add `office` defaults to migrating saves.
- New components in `src/components/office/` — `<OfficeRoom>` (rail slot), `<QueueCard>`, `<WorkerCard>`, `<OfficeLevelHeader>`.
- RoomRail update — `office.enabled` becomes `rosterCap ≥ 1` instead of hard-coded false.

All numbers, formulas, and tuning live in `src/core/balance.ts` with Vitest tests, per the project's test-driven discipline.

---

## 14. Open questions for the user (defer to plan-write time)

- 11.1–11.12 above (numbers).
- Whether the third class (Speedrunner) is unlocked from L1 or gated behind Office Level / a fame node.
- Whether Train consumes gold, inspi, or both (per worker tier).
- Whether candidates have a "rest timer" before they can be re-trickled (anti-spam if reject is free).
- Whether we want a "lock" toggle on roster cards (prevents accidental fire when at cap and a better candidate trickles in).

---

**Next step:** brainstorm subproject 1 (canvas depth).
