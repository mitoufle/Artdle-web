# Crit-Chunks & Inspiration-Tree Rebalance

**Date:** 2026-05-29
**Status:** Design-ready (brainstorm complete).
**Targets:** the live game directly. Companion to
`2026-05-29-office-painter-redesign-design.md` (the worker stats interact with crit; see note).

Two independent balance reworks the player flagged:
1. **#2 — `+crit_chunks` item affix is overpowered.**
2. **#3 — Inspiration-tree upgrades feel weird; early upgrades go dead instantly.**

---

## Part 1 — Crit-chunks item rebalance (#2)

### The problem (measured)

A crit fills free chunks at no time cost, so average throughput = `1 + critChance × strokesPerCrit`
— **tier-independent and uncapped**. Crit *chance* is soft-capped (95% player); the *payload* is not.

`workshopRoll.ts:142-143` adds the flat `magnitudeBonus` (`Craftsmanship × 5 +
better_scaling × workshopLevel`) to **every** affix kind, including `+crit_chunks`. For a percent
affix +15–20 is minor; for a raw-integer stat meant to roll 3–5 it is catastrophic and
**unbounded** — it climbs with workshop level. A live legendary item with 4 `+crit_chunks` rolls
currently reads **~80–90 strokes per crit**.

### The fix — read magnitude as a percentage of the base

Instead of adding the magnitude as flat chunks, the magnitude **scales the base
additional-chunks-per-crit**:

```
playerStrokesPerCrit = floor( BASE_CRIT_CHUNKS × (1 + Σ item_magnitude / 100) )
```

- `BASE_CRIT_CHUNKS = 1`. Each `+crit_chunks` magnitude `m` contributes `+m%` to the base.
- **Socks** stays a ×1.5 on the boots crit affix's percentage.
- The live 4×~85 item → `1 × (1 + 0.85) = 1.85` → **1** (+ trigger = 2 chunks/crit), down from ~81–91.

### Why this approach

- **Self-bounding:** it's a percentage of a *small* base (1), so even inflated magnitudes can't run
  away the way a flat add does. Workshop-level inflation still grows it but ~100× slower.
- **No save migration, no roll-path change.** Stored magnitudes are kept; `getAffixMagnitudeBonus`
  may still apply (it just feeds the %). The change is **one site** in `getCritChunks`.
- **Items become support, not the engine:** a single item is weak (~+100% needed to add one chunk),
  which is the intent.

### Scope notes

- This affects **only the player's** crit chunks (items + base). **Workers have their own personal
  strokes-per-crit stat** (office redesign §2.1) and are *not* part of this number — so there is no
  worker-combination rule to decide here.
- UI: show the per-item **effective** contribution (e.g. `+0.85 strokes/crit`) so a single item
  doesn't read as a meaningless "+0".

### Tunables
- `BASE_CRIT_CHUNKS` (1) — raising it makes items matter more.
- Socks multiplier (1.5).

---

## Part 2 — Inspiration-tree generator rework (#3)

### The problem

Today output is `level × rate`, additive across parts, and `rate` jumps **×10 per stage**. The
moment a new stage unlocks, the previous stage's parts become a rounding error and are never
touched again — early upgrades go permanently dead. Stage gating on *level count* also fights the
*rate* incentive (you only ever want the newest part), making upgrade choices muddy.

### The redesign

**One upgrade per tier, 10 tiers.** Each tier is a single upgrade you level. The tree becomes a set
of generators where deep-leveling an *old* generator is a real late-game play.

**1. Newer tiers start stronger.** `baseRate(tier)` ramps up per tier, so early on you chase the
newest upgrade — progression *feel* is unchanged ("a vieux upgrade is a bit useless when you're on
a newer tier").

**2. Powerful level milestones let old upgrades catch up.** Each upgrade's output is:

```
output(tier, level) = level × baseRate(tier) × milestoneMult(level)
```

`milestoneMult` jumps at **L 10 / 25 / 50 / 100 / 200 / 400 / 800 / 1000**. The multipliers are
**powerful and back-loaded** — the big jumps live at 400/800/1000 — so pushing an old, cheap
upgrade to its high milestones is a deliberate late-game investment that brings it back into
competition with the frontier. (This is the mechanic that fixes "early upgrades go dead.")

**3. Tiers unlock by total inspiration/sec, not level count.** A tier unlocks when **total
inspiration/sec crosses a flat threshold**. Because the threshold reads *total* output, **leveling
*any* upgrade moves you toward the next unlock** — you're free to level whichever upgrade is most
cost-efficient (e.g. chasing a cheap old upgrade's next milestone) and still progress.

### Worked example (illustrative — exact numbers are the central playtest dial)

With a base-rate ramp of ×5 per tier and a back-loaded milestone schedule that compounds to
~×35,000 at L1000, a Tier-1 upgrade pushed to **L1000** roughly matches a **freshly-unlocked
Tier-10** upgrade — i.e. maxing an old upgrade makes it competitive with the frontier again. The
exact ramp + milestone magnitudes are tuned by feel; the *shape* (back-loaded, powerful) is locked.

### Cost & migration

- **Cost per level** stays geometric (`baseCost(tier) × growth^level`, growth ≈ 1.15), with a
  per-tier base-cost ramp so old upgrades stay cheap-per-level (which is what makes chasing their
  milestones efficient).
- **Migration:** replace the 6-stage / 15-part `TREE_STAGES` with the 10-tier / 10-upgrade config;
  on migrate, reset `partLevels` to the new structure. The tree **resets every ascend already**
  (`ascend.ts:41`), so this costs at most the current run's tree progress — acceptable and
  self-healing.

### Tunables (locked shapes, feel-tested magnitudes)
- `baseRate(tier)` ramp (start ×5 per tier).
- `milestoneMult` schedule at the 8 milestone levels (back-loaded, powerful; start compounding
  to ~×35k at L1000).
- Per-tier `baseCost` ramp + cost growth (start 1.15).
- Per-tier unlock thresholds in inspiration/sec.
- Number of tiers (10).

### Engine surface
- `src/config/treeStages.ts` → 10-tier config (one upgrade each; `baseRate`, `baseCost`,
  `unlockInspiPerSec`).
- `src/core/balance.ts` — `milestoneMult(level)`, updated `inspiPerSec`, `treePartCost`;
  Vitest tests for every formula.
- `src/store/treeSlice.ts` — unlock check reads total inspi/sec instead of stage-level-count;
  `getProducingParts` / stage selectors reworked to the flat tier list.
- `src/routes/TreeRoute.tsx` + tree components — one-upgrade-per-tier UI, milestone progress
  display, inspi/sec unlock readout.
- Save migration (`SAVE_VERSION` bump) — reset tree to new structure.
