# Post-Ascend Worker Level-Up Reveal — design

**Date:** 2026-05-30
**Status:** Approved (brainstorm) → ready for plan

## Problem

The post-ascend blackout already shows `+fame gained`, the quote, and a `WorkerRollReveal`
that lists each leveled-up worker as one terse line (`Lv 3 → 4` + a joined deltas string).
We want a richer reveal: per-worker avatar + name, the full stat sheet starting at the
*before* values, then each increased stat animating to its new value (teal) with a `+#`
delta — so the player feels their painters growing.

## Goals

Inside the existing `AscendCinematicOverlay` blackout (`fame → quote → workers`):

1. **Worker cards side by side** — one card per leveled-up worker, showing its **avatar +
   name + `Lv before → after`** and its **5-stat sheet starting at the *before* values, in white**.
2. **Stat reveal** — a single shared step walks the 5 stats `0→5`, **400 ms apart**; at step
   _k_ stat _k_ is revealed **across all cards simultaneously**: if it increased for that
   worker, its value flips to the new number, **turns teal**, and a teal **`+#`** appears next
   to the stat's label. Unchanged stats stay white.
3. **Click behavior** — 1st click skips the animation to the final result; 2nd click leaves
   (existing `onDismiss`). No level-ups → 1st click dismisses. `prefers-reduced-motion` →
   jump straight to the end.

Non-goals (YAGNI): no change to the roll data model, no per-worker sequential staging (cards
animate in sync), no sound, no change to the fame/quote rendering.

## Data

`lastAscendRoll: AscendRollEntry[]` already carries `{ id, levelBefore, levelAfter,
statsBefore, statsAfter }`. The worker's **name + avatar are NOT on the entry** — look them
up from the live roster by `id` (workers persist across ascend):
`const w = roster.find((r) => r.id === entry.id)`. If not found (defensive), fall back to a
generic name and avatar 1. `WORKER_AVATARS` from `@/components/painting/workerAvatarMap`.

## 1. Compact delta formatter

`src/components/painting/workerStatDisplay.ts` — add a noun-less short delta for the chip
next to the (already-labeled) stat:

```ts
/** Compact level-up delta for a chip beside the stat label: "+3%", "+1". Null if unchanged. */
export function formatWorkerStatDeltaShort(key: WorkerStatKey, before: number, after: number): string | null {
  if (after === before) return null;
  if (key === "strokesPerCrit") return `+${after - before}`;
  return `+${Math.round((after - before) * 100)}%`; // fractional stats roll in whole pp
}
```

## 2. `WorkerRollReveal` rewrite

`src/components/ascension/WorkerRollReveal.tsx` + its `.module.css`.

**Props:** `{ skip: boolean; onComplete: () => void }`.

**Data:** `roll = useGameStore(s => s.lastAscendRoll)`, `roster = useGameStore(s => s.roster)`.
If `!roll || roll.length === 0` → call `onComplete()` once (effect) and render `null`.

**Reveal step machine:**
- `STEPS = WORKER_STAT_KEYS.length` (5).
- `const [revealed, setRevealed] = useState(0)` — how many stat columns are revealed.
- On mount: if `prefers-reduced-motion` OR `skip` → `setRevealed(STEPS)`. Otherwise a
  `setInterval` (400 ms) increments `revealed` until it reaches `STEPS`, then clears.
- A separate effect: when `skip` flips true → `setRevealed(STEPS)` and clear the interval.
- When `revealed === STEPS` → call `onComplete()` once (guard with a ref so it fires once).

**Render:** a centered flex row (`worker-roll-reveal` testid) of cards. Each card
(`data-testid="worker-roll-card"`):
- avatar `<img>` (`WORKER_AVATARS[avatar - 1]`, ~64px),
- name (serif), `Lv {levelBefore} → {levelAfter}`,
- a stat list; for each `WORKER_STAT_KEYS[k]` render a row:
  - **label** + (if `k < revealed` AND increased) a teal delta chip
    `formatWorkerStatDeltaShort(key, before, after)`,
  - **value**: `formatWorkerStatAbsolute(key, k < revealed ? after : before)`; gets the teal
    class when `k < revealed && after > before`.
  - Row testid `worker-roll-stat-${key}` so tests can assert per-stat state.

## 3. `AscendCinematicOverlay` coordination

`src/components/ascension/AscendCinematicOverlay.tsx`.

- Replace the fixed `HINT_DELAY_MS` timer with reveal-driven state:
  - `const [skip, setSkip] = useState(false)`, `const [revealDone, setRevealDone] = useState(false)`.
  - On entering `blackout` (effect on `phase`): reset both to false.
  - Render `<WorkerRollReveal skip={skip} onComplete={() => setRevealDone(true)} />`.
  - Click handler: `if (!revealDone) setSkip(true); else onDismiss();`
  - Hint (shown only once a step has happened / always visible is fine): text is
    `revealDone ? "— click to continue —" : "— click to skip —"`.
- Everything else (portal, fame/quote, testids `ascend-cinematic-gain/quote`) unchanged.

Edge: a no-level-up ascend → `WorkerRollReveal` fires `onComplete` immediately → `revealDone`
true → first click dismisses (today's behavior preserved).

## Files touched

- `src/components/painting/workerStatDisplay.ts` — add `formatWorkerStatDeltaShort`.
- `src/components/ascension/WorkerRollReveal.tsx` + `.module.css` — rewrite (cards + step machine).
- `src/components/ascension/AscendCinematicOverlay.tsx` — skip/revealDone coordination + hint.
- Tests: `WorkerRollReveal.test.tsx` (new/updated), `AscendCinematicOverlay.test.tsx`
  (click skip→dismiss), `workerStatDisplay` delta-short test.

## Testing

Unit (Vitest + RTL):
- `formatWorkerStatDeltaShort`: `+3%` / `+1` / null on no change.
- `WorkerRollReveal` with `skip` (deterministic final state):
  - one `worker-roll-card` per leveled worker; shows the roster name + avatar img + `Lv a → b`.
  - an **increased** stat row shows the after value, the teal class, and the `+#` chip.
  - an **unchanged** stat row shows the (before==after) value, no chip, no teal class.
  - `onComplete` is called.
  - no roll → renders nothing and still calls `onComplete`.
- Timing (fake timers): without `skip`, `revealed` advances one stat per 400 ms and
  `onComplete` fires after the last; setting `skip` mid-way jumps to the final state.
- `AscendCinematicOverlay`: with a roll present, first click does NOT call `onDismiss` (it
  skips); after `onComplete`, the next click calls `onDismiss`. With no roll, the first click
  calls `onDismiss`.

Visual / eyeball: ascend with workers that level up — cards appear side by side, stats tick
teal one-by-one with `+#`, click skips to the end, click again returns to the game.
