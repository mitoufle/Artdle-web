# Painter's Office — Autonomous-Painter Redesign

**Date:** 2026-05-29
**Status:** Design-ready (brainstorm complete). Replaces the trickle/hire/queue Office
(`docs/superpowers/specs/2026-05-10-painters-office-design.md`), which is now superseded.
**Targets:** the live game directly (no v2 redesign is planned — see `MEMORY` / project notes).

---

## 1. Concept

The old Office was *"the Workshop, but idle"* — workers fed the same additive affix pool as
items, giving it no distinct identity. This redesign throws that out.

**A worker is an autonomous mini-player who paints the shared canvas at their own rhythm.**
Each worker spawns at level 1 with roughly the stats a brand-new player has, is weak at first,
and grows very slowly over a *long* RPG arc gated to ascends. The fantasy is "apprentices at
their own easels filling your canvas alongside you," not "a stat stick."

This gives the Office a clean identity distinct from the Workshop:
- **Workshop** = active. You shop for items that buff *your* painting.
- **Office** = a roster of independent painters who paint *with* you and level up over the long haul.

The old hire / reject / trickle-queue loop, hire cost, and Office Level are all **removed**.

---

## 2. The shared-canvas painter model

There is **one visible canvas** (unchanged). The set of painters is **you + every hired worker**.
Each painter has an **independent stroke cadence** and strokes the *same* canvas — more/faster
painters fill it faster.

### 2.1 A worker's five stats

| Stat | Nature | Effect when that worker paints |
|---|---|---|
| **Speed** (strokes/sec) | personal | the worker's own stroke cadence |
| **Crit chance** (≤ 50% hard cap) | personal | rolled on the worker's own strokes |
| **Strokes per crit** | personal | the worker's crit fills this many bonus chunks |
| **Combo chance** | personal | used when the worker completes a sale (rolls the shared chain) |
| **Gold per canvas** | **shared multiplier** | multiplies the player's gold-per-canvas on every sale |

Four of the five stats are **purely personal** — they govern *how that worker paints* and are
never pooled with the player or with other workers. The single exception is **Gold per canvas**,
which is a multiplier on the player's gold-per-canvas (because the sale value is a canvas-level
quantity, not a per-painter one). This is the resolution to "whose gold sets the sale price."

### 2.2 Tick: discrete-event multi-painter scheduling

The current `canvasTickPure` is a single-painter time-budget loop. It is reworked into a
**discrete-event scheduler** over all painters:

1. Each painter tracks time-until-next-stroke (`chunkInterval(painter.speed)`).
2. Within the frame's `deltaSeconds`, repeatedly: pick the painter whose next stroke comes
   soonest, advance time to it, and apply that stroke:
   - advance shared `canvasProgress` by 1 chunk;
   - roll **that painter's** crit chance → on crit, advance progress by **that painter's**
     strokes-per-crit bonus chunks (bonus chunks still spill across canvas boundaries, as today);
   - if progress fills the canvas → **sale fires**.
3. On a sale: `gold = canvasGold(playerGoldMult, tier) × workerGoldFactor × comboBonusFactor(chain)`,
   then reset progress and roll the **shared combo chain** using the **completing painter's**
   combo chance.
4. Each worker accumulates **strokes landed this run** (used for ascend-XP — §4).

- **`workerGoldFactor`** = product of `(1 + worker.goldStat)` across the roster. (Multiplicative,
  matching "multiplicateur"; *tunable* — could be additive if it scales too hard with the cap.)
- **Combo chain** stays a single canvas-level counter; only the completing painter's combo
  chance rolls it. (*Tunable* alternative: per-painter chains — rejected for now as more complex.)
- The player remains a painter with their existing stats (`sellPriceLevel`, `speedLevel`,
  `critLevel`, item/skill crit-chunks & combo). Workers are *additional* painters.

The lump-sum-on-sale gold display (HANDOVER `25ddba0`) is preserved — gold is still credited as a
single lump when a canvas completes; per-painter accounting is internal only.

---

## 3. Leveling: ascend-only, increment rolls

