# Worker Names, Avatars & XP Visibility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Steepen the worker XP-per-level curve (`3000 × 1.9^(level−1)`), give each worker a persistent random painter name + 1-of-4 avatar, and surface level/XP progress in the Painter's Office.

**Architecture:** XP curve is a two-constant change in `balance.ts`. Name/avatar are two new persisted `Worker` fields assigned at spawn with **cosmetic** `Math.random()` (never the seeded gameplay RNG), backfilled onto legacy saves by a v28→v29 migration. Display reuses existing OfficeRoom CSS (the `.workerXp*` classes already exist) plus a per-worker avatar `<img>`; the canvas overlay switches from a CSS-baked single image to a per-worker inline background.

**Tech Stack:** React 19 + TS strict, Zustand persist (`idb-keyval`), `break_eternity.js` (`Big`), Vitest. `@/` = `src/`.

**Spec:** `docs/superpowers/specs/2026-05-30-worker-names-avatars-xp-design.md`

---

## File Structure

- `src/core/balance.ts` — XP curve constants + `workerXpToNext` (modify)
- `src/config/workerNames.ts` — name pool (create)
- `src/components/painting/workerAvatars.ts` — imports the 4 PNGs, exports `WORKER_AVATARS` (create)
- `src/store/officeSlice.ts` — `Worker.name`/`Worker.avatar`, `createWorker` (modify)
- `src/store/index.ts` — `SAVE_VERSION` 28→29 + migration block (modify)
- `src/components/painting/OfficeRoom.tsx` + `.module.css` — name + avatar + XP strip (modify)
- `src/components/painting/WorkerAvatars.tsx` + `.module.css` — per-worker avatar (modify)
- Tests alongside each (modify/create)

---

## Task 1: Rebalance the worker XP curve

Steeper curve breaks 4 existing tests that assumed cheap levels; this task changes the formula AND re-baselines them in one commit.

**Files:**
- Modify: `src/core/balance.ts` (the `WORKER_XP_*` block near line 316)
- Test: `tests/core/balance.test.ts` (the `workerXpToNext` describe, ~line 289)
- Re-baseline: `tests/core/workerAscend.test.ts`, `tests/store/officeSlice.test.ts`

- [ ] **Step 1: Rewrite the `workerXpToNext` test for the new curve**

In `tests/core/balance.test.ts`, ensure the import block (around line 29) includes `WORKER_XP_GROWTH`:

```ts
  workerXpToNext,
  WORKER_XP_BASE,
  WORKER_XP_GROWTH,
```

Replace the entire `describe("workerXpToNext", …)` block (lines ~289–298) with:

```ts
describe("workerXpToNext", () => {
  it("equals WORKER_XP_BASE for the first level-up (level 1 → 2)", () => {
    expect(workerXpToNext(1).eq(big(WORKER_XP_BASE))).toBe(true);
  });
  it("grows by WORKER_XP_GROWTH per level", () => {
    const l1 = workerXpToNext(1);
    const l2 = workerXpToNext(2);
    expect(l2.div(l1).toNumber()).toBeCloseTo(WORKER_XP_GROWTH, 4);
  });
  it("matches the approved curve (3000, 5700, 10830)", () => {
    expect(workerXpToNext(1).toNumber()).toBeCloseTo(3000, 6);
    expect(workerXpToNext(2).toNumber()).toBeCloseTo(5700, 6);
    expect(workerXpToNext(3).toNumber()).toBeCloseTo(10830, 6);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/core/balance.test.ts`
Expected: FAIL — `workerXpToNext(1)` is currently `11.5` (base 10 × 1.15), not `3000`.

- [ ] **Step 3: Update the constants + formula in `balance.ts`**

Replace the existing three lines (currently `WORKER_XP_BASE = 10`, `WORKER_XP_GROWTH = 1.15`, and the `workerXpToNext` arrow using `.pow(level)`):

