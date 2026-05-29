# Inspiration-Tree 10-Tier Generator Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 6-stage / 15-part inspiration tree with **10 tiers, one upgrade each**, where deep-leveling an old upgrade stays relevant via powerful back-loaded level milestones, and tiers unlock by crossing a flat **inspiration/sec** threshold (so leveling *any* upgrade advances you).

**Architecture:** The tree config becomes 10 single-part "tiers". Each upgrade's output is `level × baseRate(tier) × milestoneMult(level)`, where `milestoneMult` jumps at L10/25/50/100/200/400/800/1000 with escalating, back-loaded factors. Tier unlock changes from "total levels in the prior stage ≥ N" to "total tree inspiration/sec ≥ tier.unlockInspiPerSec". The tree still resets on ascend, so migration just wipes `currentStage`/`partLevels` and reseeds (mirrors the v13→v14 tree rewrite).

**Tech Stack:** TypeScript (strict), Vitest, Zustand slices, `break_eternity.js` (`Big`).

**Spec:** `docs/superpowers/specs/2026-05-29-crit-and-tree-rebalance-design.md` (Part 2).

> **All numeric constants below are starting points, marked tunable — they will be feel-tested in play. The *shapes* (one-upgrade-per-tier, back-loaded milestones, inspi/sec unlock) are locked.**

---

## File structure

- `src/core/balance.ts` — milestone schedule (`PART_MILESTONES`, `PART_MILESTONE_FACTORS`, `getPartMilestoneMultiplier`); `inspiPerSec` unchanged in shape (consumes the new multiplier).
- `src/config/treeStages.ts` — 10 single-part tiers; `TreeStageConfig` gains `unlockInspiPerSec`, drops `unlockThreshold`.
- `src/store/treeSlice.ts` — new `getTreeInspiPerSec` selector; `canGrowSapling` gates on inspi/sec.
- `src/store/index.ts` — `SAVE_VERSION` 25 → 26; migration wipes + reseeds the tree.
- `src/components/tree/StagePanel.tsx` + `src/routes/TreeRoute.tsx` — unlock readout shows inspi/sec progress, not level count.
- `src/components/tree/UpgradeRow.tsx` — show the next milestone + its multiplier.
- Tests mirror each under `tests/`.

---

### Task 1: Milestone multiplier — escalating, back-loaded schedule

**Files:**
- Modify: `src/core/balance.ts` (`PART_MILESTONES`, `getPartMilestoneMultiplier`; add `PART_MILESTONE_FACTORS`)
- Test: `tests/core/balance.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/core/balance.test.ts` (replace any existing `getPartMilestoneMultiplier` tests that assume the old `2^count` rule):

```ts
import { describe, it, expect } from "vitest";
import { PART_MILESTONES, PART_MILESTONE_FACTORS, getPartMilestoneMultiplier } from "@/core/balance";

describe("getPartMilestoneMultiplier — escalating back-loaded schedule", () => {
  it("milestone levels and factors are aligned and back-loaded", () => {
    expect(PART_MILESTONES).toEqual([10, 25, 50, 100, 200, 400, 800, 1000]);
    expect(PART_MILESTONE_FACTORS).toEqual([2, 2, 3, 3, 4, 5, 6, 8]);
    expect(PART_MILESTONES.length).toBe(PART_MILESTONE_FACTORS.length);
  });

  it("is 1 below the first milestone", () => {
    expect(getPartMilestoneMultiplier(0)).toBe(1);
    expect(getPartMilestoneMultiplier(9)).toBe(1);
  });

  it("compounds the factors of every milestone reached", () => {
    expect(getPartMilestoneMultiplier(10)).toBe(2);          // 2
    expect(getPartMilestoneMultiplier(25)).toBe(4);          // 2*2
    expect(getPartMilestoneMultiplier(50)).toBe(12);         // 2*2*3
    expect(getPartMilestoneMultiplier(100)).toBe(36);        // *3
    expect(getPartMilestoneMultiplier(1000)).toBe(34560);    // 2*2*3*3*4*5*6*8
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run tests/core/balance.test.ts`
Expected: FAIL (`PART_MILESTONE_FACTORS` undefined; old `2^count` returns 2 at L1000, not 34560).