**Workers improve only at ascend.** Within a run they are static. All level-ups and stat growth
happen on the **post-ascend roll screen** (§4.2). This is what makes the scaling "très long" and
ties worker growth to the ascend ritual.

**Each level-up rolls a growth increment per stat** (this is an *increment size*, not a
chance-to-level):

| Stat | Per-level-up increment (rolled) |
|---|---|
| Gold per canvas | `+0 / +1 / +2 / +3 / +4 / +5 %` |
| Speed | `+0 / +1 / +2 / +3 / +4 / +5 %` |
| Crit chance | `+0 / +1 / +2 / +3 / +4 / +5 %` (then clamped at the 50% cap) |
| Combo chance | `+0 / +1 / +2 / +3 / +4 / +5 %` |
| Strokes per crit | `+0 or +1` (integer) |

The roll distribution per stat (uniform vs weighted) and the level-1 starting values
("a fresh player's stats") are *tunable*; starting point: a level-1 worker ≈ base player
(speed = 1 stroke / `BASE_CHUNK_INTERVAL`, crit 1%, strokes-per-crit 1, gold ×1, combo 0%).

---

## 4. Ascend XP

### 4.1 Pool + split (hybrid)

Workers gain XP **at ascend**, then convert it to level-ups.

- **Pool size scales with run magnitude** so workers keep progressing as the game scales.
  Starting anchor: pool ∝ **gold earned this run** (*tunable*; could be strokes painted, or fame
  gained).
- **Split = contribution-weighted with a baseline floor (hybrid).** Each worker's share =
  `floor_share + weight × (worker_strokes_this_run / total_worker_strokes)`. Contribution matters
  (strong painters pull ahead) but a freshly-spawned level-1 worker still gets enough to climb, so
  unlocking a new slot is never a trap. The floor/weight ratio is the central *tunable*.
- **XP-to-next-level curve** is steep (long tail): `workerXpToNext(L) = base × growth^L`
  (start from the existing `WORKER_XP_GROWTH = 1.15`; *tunable*). A single ascend may grant several
  levels early and a fraction of a level late.

### 4.2 Post-ascend roll screen

The ascend cinematic already plays a door animation + shows fame gained + a quote
(`AscendCinematicOverlay.tsx`). The worker roll screen is **appended to that sequence**: after the
door, alongside fame + quote, each worker shows its level-up(s) and the **stat increments rolled**
(an animated "+X% gold, +1 stroke/crit, …" reveal per worker). This is the payoff moment for the
whole system.

---

## 5. Acquisition

- **Worker slots are unlocked through the fame skill tree.** Unlocking a slot **spawns a fresh
  level-1 worker** into it. No gold hire cost, no candidate queue.
- **Roster cap = number of unlocked slots**, and stays **small** (a handful). "Très long scaling"
  comes from *leveling* workers across many ascends, not from amassing them.
- Reuses the existing `roster_slot` capability selector (`getRosterCap`), repurposed: each
  unlocked slot now auto-spawns a worker rather than enabling a manual hire.

---

## 6. Class framework (mechanic locked; content deferred)

**Locked mechanic:** *a class is a stat-roll bias profile.*
- All workers start in one **base class** that rolls all five stats evenly (the §3 increments).
- A specialist class **skews those rolls** toward 1–2 stats (e.g. a gold class rolls gold higher
  and more often). Stronger classes = stronger skews / higher roll ceilings.
- **Mastery** = levels gained while assigned to a class. Class switching unlocks past a threshold
  worker level.
- **Tier-2 classes unlock** when a worker has ≥ X mastery across ≥ Y distinct classes.

**Deferred to a follow-up content spec:** the actual class roster, their bias profiles, and the
unlock graph. This spec only commits the *framework hook* (a `classId` on the worker + a
bias-profile lookup that shapes the §3 roll) so the engine and roll screen are class-aware from
day one. Designing the full class tree here would swallow the spec.

The **old class system is deleted** (`src/config/officeClasses.ts`,
generalist/goldsmith/speedrunner, `OFFICE_CLASSES`). Classes now emerge from this framework.

---

## 7. Persistence & ascend behavior

**Workers persist across ascends** — this is the core of the long RPG arc.

