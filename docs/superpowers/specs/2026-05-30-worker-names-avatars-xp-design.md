# Worker identity & XP visibility — design

**Date:** 2026-05-30
**Status:** Approved (brainstorm) → ready for plan

## Problem

Two issues with the Painter's Office workers:

1. **Workers level up too fast.** The ascend XP pool (= fame gained that ascend) is
   spent against a shallow cost curve (`10 × 1.15^level`), so a single worker can gain
   ~15–20 levels in one ascend at mid-game fame.
2. **Workers are faceless.** Every worker shows the hardcoded name "Painter" and the
   same `worker_1.png` avatar, and the office gives no sense of XP progress toward the
   next level.

## Goals

- Rebalance the worker XP-per-level curve to a steeper exponential the player chose.
- Give each worker a persistent **name** (random from a pool) and **avatar** (1 of 4 images).
- Surface **level + XP progress** in the Painter's Office, and per-worker avatars on the canvas overlay.

Non-goals (YAGNI): no per-worker rename UI, no avatar picker, no class/name themency,
no name de-duplication within a roster (repeats allowed), no offline-sim changes.

## 1. XP curve rebalance

`src/core/balance.ts`:

```ts
export const WORKER_XP_BASE = 3000;
export const WORKER_XP_GROWTH = 1.9;

// Cost (in xp = ascend fame) to go from `level` → `level + 1`.
// Worker.level starts at 1, so the first level-up uses level=1 → BASE.
export const workerXpToNext = (level: number): Big =>
  big(WORKER_XP_BASE).mul(big(WORKER_XP_GROWTH).pow(level - 1));
```

Resulting per-level costs:

| Level-up | Cost |
|---|---|
| 1→2 | 3,000 |
| 2→3 | 5,700 |
| 3→4 | 10,830 |
| 4→5 | 20,577 |
| 5→6 | 39,096 |

The pool source (`applyAscendXp(big(fameGain))` in `systems/ascend.ts`), the 50/50
baseline+stroke split, and `getWorkerXpPoolMultiplier` are **unchanged** — only the cost
curve moves. `applyAscendXpToWorker`'s `LEVEL_UP_CAP` (1000) is untouched (still a safety
backstop, now far above realistic gains).

## 2. Worker name + avatar (persisted)

Extend the `Worker` interface in `src/store/officeSlice.ts`:

```ts
export interface Worker {
  // ...existing fields...
  readonly name: string;    // random first-name from the pool, assigned at spawn
  readonly avatar: number;  // 1..4, indexes worker_{n}.png; assigned at spawn
}
```

`createWorker()` assigns both at spawn:

- **Cosmetic randomness only.** Use `Math.random()` (NOT the seeded gameplay `rng`/`rngPick`)
  so name/avatar selection never perturbs the deterministic canvas/catch-up RNG stream.
- `name` = random element of the name pool. `avatar` = random integer in `[1, 4]`.
- Name and avatar are chosen **independently**; duplicates across the roster are allowed.

### Name pool

`src/config/workerNames.ts` — first names of famous, non-controversial painters:

```ts
export const WORKER_NAME_POOL = [
  "Vincent", "Claude", "Frida", "Georgia", "Rembrandt",
  "Henri", "Berthe", "Mary", "Wassily", "Piet",
  "Hilma", "Yayoi", "Artemisia", "Jan", "Joan",
  "Edvard", "Camille", "Paul", "Élisabeth", "Grant",
] as const;
```

(20 names; editable. Deliberately excludes painters with significant abuse/violence
controversies.)

### Avatar assets

`worker_1.png … worker_4.png` already exist in `src/assets/images/Workers/`. Import all four
so Vite fingerprints/bundles them, and index by `worker.avatar`:

```ts
// e.g. a small helper module workerAvatars.ts
import a1 from "@/assets/images/Workers/worker_1.png";
// ...a2, a3, a4
export const WORKER_AVATARS = [a1, a2, a3, a4]; // avatar n → WORKER_AVATARS[n-1]
```

(`e1.png` / `s1.png` are ignored — not part of this feature.)

## 3. Save migration (v28 → v29)

`SAVE_VERSION` 28 → 29 in `src/store/index.ts`. Add a migration block mirroring the existing
sequential pattern:

```ts
if (fromVersion < 29) {
  // v28 → v29 (2026-05-30): workers gain persistent name + avatar.
  const pool = WORKER_NAME_POOL;
  const roster = Array.isArray(state.roster) ? state.roster : [];
  state = {
    ...state,
    roster: roster.map((w) => {
      const worker = w as Record<string, unknown>;
      return {
        ...worker,
        name: typeof worker.name === "string"
          ? worker.name
          : pool[Math.floor(Math.random() * pool.length)],
        avatar: typeof worker.avatar === "number"
          ? worker.avatar
          : 1 + Math.floor(Math.random() * 4),
      };
    }),
  };
}
```

Idempotent-ish: only fills fields that are missing, so re-runs / partially-migrated saves
are safe.

## 4. Display

### OfficeRoom card (`src/components/painting/OfficeRoom.tsx`)

The roster card currently shows: `Painter` · `Level N` · classId · stat rows. Changes:

- Replace the hardcoded `"Painter"` with `worker.name`.
- Add the worker's avatar image (`WORKER_AVATARS[worker.avatar - 1]`) in the card header.
- Add an **XP progress** element under the level: a thin bar plus
  `formatBig(worker.xp) / formatBig(workerXpToNext(worker.level))` text
  (e.g. `4.20K / 10.83K xp`). Bar fill = `xp / xpToNext` clamped to [0,1].
  - Big-number safe: compute the fraction via `worker.xp.div(workerXpToNext(level))`
    then `.toNumber()` for the CSS width only.

### Canvas overlay (`src/components/painting/WorkerAvatars.tsx`)

- Render each worker's own avatar (`WORKER_AVATARS[worker.avatar - 1]`) instead of the
  single CSS-baked `worker_1.png`. The `.portrait` background-image rule in
  `WorkerAvatars.module.css` is replaced by an inline/per-element image.
- Keep the existing `Lv N` label and cooldown fill. (Name is optional here; primary
  name+XP surface is the office. Decide during impl whether to add a small name label —
  default: no, to keep the overlay light.)

## Testing

- `tests/core/balance.test.ts` — `workerXpToNext` returns the new curve values
  (3000, 5700, 10830, …); update existing assertions.
- `createWorker()` — produces `name ∈ pool` and `avatar ∈ {1,2,3,4}`.
- Migration — a v28 worker object without `name`/`avatar` gains both after `migrate(...)`;
  an already-migrated worker keeps its values.
- `OfficeRoom` — renders `worker.name` and an XP readout; avatar `<img>` present.
- Existing worker-ascend / multipainter / canvas tests stay green (no logic-path change
  beyond the cost curve, which their fixtures may need re-baselining).

## Files touched

- `src/core/balance.ts` (curve constants + formula)
- `src/config/workerNames.ts` (new)
- `src/components/painting/workerAvatars.ts` (new helper — imports the 4 images, exports `WORKER_AVATARS`)
- `src/store/officeSlice.ts` (`Worker` fields, `createWorker`)
- `src/store/index.ts` (`SAVE_VERSION`, migration block)
- `src/components/painting/OfficeRoom.tsx` (+ its CSS module)
- `src/components/painting/WorkerAvatars.tsx` (+ its CSS module)
- Tests as above.