- [ ] **Step 3: Implement the new schedule**

In `src/core/balance.ts`, replace `PART_MILESTONES` and `getPartMilestoneMultiplier` (keep `getNextPartMilestone` / `isApproachingMilestone` — they reference `PART_MILESTONES` and still work):

```ts
/**
 * Level thresholds at which a tree upgrade's output gets a milestone multiplier.
 * Back-loaded: the big jumps live at 400/800/1000 so deep-leveling an OLD upgrade
 * is a deliberate late-game investment that lets it catch up to the frontier tier.
 * TUNABLE (shape locked: 8 back-loaded milestones).
 */
export const PART_MILESTONES: ReadonlyArray<number> = [10, 25, 50, 100, 200, 400, 800, 1000];

/** Per-milestone multiplier, index-aligned with PART_MILESTONES. Cumulative product
 *  at L1000 ≈ ×34,560 — enough to offset a ×5-per-tier base-rate gap. TUNABLE. */
export const PART_MILESTONE_FACTORS: ReadonlyArray<number> = [2, 2, 3, 3, 4, 5, 6, 8];

/** Product of the factors of every milestone the level has reached. */
export const getPartMilestoneMultiplier = (level: number): number => {
  let mult = 1;
  for (let i = 0; i < PART_MILESTONES.length; i++) {
    if (level >= PART_MILESTONES[i]!) mult *= PART_MILESTONE_FACTORS[i]!;
  }
  return mult;
};
```

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run tests/core/balance.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/balance.ts tests/core/balance.test.ts
git commit -m "core(tree): escalating back-loaded milestone multipliers"
```

---

### Task 2: 10-tier config (one upgrade per tier, inspi/sec unlock)

**Files:**
- Modify: `src/config/treeStages.ts`
- Test: `tests/config/treeStages.test.ts` (create if absent; otherwise replace stale assertions)

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { TREE_STAGES } from "@/config/treeStages";

describe("TREE_STAGES — 10 single-upgrade tiers", () => {
  it("has exactly 10 tiers, each with exactly one part", () => {
    expect(TREE_STAGES.length).toBe(10);
    for (const tier of TREE_STAGES) expect(tier.parts.length).toBe(1);
  });

  it("tier 1 is always available; later tiers gate on rising inspi/sec", () => {
    expect(TREE_STAGES[0]!.unlockInspiPerSec).toBe(0);
    for (let i = 1; i < TREE_STAGES.length; i++) {
      expect(TREE_STAGES[i]!.unlockInspiPerSec).toBeGreaterThan(TREE_STAGES[i - 1]!.unlockInspiPerSec);
    }
  });

  it("base rate and base cost ramp ×5 per tier", () => {
    for (let i = 1; i < TREE_STAGES.length; i++) {
      const prev = TREE_STAGES[i - 1]!.parts[0]!;
      const cur = TREE_STAGES[i]!.parts[0]!;
      expect(cur.rate / prev.rate).toBeCloseTo(5, 5);
      expect(cur.baseCost / prev.baseCost).toBeCloseTo(5, 5);
    }
  });

  it("every part id is unique", () => {
    const ids = TREE_STAGES.flatMap((s) => s.parts.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run tests/config/treeStages.test.ts`
Expected: FAIL (currently 6 stages; `unlockInspiPerSec` undefined).

- [ ] **Step 3: Rewrite the config**

Replace the whole body of `src/config/treeStages.ts`. Change the `TreeStageConfig` interface: drop `unlockThreshold`, add `unlockInspiPerSec`.