- **Remove `resetOffice()` from the ascend orchestrator** (`ascend.ts:44`). Instead, ascend
  triggers the *XP/level-up pass* (§4) and resets only the **per-run contribution counters**
  (strokes-this-run), not the roster.
- The roster, each worker's level/xp/stats/class/mastery all survive ascend (and persist to save).

---

## 8. Skill-tree node migration

Audit every Office-related node and adapt or delete (refund fame on migration for deleted nodes,
using each node's actual per-level cost table — same pattern as the size-node refund in
`SAVE_VERSION 24`):

| Node / capability | Action |
|---|---|
| `roster_slot` (Hire Manager) | **Adapt** → "unlock a worker slot (spawns a level-1 painter)" |
| `worker_xp_mult` (Accelerator) | **Adapt** → boosts ascend-XP pool for workers |
| `queue_slot` (Recruiter) | **Delete** (no queue) — refund |
| `hire_cost_reduction` | **Delete** (no hire cost) — refund |
| `class_goldsmith` / `class_speedrunner` (Gold Diggers, etc.) | **Delete** (classes no longer tree-gated) — refund |

Exact node-by-node pass (descriptions, capability strings, DAG edges) happens at plan-write.

---

## 9. Display

Workers render as **avatars overlaid near the canvas** (on the background), each with a small
**next-stroke timing indicator** (a fill/cooldown showing when that worker will stroke next).
The avatars are read-only during a run (workers are static mid-run); management (class switch,
viewing stats) lives in the Office tab / on the roll screen.

---

## 10. Engine surface (for plan-write)

**Rewrite/extend:**
- `src/core/canvasTickPure.ts` — single-painter loop → multi-painter discrete-event scheduler (§2.2).
- `src/store/officeSlice.ts` — replace worker schema (5-stat sheet, level, xp, classId, mastery,
  strokesThisRun); drop queue/trickle/hireCost; actions: `spawnWorker(slot)`, `applyAscendXp()`,
  `switchClass(workerId, classId)`, `resetRunContribution()`.
- `src/core/multipliers.ts` — `getOfficeContribution` reworked: workers no longer feed the affix
  pool; only `workerGoldFactor` feeds canvas gold.
- `src/systems/ascend.ts` — remove `resetOffice()`; call worker XP/level-up pass + run-counter reset.

**New:**
- `src/core/workerRoll.ts` — per-level-up stat increment rolls (class-biased), level-up resolution.
- `src/core/balance.ts` — new tunables (§12) with Vitest tests.
- worker roll-screen UI hooked into `AscendCinematicOverlay`.
- worker avatars + next-stroke indicator near the canvas.

**Delete:**
- `src/config/officeClasses.ts`, trickle/hire/queue code, Office Level, old worker affix schema.

---

## 11. Save migration

- Bump `SAVE_VERSION`.
- Drop old office state (queue, trickleTimer, officeLevel, officeXp, old worker affix arrays).
- Initialize the new roster: spawn a fresh level-1 worker for each currently-unlocked `roster_slot`.
- Refund fame for deleted skill nodes (§8).
- Tree migration is trivial (it resets each ascend); reset `partLevels` to the new 10-tier
  structure on migrate (covered in the companion crit/tree spec).

---

## 12. Tunable numbers (set in `balance.ts`, refined by playtest)

Crit chance cap (50%) and the §3 increment ladder are **locked shapes**; magnitudes below are
starting points to feel-test:

- Level-1 starting stats (≈ fresh player).
- Stat-increment roll distribution (uniform 0–5% / 0–1).
- `workerXpToNext` base + growth (start 1.15).
- Ascend-XP pool anchor (∝ run gold) + scale.
- Hybrid split: baseline floor vs contribution weight.
- Roster cap progression (how many slots, at what fame-tree depth).
- `workerGoldFactor` stacking (multiplicative vs additive).

---

## 13. Out of scope (this spec)

- The class roster + unlock graph (→ follow-up content spec).
- Per-painter combo chains (kept shared for now).
- Worker portraits / individual identity beyond avatar + stats.
- Multi-canvas.