```ts
export const WORKER_XP_BASE = 3000;
export const WORKER_XP_GROWTH = 1.9;

/** Cost (xp = ascend fame) to go from `level` → `level + 1`. Worker.level starts
 *  at 1, so the first level-up uses level=1 → BASE. Approved curve: 3000 × 1.9^(level-1)
 *  → 3000, 5700, 10830, 20577, … (see 2026-05-30 worker XP spec). */
export const workerXpToNext = (level: number): Big =>
  big(WORKER_XP_BASE).mul(big(WORKER_XP_GROWTH).pow(level - 1));
```

- [ ] **Step 4: Run the balance test to verify it passes**

Run: `npx vitest run tests/core/balance.test.ts`
Expected: PASS.

- [ ] **Step 5: Re-baseline the ascend tests that assumed cheap levels**

In `tests/core/workerAscend.test.ts`:

- Test `"levels up and rolls stat increments; mastery tracks levels"` — change the pool so it actually crosses level boundaries under the new curve. Replace `big(500)` with `big(20000)` (funds 3 levels: 3000+5700+10830 = 19530 ≤ 20000):

```ts
    const r = applyAscendXpToWorker(w, big(20000));
```

- Test `"no level-up when the share is below the next-level cost"` — the assertion still passes (1 < 3000), only the inline comment is stale. Update it:

```ts
    const w = createWorker(); // level 1, xp 0; workerXpToNext(1) === 3000
```

- Test `"levels-per-ascend stays bounded …"` — assertions still hold (fresh gains 2, vet gains 0), only the comment's "~34 levels" is stale. Update the comment body to:

```ts
    // At growth 1.9 a 10k pool gives a FRESH worker 2 levels (3000+5700 = 8700 ≤ 10k,
    // the 3rd level costs 10830 > the 1300 remainder) and a level-50 veteran 0 (their
    // next level alone dwarfs 10k). vetGain==0 is INTENTIONAL. Rails assert cap-safety
    // (freshGain << LEVEL_UP_CAP) and the fresh>vet catch-up shape.
```

In `tests/store/officeSlice.test.ts`:

- Test `"grants XP, levels workers, captures the roll, and resets strokesThisRun"` — replace `big(1000)` with `big(20000)` (a single worker takes the whole pool → 3 levels):

```ts
    useGameStore.getState().applyAscendXp(big(20000));
```

- Test `"accelerator nodes boost the pool (more levels)"` — replace **both** `big(100)` calls with `big(2500)` so the +50% pool (×5 accelerator) crosses the first level boundary (2500 → no level; 3750 → level 2):

```ts
    useGameStore.getState().applyAscendXp(big(2500));
```

(There are two such calls in that test — update both.)

- [ ] **Step 6: Run the re-baselined tests to verify they pass**

Run: `npx vitest run tests/core/workerAscend.test.ts tests/store/officeSlice.test.ts`
Expected: PASS (all).

- [ ] **Step 7: Commit**

```bash
git add src/core/balance.ts tests/core/balance.test.ts tests/core/workerAscend.test.ts tests/store/officeSlice.test.ts
git commit -m "core(office): steepen worker XP curve to 3000 x 1.9^(level-1)"
```

---

## Task 2: Name pool config

**Files:**
- Create: `src/config/workerNames.ts`
- Test: `tests/config/workerNames.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/config/workerNames.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { WORKER_NAME_POOL } from "@/config/workerNames";

describe("WORKER_NAME_POOL", () => {
  it("is a non-empty list of distinct non-empty strings", () => {
    expect(WORKER_NAME_POOL.length).toBeGreaterThanOrEqual(12);
    expect(new Set(WORKER_NAME_POOL).size).toBe(WORKER_NAME_POOL.length);
    for (const n of WORKER_NAME_POOL) {
      expect(typeof n).toBe("string");
      expect(n.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/config/workerNames.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the name pool**

Create `src/config/workerNames.ts`:

```ts
/**
 * First names of famous, non-controversial painters. Workers draw a random name
 * from this pool at spawn (cosmetic only — see officeSlice.createWorker).
 */