```ts
export interface TreePartConfig {
  readonly id: string;
  readonly name: string;
  /** Gold cost at level 0 → 1. Subsequent levels scale by treePartCost(level, baseCost). */
  readonly baseCost: number;
  /** Inspi/sec contribution per level (final = level × rate × milestoneMult(level) × global mult). */
  readonly rate: number;
}

export interface TreeStageConfig {
  readonly id: string;
  readonly name: string;
  /** Total tree inspiration/sec required to grow into this tier. Tier 0 = 0 (always open). */
  readonly unlockInspiPerSec: number;
  readonly parts: ReadonlyArray<TreePartConfig>;
}

/**
 * 10 single-upgrade tiers. Base rate and base cost ramp ×5 per tier; tiers unlock at
 * rising flat inspiration/sec thresholds (×10 ladder). ALL NUMBERS TUNABLE (feel-tested
 * in play); the one-upgrade-per-tier shape + inspi/sec gating are locked.
 * Tier names 7-10 are provisional — reconcile with the long-term roadmap when known.
 */
export const TREE_STAGES: ReadonlyArray<TreeStageConfig> = [
  { id: "tier1",  name: "Tiny Sprout",    unlockInspiPerSec: 0,           parts: [{ id: "u1",  name: "Cotyledon",   baseCost: 10,         rate: 0.1 }] },
  { id: "tier2",  name: "Bud",            unlockInspiPerSec: 5,           parts: [{ id: "u2",  name: "Tendril",     baseCost: 50,         rate: 0.5 }] },
  { id: "tier3",  name: "Leaflet",        unlockInspiPerSec: 50,          parts: [{ id: "u3",  name: "Vein",        baseCost: 250,        rate: 2.5 }] },
  { id: "tier4",  name: "Sapling",        unlockInspiPerSec: 500,         parts: [{ id: "u4",  name: "Twig",        baseCost: 1_250,      rate: 12.5 }] },
  { id: "tier5",  name: "Whisperleaf",    unlockInspiPerSec: 5_000,       parts: [{ id: "u5",  name: "Soft Bough",  baseCost: 6_250,      rate: 62.5 }] },
  { id: "tier6",  name: "Verdant Shoot",  unlockInspiPerSec: 50_000,      parts: [{ id: "u6",  name: "Greenshoot",  baseCost: 31_250,     rate: 312.5 }] },
  { id: "tier7",  name: "Young Tree",     unlockInspiPerSec: 500_000,     parts: [{ id: "u7",  name: "Limb",        baseCost: 156_250,    rate: 1_562.5 }] },
  { id: "tier8",  name: "Broadleaf",      unlockInspiPerSec: 5_000_000,   parts: [{ id: "u8",  name: "Bough",       baseCost: 781_250,    rate: 7_812.5 }] },
  { id: "tier9",  name: "Elderbough",     unlockInspiPerSec: 50_000_000,  parts: [{ id: "u9",  name: "Heartwood",   baseCost: 3_906_250,  rate: 39_062.5 }] },
  { id: "tier10", name: "Great Oak",      unlockInspiPerSec: 500_000_000, parts: [{ id: "u10", name: "Crown",       baseCost: 19_531_250, rate: 195_312.5 }] },
];
```

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run tests/config/treeStages.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/treeStages.ts tests/config/treeStages.test.ts
git commit -m "config(tree): 10 single-upgrade tiers with inspi/sec unlock thresholds"
```

---

### Task 3: Tier unlock gates on inspiration/sec

**Files:**
- Modify: `src/store/treeSlice.ts` (`canGrowSapling`; add `getTreeInspiPerSec`)
- Test: `tests/store/treeSlice.test.ts`

> Context: `canGrowSapling` currently compares `getTotalLevelsInStage(currentStage)` to `TREE_STAGES[next].unlockThreshold`. That field is gone. The new gate compares total tree inspiration/sec to `TREE_STAGES[next].unlockInspiPerSec`. `getProducingParts` and `getTotalLevelsInStage` keep working (one part per tier). `treeTickPure` and `buyPartLevel` already auto-grow via `canGrowSapling` — no change needed there. Growing a tier exposes a level-0 part that produces nothing, so the auto-grow loop self-terminates.

- [ ] **Step 1: Write the failing tests**

Replace the existing stage-growth tests in `tests/store/treeSlice.test.ts` (they assert level-count growth) with inspi/sec-based ones:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { getTreeInspiPerSec, canGrowSapling } from "@/store/treeSlice";
import { big } from "@/core/bigNumber";

describe("treeSlice — inspi/sec tier unlock", () => {
  beforeEach(() => {
    useGameStore.getState().resetTree();
    // ensure enough gold for buys
    useGameStore.setState({ gold: big(1e9) });
  });

  it("getTreeInspiPerSec reflects producing parts × global multiplier", () => {
    // level tier-1 part (u1, rate 0.1) to level 10 -> 10*0.1*milestone(10)=10*0.1*2=2/s (×1 default mult)
    for (let i = 0; i < 10; i++) useGameStore.getState().buyPartLevel("u1");
    expect(getTreeInspiPerSec(useGameStore.getState()).toNumber()).toBeCloseTo(2, 5);
  });

  it("cannot grow past tier 1 until inspi/sec >= tier 2 threshold (5/s)", () => {
    useGameStore.getState().buyPartLevel("u1"); // 1*0.1 = 0.1/s < 5
    expect(canGrowSapling(useGameStore.getState())).toBe(false);
  });

  it("grows into tier 2 once inspi/sec crosses 5/s", () => {
    // Drive u1 high enough: at L25, 25*0.1*milestone(25)=25*0.1*4=10/s >= 5
    for (let i = 0; i < 25; i++) useGameStore.getState().buyPartLevel("u1");
    expect(getTreeInspiPerSec(useGameStore.getState()).toNumber()).toBeGreaterThanOrEqual(5);
    expect(useGameStore.getState().currentStage).toBeGreaterThanOrEqual(1); // auto-grew
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run tests/store/treeSlice.test.ts`
Expected: FAIL (`getTreeInspiPerSec` not exported; `unlockThreshold` referenced in `canGrowSapling` is now `undefined`).