export const WORKER_NAME_POOL = [
  "Vincent", "Claude", "Frida", "Georgia", "Rembrandt",
  "Henri", "Berthe", "Mary", "Wassily", "Piet",
  "Hilma", "Yayoi", "Artemisia", "Jan", "Joan",
  "Edvard", "Camille", "Paul", "Élisabeth", "Grant",
] as const;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/config/workerNames.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/workerNames.ts tests/config/workerNames.test.ts
git commit -m "config(office): add worker name pool"
```

---

## Task 3: Worker `name` + `avatar` fields and `createWorker`

**Files:**
- Modify: `src/store/officeSlice.ts` (`Worker` interface ~line 18, `createWorker` ~line 80)
- Test: `tests/store/officeSlice.test.ts` (the `createWorker` describe, ~line 31)

- [ ] **Step 1: Write the failing test**

In `tests/store/officeSlice.test.ts`, add inside `describe("createWorker", …)` (after the existing first `it`):

```ts
  it("assigns a name from the pool and an avatar in 1..4", () => {
    const w = createWorker();
    expect(WORKER_NAME_POOL).toContain(w.name);
    expect(Number.isInteger(w.avatar)).toBe(true);
    expect(w.avatar).toBeGreaterThanOrEqual(1);
    expect(w.avatar).toBeLessThanOrEqual(4);
  });
```

Add the import near the top of the test file (with the other `@/` imports):

```ts
import { WORKER_NAME_POOL } from "@/config/workerNames";
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/store/officeSlice.test.ts`
Expected: FAIL — `w.name`/`w.avatar` are `undefined` (and TS will flag the missing fields).

- [ ] **Step 3: Add the fields + assignment**

In `src/store/officeSlice.ts`, add the import (with the other imports at the top):

```ts
import { WORKER_NAME_POOL } from "@/config/workerNames";
```

Add the two readonly fields to the `Worker` interface (after `strokesThisRun`):

```ts
  /** Random painter name from WORKER_NAME_POOL — cosmetic, assigned at spawn. */
  readonly name: string;
  /** Avatar index 1..4 → worker_{n}.png — cosmetic, assigned at spawn. */
  readonly avatar: number;
```

Add cosmetic pickers just above `createWorker` (NOT the seeded `rng` — keep canvas/catch-up determinism intact):

```ts
/** Cosmetic-only randomness (name/avatar). Deliberately NOT the seeded gameplay
 *  rng — picking these must never perturb the canvas/catch-up RNG stream. */
const randomName = (): string =>
  WORKER_NAME_POOL[Math.floor(Math.random() * WORKER_NAME_POOL.length)]!;
const randomAvatar = (): number => 1 + Math.floor(Math.random() * 4);
```

Add the two fields to the object returned by `createWorker` (after `strokesThisRun: 0,`):

```ts
  name: randomName(),
  avatar: randomAvatar(),
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/store/officeSlice.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/officeSlice.ts tests/store/officeSlice.test.ts
git commit -m "store(office): give workers a persistent name + avatar"
```

---

## Task 4: Avatar asset helper

**Files:**
- Create: `src/components/painting/workerAvatars.ts`
- Test: `tests/components/painting/workerAvatars.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/components/painting/workerAvatars.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { WORKER_AVATARS } from "@/components/painting/workerAvatars";