- [ ] **Step 3: Implement the selector + new gate**

In `src/store/treeSlice.ts`, add the import and selector, and rewrite `canGrowSapling`:

```ts
import { treePartCost, inspiPerSec } from "@/core/balance";
import { getInspiMultiplier } from "@/core/multipliers";
import { big, type Big } from "@/core/bigNumber";

// ... existing code ...

/** Total tree inspiration/sec right now: producing parts × the global inspi multiplier. */
export const getTreeInspiPerSec = (state: GameStore): Big =>
  inspiPerSec(getProducingParts(state), getInspiMultiplier(state));

/**
 * True iff the player can grow into the next tier:
 *  - `currentStage + 1` exists, AND
 *  - total tree inspiration/sec ≥ the next tier's `unlockInspiPerSec`.
 */
export const canGrowSapling = (state: GameStore): boolean => {
  const next = state.currentStage + 1;
  if (next >= TREE_STAGES.length) return false;
  const threshold = TREE_STAGES[next]!.unlockInspiPerSec;
  return getTreeInspiPerSec(state).gte(big(threshold));
};
```

(`treePartCost`/`inspiPerSec` may already be imported — merge, don't duplicate. `getInspiMultiplier` import is new.)

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run tests/store/treeSlice.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite to catch fallout (other tree/tick tests)**

Run: `npx vitest run`
Expected: PASS. If `treeTickPure`, `tickAll`, ascend, or persistence tests assert old stage-growth behavior, update those assertions to the inspi/sec model (the engine is correct; the tests encode the old rule). Fix and re-run.

- [ ] **Step 6: Commit**

```bash
git add src/store/treeSlice.ts tests/
git commit -m "store(tree): gate tier unlock on inspiration/sec instead of level count"
```

---

### Task 4: Save migration v25 → v26 (wipe + reseed tree)

**Files:**
- Modify: `src/store/index.ts` (`SAVE_VERSION`, add a `fromVersion < 26` migration block)
- Test: `tests/store/persistence-integration.test.ts`

> Context: the v13→v14 block (`src/store/index.ts`, ~line 264-286) is the exact precedent — it wipes `currentStage` + `partLevels` for a tree rewrite. Old part IDs (`cotyledon`…`stalk`) have no equivalent in the new tier IDs (`u1`…`u10`), and the tree resets every ascend anyway, so wiping is correct and self-healing.

- [ ] **Step 1: Write the failing test**

Add to `tests/store/persistence-integration.test.ts`:

```ts
import { migrate } from "@/store";

it("v25 → v26 wipes the tree to the new 10-tier structure", () => {
  const old = {
    currentStage: 5,
    partLevels: { cotyledon: 40, tendril: 12, stalk: 3 }, // old IDs
    // minimal other fields the migration chain touches can be omitted; migrate merges
  };
  const migrated = migrate(old, 25);
  expect(migrated.currentStage).toBe(0);
  // new structure: keys u1..u10, all 0; no old IDs survive
  expect(Object.keys(migrated.partLevels).sort()).toEqual(
    ["u1","u10","u2","u3","u4","u5","u6","u7","u8","u9"].sort(),
  );
  expect(Object.values(migrated.partLevels).every((v) => v === 0)).toBe(true);
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx vitest run tests/store/persistence-integration.test.ts`
Expected: FAIL (migration to 26 doesn't exist; old IDs persist).

- [ ] **Step 3: Bump version + add the migration block**

In `src/store/index.ts`: change `const SAVE_VERSION = 25;` → `26`. Add, after the last existing `if (fromVersion < N)` block:

```ts
if (fromVersion < 26) {
  // v25 → v26 (2026-05-29): inspiration tree reworked to 10 single-upgrade tiers
  // (IDs u1..u10) with inspi/sec unlock + back-loaded milestones. Old part IDs have
  // no equivalent; the tree resets every ascend, so wipe + reseed is correct.
  const wiped: Record<string, number> = {};
  for (const stage of TREE_STAGES) for (const part of stage.parts) wiped[part.id] = 0;
  state = { ...state, currentStage: 0, partLevels: wiped };
}
```

Confirm `TREE_STAGES` is imported in `index.ts` (the v14 block referenced it; if it now imports a stale list, ensure it points at `@/config/treeStages`).

- [ ] **Step 4: Run, verify PASS**

Run: `npx vitest run tests/store/persistence-integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/index.ts tests/store/persistence-integration.test.ts
git commit -m "store(save): migrate v25 -> v26, reseed 10-tier tree"
```

---

### Task 5: UI — inspi/sec unlock readout + milestone display

**Files:**
- Modify: `src/components/tree/StagePanel.tsx` (unlock progress: inspi/sec, not level count)
- Modify: `src/routes/TreeRoute.tsx` (pass inspi/sec + threshold to StagePanel instead of level count)
- Modify: `src/components/tree/UpgradeRow.tsx` (show next milestone + its multiplier)
- Test: update `tests/components/tree/*` assertions that reference level-count unlock text

> Context: `StagePanel` currently shows `Levels in stage: {totalLevels} / {threshold}`. The unlock is now inspi/sec-based. `TreeRoute` composes the props. `UpgradeRow` renders each tier's upgrade; add a small "next milestone" hint using `getNextPartMilestone(level)` + `getPartMilestoneMultiplier`.

- [ ] **Step 1: Update `StagePanel` to read inspi/sec progress**

Change `StagePanel`'s props + body to show progress toward the next tier's `unlockInspiPerSec`. Replace the `stagePanelHoverBody` numbers and the prop names:

```tsx
interface Props {
  currentStageIndex: number;
  currentStageName: string;
  nextStageName: string | undefined;
  inspiPerSec: number;           // total tree inspi/sec now
  unlockInspiPerSec: number;     // next tier's threshold
}

function stagePanelHoverBody(isFinal: boolean, inspiPerSec: number, threshold: number): JSX.Element {
  if (isFinal) {
    return (
      <>
        <div>You've reached the final tier of the tree.</div>
        <div>Keep earning inspiration to ascend for fame.</div>
      </>
    );
  }
  const pct = threshold > 0 ? Math.min(100, (inspiPerSec / threshold) * 100) : 0;
  const met = inspiPerSec >= threshold;
  return (
    <>
      <div>Inspiration/sec: {inspiPerSec.toFixed(1)} / {threshold}</div>
      <div>Progress: {pct.toFixed(0)}%</div>
      <div>───</div>
      <div>{met ? "Threshold reached — advancing!" : "Grow any upgrade to reach it."}</div>
    </>
  );
}
```

- [ ] **Step 2: Update `TreeRoute` to pass the new props**

In `src/routes/TreeRoute.tsx`, compute `getTreeInspiPerSec(state).toNumber()` and the next tier's `unlockInspiPerSec` (from `TREE_STAGES[currentStage + 1]`), and pass them to `<StagePanel>` instead of `totalLevelsInStage`/`unlockThreshold`. Import `getTreeInspiPerSec` from `@/store/treeSlice`.

- [ ] **Step 3: Add a milestone hint to `UpgradeRow`**

In `src/components/tree/UpgradeRow.tsx`, using the upgrade's current `level`, show the next milestone and its multiplier (so the catch-up incentive is visible):

```tsx
import { getNextPartMilestone, PART_MILESTONES, PART_MILESTONE_FACTORS, getPartMilestoneMultiplier } from "@/core/balance";

// inside the row render, near the rate/level display:
const next = getNextPartMilestone(level);
const nextFactor = next === null ? null : PART_MILESTONE_FACTORS[PART_MILESTONES.indexOf(next)];
// render when next !== null:
//   <span className={styles.milestone}>next ×{nextFactor} at Lv {next}</span>
```

(Use the existing row styling conventions; add a `.milestone` class to the module CSS if needed, matching nearby muted-text styles.)

- [ ] **Step 4: Update component tests + verify build**

- Update any `tests/components/tree/*` assertions that check the old `"Levels in stage: X / Y"` text to the new `"Inspiration/sec: …"` text.
- Run: `npx vitest run` → all pass.
- Run: `npx tsc -b --noEmit` → no NEW errors beyond the known baseline.
- Run: `npx vite build` → clean.

- [ ] **Step 5: Manual check**

Open the Tree route: each tier shows one upgrade with a "next ×N at Lv M" milestone hint; the stage panel shows inspi/sec progress toward the next tier; leveling any unlocked upgrade advances the unlock bar.

- [ ] **Step 6: Commit**

```bash
git add src/components/tree/ src/routes/TreeRoute.tsx tests/components/tree/
git commit -m "ui(tree): inspi/sec unlock readout + milestone hints"
```

---

## Self-Review

**Spec coverage (Part 2):**
- One upgrade per tier, 10 tiers → Task 2. ✅
- Newer tiers start stronger (×5 base ramp) → Task 2. ✅
- Powerful back-loaded milestones at the 8 levels → Task 1. ✅
- Tier unlock by total inspi/sec; any upgrade advances it → Task 3. ✅
- Cost stays geometric with per-tier base ramp → Task 2 (`baseCost`) + existing `treePartCost`. ✅
- Migration wipes/reseeds (tree resets each ascend) → Task 4. ✅
- UI reflects inspi/sec unlock + milestones → Task 5. ✅

**Placeholder scan:** numeric constants are concrete; UI CSS class addition is described. No TBDs.

**Type consistency:** `getTreeInspiPerSec(state: GameStore): Big` used in Task 3 + Task 5; `unlockInspiPerSec` added in Task 2 and consumed in Tasks 3/5; `PART_MILESTONE_FACTORS` defined in Task 1 and consumed in Task 5; part IDs `u1..u10` consistent across Tasks 2 and 4.

**Note for executor:** Task 3 Step 5 deliberately runs the full suite because the unlock-rule change will ripple into `treeTickPure`/`tickAll`/ascend/bot-sim tests that encode the old level-count growth. Expect to update those assertions; the engine is the source of truth.