describe("WORKER_AVATARS", () => {
  it("exposes 4 resolved image paths", () => {
    expect(WORKER_AVATARS).toHaveLength(4);
    for (const src of WORKER_AVATARS) {
      expect(typeof src).toBe("string");
      expect(src.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/components/painting/workerAvatars.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the helper**

Create `src/components/painting/workerAvatars.ts`:

```ts
import worker1 from "@/assets/images/Workers/worker_1.png";
import worker2 from "@/assets/images/Workers/worker_2.png";
import worker3 from "@/assets/images/Workers/worker_3.png";
import worker4 from "@/assets/images/Workers/worker_4.png";

/** Avatar `n` (1..4 on a Worker) maps to WORKER_AVATARS[n - 1]. */
export const WORKER_AVATARS = [worker1, worker2, worker3, worker4] as const;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/components/painting/workerAvatars.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/painting/workerAvatars.ts tests/components/painting/workerAvatars.test.ts
git commit -m "ui(office): add worker avatar image map"
```

---

## Task 5: Save migration v28 → v29

**Files:**
- Modify: `src/store/index.ts` (`SAVE_VERSION` line 44; `migrate` function, append a block)
- Test: `tests/store/migration-v29.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/store/migration-v29.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { migrate } from "@/store";
import { big } from "@/core/bigNumber";
import { createBaseStats } from "@/core/workerModel";
import { WORKER_NAME_POOL } from "@/config/workerNames";

const legacyWorker = () => ({
  id: "legacy-1", classId: "base", level: 3, xp: big(0),
  stats: createBaseStats(), mastery: 0, strokesThisRun: 0,
  // no name, no avatar
});

describe("migrate v28 → v29 (worker name + avatar)", () => {
  it("backfills name + avatar on workers that lack them", () => {
    const result = migrate({ roster: [legacyWorker()] }, 28);
    const w = result.roster[0]!;
    expect(WORKER_NAME_POOL).toContain(w.name);
    expect(w.avatar).toBeGreaterThanOrEqual(1);
    expect(w.avatar).toBeLessThanOrEqual(4);
  });

  it("preserves name + avatar that are already present", () => {
    const result = migrate(
      { roster: [{ ...legacyWorker(), name: "Frida", avatar: 2 }] },
      28,
    );
    const w = result.roster[0]!;
    expect(w.name).toBe("Frida");
    expect(w.avatar).toBe(2);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/store/migration-v29.test.ts`
Expected: FAIL — migrated worker has `name === undefined` (no v29 block yet).

- [ ] **Step 3: Bump version + add the migration block**

In `src/store/index.ts`:

Change line 44:

```ts
export const SAVE_VERSION = 29;
```

Add the import (with the other `@/` imports at the top of the file):

```ts
import { WORKER_NAME_POOL } from "@/config/workerNames";
```

Append this block to the `migrate` function, **after the last existing `if (fromVersion < 28)` block** and before the final `return`:

```ts
  if (fromVersion < 29) {
    // v28 → v29 (2026-05-30): workers gain a persistent cosmetic name + avatar.
    // Backfill only missing fields (idempotent for partially-migrated saves).
    const roster = Array.isArray(state.roster) ? state.roster : [];
    state = {
      ...state,
      roster: roster.map((entry) => {
        const w = entry as Record<string, unknown>;
        return {
          ...w,
          name: typeof w.name === "string"
            ? w.name
            : WORKER_NAME_POOL[Math.floor(Math.random() * WORKER_NAME_POOL.length)],
          avatar: typeof w.avatar === "number" ? w.avatar : 1 + Math.floor(Math.random() * 4),
        };
      }),
    };
  }
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/store/migration-v29.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add src/store/index.ts tests/store/migration-v29.test.ts
git commit -m "store: migrate v28->v29 backfilling worker name + avatar"
```

---

## Task 6: OfficeRoom — name, avatar, XP strip

**Files:**
- Modify: `src/components/painting/OfficeRoom.tsx` (`WorkerStatCard`, ~lines 7–25)
- Modify: `src/components/painting/OfficeRoom.module.css` (add `.cardAvatar`)
- Test: `tests/components/painting/OfficeRoom.test.tsx`

- [ ] **Step 1: Write the failing test**

In `tests/components/painting/OfficeRoom.test.tsx`, add the imports (with existing ones):

```ts
import { big } from "@/core/bigNumber";
```

Add this `it` inside `describe("OfficeRoom", …)`:

```ts
  it("renders the worker's name, avatar, and an XP readout", () => {
    const w = { ...createWorker(), name: "Vincent", level: 3, xp: big(1500) };
    useGameStore.setState({ roster: [w], purchasedNodes: { hire_manager: 1, entrepreneur: 1 } });
    render(<OfficeRoom />);
    expect(screen.getByText("Vincent")).toBeInTheDocument();
    expect(screen.getByTestId("worker-avatar-img")).toBeInTheDocument();
    // xp readout shows "current / next" — workerXpToNext(3) = 10830 → "10.83K"
    expect(screen.getByTestId("worker-xp-readout")).toHaveTextContent("/");
    expect(screen.getByTestId("worker-xp-readout")).toHaveTextContent("10.83K");
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/components/painting/OfficeRoom.test.tsx`
Expected: FAIL — no `worker-avatar-img` / `worker-xp-readout` test ids; name shows hardcoded "Painter".

- [ ] **Step 3: Update `WorkerStatCard`**

In `src/components/painting/OfficeRoom.tsx`, add imports (with existing ones):

```ts
import { workerXpToNext } from "@/core/balance";
import { formatBig } from "@/core/formatter";
import { WORKER_AVATARS } from "./workerAvatarMap";
```

Replace the `WorkerStatCard` function body (lines ~7–25) with:

```tsx
function WorkerStatCard({ worker }: { worker: Worker }): JSX.Element {
  const xpToNext = workerXpToNext(worker.level);
  const xpFrac = Math.max(0, Math.min(1, worker.xp.div(xpToNext).toNumber()));
  return (
    <li className={styles.card} data-testid="worker-stat-card">
      <header className={styles.cardHeader}>
        <img
          className={styles.cardAvatar}
          src={WORKER_AVATARS[worker.avatar - 1]}
          alt=""
          aria-hidden="true"
          data-testid="worker-avatar-img"
        />
        <span className={styles.cardName}>{worker.name}</span>
        <span className={styles.cardLevel}>Level {worker.level}</span>
      </header>
      <div className={styles.workerXpStrip}>
        <div className={styles.workerXpBar}>
          <div className={styles.workerXpFill} style={{ width: `${xpFrac * 100}%` }} />
        </div>
        <span data-testid="worker-xp-readout">
          {formatBig(worker.xp)} / {formatBig(xpToNext)} xp
        </span>
      </div>
      <div className={styles.cardClass}>{worker.classId}</div>
      <ul className={styles.statList}>
        {WORKER_STAT_KEYS.map((k) => (
          <li key={k} className={styles.statRow}>
            <span className={styles.statLabel}>{WORKER_STAT_LABELS[k]}</span>
            <span className={styles.statValue}>{formatWorkerStatAbsolute(k, worker.stats[k])}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}
```

- [ ] **Step 4: Add the `.cardAvatar` style**

In `src/components/painting/OfficeRoom.module.css`, add under the "Worker stat-sheet card elements" section (after `.cardName`):

```css
.cardAvatar {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  object-fit: contain;
  object-position: bottom center;
  image-rendering: pixelated;
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run tests/components/painting/OfficeRoom.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/painting/OfficeRoom.tsx src/components/painting/OfficeRoom.module.css tests/components/painting/OfficeRoom.test.tsx
git commit -m "ui(office): show worker name, avatar + XP progress on roster cards"
```

---

## Task 7: WorkerAvatars — per-worker avatar on the canvas overlay

**Files:**
- Modify: `src/components/painting/WorkerAvatars.tsx` (the `.portrait` div, ~line 32)
- Modify: `src/components/painting/WorkerAvatars.module.css` (drop the hardcoded `background-image`)
- Test: `tests/components/painting/WorkerAvatars.test.tsx`

- [ ] **Step 1: Write the failing test**

In `tests/components/painting/WorkerAvatars.test.tsx`, add an `it` that two workers render distinct avatar backgrounds (set up roster with explicit `avatar` values; `createWorker` already provides the field):

```ts
  it("paints each worker's own avatar as the portrait background", () => {
    const a = { ...createWorker(), avatar: 2 };
    const b = { ...createWorker(), avatar: 4 };
    useGameStore.setState({ roster: [a, b], painterClocks: {} });
    render(<WorkerAvatars />);
    const portraits = screen.getAllByTestId("worker-portrait");
    expect(portraits).toHaveLength(2);
    expect(portraits[0]!.style.backgroundImage).toMatch(/worker_2/);
    expect(portraits[1]!.style.backgroundImage).toMatch(/worker_4/);
  });
```

(If `createWorker`/`WorkerAvatars`/`useGameStore` aren't already imported in this file, add them:
`import { createWorker } from "@/store/officeSlice";`,
`import { WorkerAvatars } from "@/components/painting/WorkerAvatars";`,
`import { useGameStore } from "@/store";`.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/components/painting/WorkerAvatars.test.tsx`
Expected: FAIL — no `worker-portrait` test id; background is the CSS-baked single image.

- [ ] **Step 3: Render the per-worker avatar inline**

In `src/components/painting/WorkerAvatars.tsx`, add the import:

```ts
import { WORKER_AVATARS } from "./workerAvatarMap";
```

Replace the portrait div (currently `<div className={styles.portrait} />`) with:

```tsx
            <div
              className={styles.portrait}
              data-testid="worker-portrait"
              style={{ backgroundImage: `url(${WORKER_AVATARS[w.avatar - 1]})` }}
            />
```

- [ ] **Step 4: Remove the hardcoded image from CSS**

In `src/components/painting/WorkerAvatars.module.css`, delete this line from the `.portrait` rule (the background is now set inline per worker):

```css
  background-image: url("../../assets/images/Workers/worker_1.png");
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run tests/components/painting/WorkerAvatars.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/painting/WorkerAvatars.tsx src/components/painting/WorkerAvatars.module.css tests/components/painting/WorkerAvatars.test.tsx
git commit -m "ui(office): canvas overlay shows each worker's own avatar"
```

---

## Task 8: Full verification + manual eyeball

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — all files green (the suite was 1099 before this work; this adds ~7 new tests and re-baselines 4). If anything else broke, fix the assertion to the new curve and re-run.

- [ ] **Step 2: Eyeball in the dev server**

With the dev server on `localhost:5173`:
- Go to `/painting` → Painter's Office room. Confirm each roster card shows a **name**, an **avatar image**, and an **XP bar + "x / y xp"** readout under the level.
- Confirm canvas worker avatars on the right edge now differ per worker (not all `worker_1`).
- Ascend once and confirm workers gain only a level or two (not ~15).

- [ ] **Step 3: Final confirmation**

No commit (Task steps committed their own work). Report results; deploy is a separate user-approved step.

---

## Self-Review

- **Spec coverage:** XP curve (Task 1) ✓; name pool (Task 2) ✓; name+avatar fields & spawn (Task 3) ✓; avatar assets (Task 4) ✓; migration v28→v29 (Task 5) ✓; OfficeRoom display (Task 6) ✓; canvas overlay avatars (Task 7) ✓; full verification (Task 8) ✓.
- **Placeholders:** none — every code/command step is concrete.
- **Type consistency:** `Worker.name: string` / `Worker.avatar: number` defined in Task 3 and consumed identically in Tasks 5/6/7; `WORKER_AVATARS` (Task 4) indexed as `[avatar - 1]` everywhere; `workerXpToNext(level)` signature unchanged (Task 1) and reused in Task 6.
- **RNG discipline:** name/avatar use `Math.random()` (cosmetic), never the seeded `rng` — preserves canvas/catch-up determinism, consistent with Task 3 and Task 5.
