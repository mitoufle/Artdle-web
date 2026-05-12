# Inspiration Tree Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-stage × 2-parts inspiration tree with a 6-stage variable-parts shape (1/2/2/3/3/4), remove the manual Grow button in favor of automatic stage-up via `growSapling()` triggered inside `buyPartLevel` and `treeTick`, and ship a save migration that wipes the tree slice while preserving everything else.

**Architecture:** Config-driven extension — `TREE_STAGES` is replaced; the slice gains two auto-grow trigger points; one save migration (v13 → v14) seeds new state. `StagePanel` reads stage names from config dynamically. `TreeScene` maps 6 stages onto the existing 3 sprite variants until art is authored for stages 7+. A 2-second stage-up toast lives in `TreeRoute`.

**Tech Stack:** TypeScript strict, Vitest, React 19, Zustand 5, `break_eternity.js` via `@/core/bigNumber`, Tailwind 4 / CSS modules.

**Spec:** `docs/superpowers/specs/2026-05-12-inspiration-tree-expansion-design.md`

---

## File Structure

```
src/config/treeStages.ts                       rewrite TREE_STAGES (6 stages, 15 parts)
src/store/treeSlice.ts                         add auto-grow inside buyPartLevel + treeTick
src/store/index.ts                             SAVE_VERSION 13 → 14 + migrate step
src/components/tree/StagePanel.tsx             read names from config; drop Grow button + props
src/components/tree/StagePanel.module.css      tighten chip spacing for 6
src/components/tree/TreeScene.tsx              tier-mapping function (6 stages → 3 sprites)
src/routes/TreeRoute.tsx                       drop growSapling wiring; add stage-up toast
src/routes/TreeRoute.module.css                stage-up toast keyframes
src/core/multipliers.ts                        update outdated JSDoc comment

tests/store/treeSlice.test.ts                  ID renames + new auto-grow cases
tests/store/persistence-integration.test.ts   migration v13→v14 case
tests/systems/ascend.test.ts                  ID renames
tests/store/tickAll.test.ts                   ID renames
tests/components/shell/CurrencyChip.hover.test.tsx   ID renames
tests/components/tree/UpgradeRow.hover.test.tsx     ID renames
tests/components/tree/UpgradeRow.test.tsx            ID renames
tests/routes/TreeRoute.test.tsx                ID renames + 6-chip assertion
tests/components/tree/StagePanel.test.tsx     chip-count + drop Grow-button cases
tests/components/tree/StagePanel.hover.test.tsx update footer text + names
```

Old → new part ID mapping (used everywhere in test rewrites):

| Old ID    | New ID         | Stage           |
|-----------|----------------|-----------------|
| spark     | cotyledon      | 0 Tiny Sprout   |
| bud       | tendril        | 1 Bud           |
| leaf      | budtip         | 1 Bud           |
| branch    | vein           | 2 Leaflet       |
| bough     | leaflet        | 2 Leaflet       |
| crown     | twig           | 3 Sapling       |

(After stage 3 the old config had no parts; new parts have no corresponding old IDs.)

---

## Task 1: Replace TREE_STAGES config + cascade-update existing tests

**Files:**
- Modify: `src/config/treeStages.ts` (replace `TREE_STAGES`)
- Modify: `tests/store/treeSlice.test.ts` (rename all old part IDs; preserve test intent)
- Modify: `tests/systems/ascend.test.ts` (rename old part IDs)
- Modify: `tests/store/tickAll.test.ts` (rename old part IDs)
- Modify: `tests/components/shell/CurrencyChip.hover.test.tsx` (rename old part IDs)
- Modify: `tests/components/tree/UpgradeRow.hover.test.tsx` (rename old part IDs)
- Modify: `tests/components/tree/UpgradeRow.test.tsx` (rename old part IDs)
- Modify: `tests/routes/TreeRoute.test.tsx` (rename old part IDs + 3-chip → 6-chip)
- Modify: `src/core/multipliers.ts` (one outdated JSDoc line)

This is a big-bang refactor to keep the test suite green before adding new behavior. No mechanical change yet.

- [ ] **Step 1: Rewrite `TREE_STAGES`**

Replace the entire `TREE_STAGES` constant in `src/config/treeStages.ts` (keep the existing interfaces and the header comment unchanged):

```ts
/**
 * v1.x tree config: 6 stages with variable parts per stage (1/2/2/3/3/4).
 * Ratios match the v1.0 curve (×10 cost+rate between stages, ×5 within stage).
 * Names lock the first six entries of the long-term 25-stage roadmap; see
 * docs/superpowers/specs/2026-05-12-inspiration-tree-expansion-design.md.
 */
export const TREE_STAGES: ReadonlyArray<TreeStageConfig> = [
  {
    id: "tiny-sprout",
    name: "Tiny Sprout",
    unlockThreshold: 0,
    parts: [
      { id: "cotyledon", name: "Cotyledon", baseCost: 10, rate: 0.1 },
    ],
  },
  {
    id: "bud",
    name: "Bud",
    unlockThreshold: 5,
    parts: [
      { id: "tendril", name: "Tendril", baseCost: 100, rate: 1 },
      { id: "budtip", name: "Bud Tip", baseCost: 500, rate: 5 },
    ],
  },
  {
    id: "leaflet",
    name: "Leaflet",
    unlockThreshold: 12,
    parts: [
      { id: "vein", name: "Vein", baseCost: 1_000, rate: 10 },
      { id: "leaflet", name: "Leaflet", baseCost: 5_000, rate: 50 },
    ],
  },
  {
    id: "sapling",
    name: "Sapling",
    unlockThreshold: 25,
    parts: [
      { id: "twig", name: "Twig", baseCost: 10_000, rate: 100 },
      { id: "branch", name: "Branch", baseCost: 50_000, rate: 500 },
      { id: "leaf", name: "Leaf", baseCost: 250_000, rate: 2_500 },
    ],
  },
  {
    id: "whisperleaf",
    name: "Whisperleaf",
    unlockThreshold: 50,
    parts: [
      { id: "softbough", name: "Soft Bough", baseCost: 100_000, rate: 5_000 },
      { id: "quietleaf", name: "Quiet Leaf", baseCost: 500_000, rate: 25_000 },
      { id: "faintvein", name: "Faint Vein", baseCost: 2_500_000, rate: 125_000 },
    ],
  },
  {
    id: "verdant-shoot",
    name: "Verdant Shoot",
    unlockThreshold: 100,
    parts: [
      { id: "greenshoot", name: "Greenshoot", baseCost: 1_000_000, rate: 250_000 },
      { id: "lushbough",  name: "Lush Bough",  baseCost: 5_000_000, rate: 1_250_000 },
      { id: "vividleaf",  name: "Vivid Leaf",  baseCost: 25_000_000, rate: 6_250_000 },
      { id: "stalk",      name: "Stalk",       baseCost: 125_000_000, rate: 31_250_000 },
    ],
  },
];
```

Note on `unlockThreshold` semantics (unchanged from current code): `TREE_STAGES[N].unlockThreshold` is the total levels required in stage `N - 1`'s parts to advance into stage `N`. Stage 0 keeps `unlockThreshold: 0`. Stage 5's `unlockThreshold` (100) is the requirement to leave stage 4 (Whisperleaf); the final stage has no advance, so its `unlockThreshold` value is unused at runtime — keep it set to a value that makes the table read sensibly (we use the v1.x stage-5 requirement here).

- [ ] **Step 2: Fix outdated JSDoc in `src/core/multipliers.ts`**

Find the line `* Multiplier on tree-part upgrade costs (spark/bud/leaf/branch). 1.0 = no` (line ~157) and change it to:

```ts
 * Multiplier on tree-part upgrade costs (cotyledon/tendril/budtip/...). 1.0 = no
```

- [ ] **Step 3: Run tree-related tests to see them break**

Run: `npx vitest run tests/store/treeSlice.test.ts tests/routes/TreeRoute.test.tsx tests/systems/ascend.test.ts tests/store/tickAll.test.ts tests/components/tree tests/components/shell/CurrencyChip.hover.test.tsx --reporter=basic`
Expected: failures referencing `partLevels.spark`, `partLevels.bud`, etc. — confirming the rename is needed.

- [ ] **Step 4: Update `tests/store/treeSlice.test.ts` — rename old IDs to new**

In every test in this file, apply the mapping table (spark → cotyledon, bud → tendril, leaf → budtip, branch → vein, bough → leaflet, crown → twig). Also adjust the threshold numbers and stage indices for the tests in the `growSapling + canGrowSapling` block:

- Stage 0 threshold was 10, is now 5. Update the buy-loop counts and assertion bounds.
- The test "after growSapling to stage 1, stage-0 parts remain buyable (D5)" was buying `bud` (now `tendril`) at stage 0 after the grow. The new stage 1 (Bud) has parts `tendril` and `budtip` — pick `tendril` for the stage-1 buy and pick `cotyledon` from stage 0 for the prior-stage buyability check.
- The "11th spark purchase" test stays mechanically the same — just renamed to "11th cotyledon purchase".

Concrete rewrite of the changed-shape blocks (apply identically — copy/paste, then re-grep for any stale "spark"/"bud"/"leaf"/etc. afterwards):

```ts
it("canGrowSapling returns false at total stage-0 levels = 4", () => {
  useGameStore.getState().add("gold", big(10000));
  for (let i = 0; i < 4; i++) {
    useGameStore.getState().buyPartLevel("cotyledon");
  }
  expect(getTotalLevelsInStage(useGameStore.getState(), 0)).toBe(4);
  expect(canGrowSapling(useGameStore.getState())).toBe(false);
});

it("canGrowSapling returns true at exact threshold (totalLevels === 5)", () => {
  useGameStore.getState().add("gold", big(10000));
  for (let i = 0; i < 5; i++) {
    useGameStore.getState().buyPartLevel("cotyledon");
  }
  expect(getTotalLevelsInStage(useGameStore.getState(), 0)).toBe(5);
  expect(canGrowSapling(useGameStore.getState())).toBe(true);
});

it("growSapling returns true when threshold is met; currentStage becomes 1", () => {
  useGameStore.getState().add("gold", big(10000));
  for (let i = 0; i < 5; i++) {
    useGameStore.getState().buyPartLevel("cotyledon");
  }
  expect(useGameStore.getState().growSapling()).toBe(true);
  expect(useGameStore.getState().currentStage).toBe(1);
});

it("after growSapling to stage 1, stage-0 parts remain buyable (D5)", () => {
  useGameStore.getState().add("gold", big(100000));
  for (let i = 0; i < 5; i++) {
    useGameStore.getState().buyPartLevel("cotyledon");
  }
  useGameStore.getState().growSapling();
  expect(useGameStore.getState().currentStage).toBe(1);
  // stage-0 part still buyable
  expect(useGameStore.getState().buyPartLevel("cotyledon")).toBe(true);
  expect(useGameStore.getState().partLevels.cotyledon).toBe(6);
  // stage-1 part now also buyable
  expect(useGameStore.getState().buyPartLevel("tendril")).toBe(true);
  expect(useGameStore.getState().partLevels.tendril).toBe(1);
});
```

For the `treeTick — credits cumulatively across stages` test, the multi-stage setup uses `cotyledon` (rate 0.1) for stage 0 and `tendril` (rate 1) for stage 1. Expected combined rate: 0.1 + 1 = 1.1 inspi/sec (was 0.1 + 5 = 5.1). Adjust the `toBeCloseTo` accordingly:

```ts
it("treeTick credits cumulatively across stages (D5: prior-stage parts still produce)", () => {
  useGameStore.getState().add("gold", big(100000));
  useGameStore.getState().buyPartLevel("cotyledon"); // 1 * 0.1 = 0.1
  useGameStore.setState({ currentStage: 1 });
  useGameStore.getState().buyPartLevel("tendril"); // 1 * 1 = 1
  const before = useGameStore.getState().inspiration.toNumber();
  useGameStore.getState().treeTick(1);
  const after = useGameStore.getState().inspiration.toNumber();
  expect(after - before).toBeCloseTo(1.1, 6);
});
```

The `treeTick(1) with spark at level 5: credits 0.5 inspi` test stays mechanically the same — just rename `spark` to `cotyledon`. Rate is still 0.1.

The `resetTree` test asserts `currentStage = 0` and zeroes all parts — the loop `for (const stage of TREE_STAGES) for (const part of stage.parts) expect(s.partLevels[part.id]).toBe(0)` already iterates from config, so it survives the renames; the only edits needed are the calls to `buyPartLevel("spark")` → `buyPartLevel("cotyledon")` and `buyPartLevel("bud")` → `buyPartLevel("tendril")`.

- [ ] **Step 5: Update `tests/systems/ascend.test.ts`, `tests/store/tickAll.test.ts`, `tests/components/shell/CurrencyChip.hover.test.tsx`, `tests/components/tree/UpgradeRow.hover.test.tsx`, `tests/components/tree/UpgradeRow.test.tsx`** — rename per the mapping table

For each file, find every reference to the old IDs and rename per the mapping (spark→cotyledon, bud→tendril, leaf→budtip, branch→vein, bough→leaflet, crown→twig). Where assertions depend on the rate value (e.g., asserting inspi gained or hover text showing "0.5 inspi/s"), adjust to match the new rate for the renamed part if it changed; the cotyledon (was spark) rate is still 0.1 so spark-rate-based tests are arithmetically unchanged.

For tests that buy more levels than the new stage 0 threshold (5) and would inadvertently advance the stage with the upcoming auto-grow change, prefer staying at level ≤ 4 OR explicitly call `useGameStore.setState({ currentStage: N })` to force a known stage. This Task 1 phase keeps the manual `growSapling()` action — auto-grow doesn't land until Task 2 — so existing tests that buy 10x spark and expect to remain in stage 0 will still pass here. They'll need adjustment when Task 2 lands.

- [ ] **Step 6: Update `tests/routes/TreeRoute.test.tsx`** — rename IDs + chip count

Find these existing assertions and update:

```ts
// OLD:
expect(screen.getByText(/Stage · Seed/i)).toBeInTheDocument();
// NEW:
expect(screen.getByText(/Stage · Tiny Sprout/i)).toBeInTheDocument();
```

```ts
// OLD:
expect(screen.getAllByTestId(/stage-chip-/)).toHaveLength(3);
// NEW:
expect(screen.getAllByTestId(/stage-chip-/)).toHaveLength(6);
```

```ts
// OLD:
expect(screen.getByTestId("upgrade-buy-spark")).toBeInTheDocument();
expect(screen.getByTestId("upgrade-buy-bud")).toBeInTheDocument();
// NEW:
expect(screen.getByTestId("upgrade-buy-cotyledon")).toBeInTheDocument();
// stage 0 has only one part now, so the second assertion is replaced:
expect(screen.queryByTestId("upgrade-buy-tendril")).not.toBeInTheDocument();
```

Update the two "buy button is …" tests' `upgrade-buy-spark` to `upgrade-buy-cotyledon` (no count change).

- [ ] **Step 7: Run all tests + tsc to confirm green**

Run: `npx vitest run --reporter=basic`
Expected: full suite passes — no behavior change, just data + ID renames.

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/config/treeStages.ts src/core/multipliers.ts \
        tests/store/treeSlice.test.ts \
        tests/systems/ascend.test.ts \
        tests/store/tickAll.test.ts \
        tests/components/shell/CurrencyChip.hover.test.tsx \
        tests/components/tree/UpgradeRow.hover.test.tsx \
        tests/components/tree/UpgradeRow.test.tsx \
        tests/routes/TreeRoute.test.tsx
git commit -m "config(tree): 6-stage config with variable parts (1/2/2/3/3/4)

Replaces 3-stage Seed/Sapling/Tree config with 6 stages
Tiny Sprout → Verdant Shoot. Variable parts per stage, ratios
matching the v1.0 ×10 between / ×5 within curve. Tests cascade-
renamed per the new part IDs; no behavior change yet (auto-grow
lands in a follow-up commit).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Auto-grow inside `buyPartLevel`

**Files:**
- Modify: `src/store/treeSlice.ts:64-79` (extend `buyPartLevel`)
- Modify: `tests/store/treeSlice.test.ts` (new test cases)

- [ ] **Step 1: Write failing test — buyPartLevel auto-grows on threshold-hit**

Append to the `treeSlice — growSapling + canGrowSapling` describe block in `tests/store/treeSlice.test.ts`:

```ts
it("buyPartLevel auto-advances stage when the buy brings total levels to threshold", () => {
  useGameStore.getState().add("gold", big(10000));
  // Buy cotyledon 4 times — under threshold (5).
  for (let i = 0; i < 4; i++) {
    useGameStore.getState().buyPartLevel("cotyledon");
  }
  expect(useGameStore.getState().currentStage).toBe(0);
  // The 5th buy crosses the threshold — stage should auto-advance.
  expect(useGameStore.getState().buyPartLevel("cotyledon")).toBe(true);
  expect(useGameStore.getState().currentStage).toBe(1);
});

it("buyPartLevel does NOT auto-advance when total levels < threshold", () => {
  useGameStore.getState().add("gold", big(10000));
  for (let i = 0; i < 4; i++) {
    useGameStore.getState().buyPartLevel("cotyledon");
  }
  expect(useGameStore.getState().currentStage).toBe(0);
});

it("buyPartLevel auto-advances are idempotent at the final stage (top stage cannot grow)", () => {
  useGameStore.setState({ currentStage: TREE_STAGES.length - 1 });
  useGameStore.getState().add("gold", big(1_000_000_000));
  // Buy a top-stage part — should succeed but not advance.
  const lastStageFirstPartId = TREE_STAGES[TREE_STAGES.length - 1]!.parts[0]!.id;
  expect(useGameStore.getState().buyPartLevel(lastStageFirstPartId)).toBe(true);
  expect(useGameStore.getState().currentStage).toBe(TREE_STAGES.length - 1);
});
```

- [ ] **Step 2: Run the new tests to confirm they fail**

Run: `npx vitest run tests/store/treeSlice.test.ts -t "auto-advances" --reporter=basic`
Expected: 2 failures (`currentStage` stays 0 after the 5th cotyledon; final-stage case passes by luck since no advance is needed there but the assertion mechanism stands).

- [ ] **Step 3: Implement auto-grow inside `buyPartLevel`**

In `src/store/treeSlice.ts`, modify `buyPartLevel` (lines ~64-79) to call `growSapling()` in a guarded loop after a successful purchase:

```ts
buyPartLevel: (partId) => {
  const found = findPart(partId);
  if (!found) return false;
  const { part, stageIdx } = found;
  const state = get();
  if (stageIdx > state.currentStage) return false;
  const currentLevel = state.partLevels[partId] ?? 0;
  const baseCost = treePartCost(currentLevel, part.baseCost);
  const discount = getTreeUpgradeCostMultiplier(state);
  const cost = baseCost.mul(big(discount));
  if (!state.spend("gold", cost)) return false;
  set((s) => ({
    partLevels: { ...s.partLevels, [partId]: (s.partLevels[partId] ?? 0) + 1 },
  }));
  // Auto-advance stage(s) if the new totals cross a threshold.
  // Loop is defensive — a single buy cannot cross more than one threshold
  // (a part lives in exactly one stage), but the guard keeps the implementation
  // idempotent.
  for (let i = 0; i < 100 && canGrowSapling(get()); i++) {
    get().growSapling();
  }
  return true;
},
```

- [ ] **Step 4: Run the new tests to confirm they pass**

Run: `npx vitest run tests/store/treeSlice.test.ts --reporter=basic`
Expected: full file green.

- [ ] **Step 5: Run full suite to catch regressions**

Run: `npx vitest run --reporter=basic`
Expected: full suite green. Note: any pre-existing test that bought ≥5 levels of cotyledon at stage 0 will now find `currentStage === 1`. These were already renamed in Task 1 and may need a fix — most explicitly set the stage afterwards or don't depend on it. If a test breaks here, the fix is either `useGameStore.setState({ currentStage: 0 })` after the buys, or asserting the new (correct) state.

- [ ] **Step 6: Commit**

```bash
git add src/store/treeSlice.ts tests/store/treeSlice.test.ts
git commit -m "feat(tree): auto-advance stage inside buyPartLevel

buyPartLevel now calls growSapling() in a guarded loop after a
successful purchase, so reaching a stage threshold via buying
immediately advances. Defensive loop cap of 100 iterations.
Manual growSapling() action retained as the canonical mutation
point.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Auto-grow inside `treeTick`

**Files:**
- Modify: `src/store/treeSlice.ts:115-125` (extend `treeTick`)
- Modify: `tests/store/treeSlice.test.ts` (new test cases)

- [ ] **Step 1: Write failing test — treeTick auto-grows when state qualifies on entry**

Append to the `treeSlice — treeTick` describe block in `tests/store/treeSlice.test.ts`:

```ts
it("treeTick auto-advances stage when state qualifies on entry", () => {
  // Simulate post-migration state where partLevels qualify but currentStage didn't advance.
  useGameStore.setState({
    currentStage: 0,
    partLevels: {
      ...useGameStore.getState().partLevels,
      cotyledon: 5,
    },
  });
  useGameStore.getState().treeTick(0.1);
  expect(useGameStore.getState().currentStage).toBe(1);
});

it("treeTick does NOT auto-advance at the final stage", () => {
  useGameStore.setState({ currentStage: TREE_STAGES.length - 1 });
  useGameStore.getState().treeTick(0.1);
  expect(useGameStore.getState().currentStage).toBe(TREE_STAGES.length - 1);
});
```

- [ ] **Step 2: Run the new tests to confirm they fail**

Run: `npx vitest run tests/store/treeSlice.test.ts -t "treeTick auto" --reporter=basic`
Expected: 1 failure (the first; the second passes by luck because there's no advance to do).

- [ ] **Step 3: Implement auto-grow inside `treeTick`**

In `src/store/treeSlice.ts`, modify `treeTick` to check `canGrowSapling` and call `growSapling()` once at the end. Use the same 100-iter guard for consistency:

```ts
treeTick: (deltaSeconds) => {
  if (deltaSeconds <= 0) return;
  const state = get();
  const producing = getProducingParts(state);
  if (producing.length > 0) {
    const multiplier = getInspiMultiplier(state);
    const rate = inspiPerSec(producing, multiplier);
    if (rate.gt(0)) {
      const gain = rate.mul(deltaSeconds);
      state.add("inspiration", gain);
    }
  }
  // Defensive auto-advance: catches loaded saves whose partLevels already
  // qualify without a fresh buy event (post-migration, balance-curve shifts).
  for (let i = 0; i < 100 && canGrowSapling(get()); i++) {
    get().growSapling();
  }
},
```

Note the restructuring: the original early-return `if (producing.length === 0) return` is replaced with a nested `if`, so the auto-grow tail always runs. The behavior of "no parts producing ⇒ no inspi credit" is preserved.

- [ ] **Step 4: Run the new tests to confirm they pass**

Run: `npx vitest run tests/store/treeSlice.test.ts --reporter=basic`
Expected: full file green.

- [ ] **Step 5: Run full suite**

Run: `npx vitest run --reporter=basic`
Expected: full suite green.

- [ ] **Step 6: Commit**

```bash
git add src/store/treeSlice.ts tests/store/treeSlice.test.ts
git commit -m "feat(tree): auto-advance stage inside treeTick

Safety-net auto-advance: treeTick now calls growSapling() (in a
guarded loop) after the inspi-credit step, so a loaded save whose
partLevels already qualify advances on the next frame without
requiring a buy event. Same 100-iter cap as buyPartLevel.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Save migration v13 → v14

**Files:**
- Modify: `src/store/index.ts:37` (`SAVE_VERSION`), `src/store/index.ts:91` (`migrate`)
- Modify: `tests/store/persistence-integration.test.ts` (new test case)

- [ ] **Step 1: Write failing migration test**

Append to `tests/store/persistence-integration.test.ts` after the existing migration test (search the file for the latest `if (fromVersion < N)` test or `migrate` invocation; add the new test in the same describe block):

```ts
it("v13 → v14 migration: wipes tree state, preserves other slices", () => {
  const v13Save = {
    currentStage: 2,
    partLevels: { spark: 7, bud: 3, leaf: 2, branch: 0, bough: 0, crown: 0 },
    gold: big(12345),
    inspiration: big(678),
    fame: big(9),
    purchasedNodes: { someNode: 1 },
    inventory: [],
    equipped: {},
    workshopLevel: 4,
    workshopXp: big(20),
    paintMastery: big(11),
    lifetimeGold: big(100),
    sellPriceLevel: 1, speedLevel: 1, sizeLevel: 0,
    critLevel: 0, comboLevel: 0, comboChain: 0,
    isCritThisCanvas: false,
    officeLevel: 0, officeXp: big(0),
    queue: [], roster: [], trickleTimer: 0,
    pastRuns: [],
    playerId: "test-uuid",
    pokeTreeTimer: 0,
  };
  const migrated = migrate(v13Save, 13) as Record<string, unknown>;
  // Tree wiped:
  expect(migrated.currentStage).toBe(0);
  const pl = migrated.partLevels as Record<string, number>;
  expect(pl.spark).toBeUndefined();
  expect(pl.cotyledon).toBe(0);
  expect(pl.tendril).toBe(0);
  expect(pl.stalk).toBe(0);
  // Other slices preserved:
  expect((migrated.gold as { toString: () => string }).toString()).toBe("12345");
  expect((migrated.fame as { toString: () => string }).toString()).toBe("9");
  expect(migrated.workshopLevel).toBe(4);
  expect(migrated.purchasedNodes).toEqual({ someNode: 1 });
  expect(migrated.playerId).toBe("test-uuid");
});
```

- [ ] **Step 2: Run the new test to confirm it fails**

Run: `npx vitest run tests/store/persistence-integration.test.ts -t "v13 → v14" --reporter=basic`
Expected: failure (no v13→v14 migration step yet; `currentStage` survives as 2 and `partLevels` still has `spark`).

- [ ] **Step 3: Bump `SAVE_VERSION` and add the migration step**

In `src/store/index.ts`:

Change line ~37:
```ts
const SAVE_VERSION = 14;
```

In the `migrate` function, after the `if (fromVersion < 13)` block, add:

```ts
if (fromVersion < 14) {
  // v13 → v14 (2026-05-12): inspiration tree rewrite — 6 stages with new
  // part IDs (cotyledon, tendril, ..., stalk). Old part IDs have no
  // mechanical equivalent; mapping them would produce misleading state.
  // Wipe currentStage + partLevels only; all other slices preserved.
  // See docs/superpowers/specs/2026-05-12-inspiration-tree-expansion-design.md.
  const TREE_PART_IDS = [
    "cotyledon",
    "tendril", "budtip",
    "vein", "leaflet",
    "twig", "branch", "leaf",
    "softbough", "quietleaf", "faintvein",
    "greenshoot", "lushbough", "vividleaf", "stalk",
  ];
  const wipedPartLevels: Record<string, number> = {};
  for (const id of TREE_PART_IDS) wipedPartLevels[id] = 0;
  state = {
    ...state,
    currentStage: 0,
    partLevels: wipedPartLevels,
  };
}
```

Also extend the JSDoc above `migrate` with a one-line note. After the existing `v12 → v13` JSDoc paragraph (around line ~89), add:

```ts
 *
 * v13 → v14 (2026-05-12): inspiration tree rewrite — 6 stages with new
 * part IDs. Wipe currentStage + partLevels; all other slices preserved.
```

- [ ] **Step 4: Run the new test to confirm it passes**

Run: `npx vitest run tests/store/persistence-integration.test.ts --reporter=basic`
Expected: green.

- [ ] **Step 5: Run full suite + tsc**

Run: `npx vitest run --reporter=basic && npx tsc --noEmit`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add src/store/index.ts tests/store/persistence-integration.test.ts
git commit -m "store(persist): save migration v13 → v14 wipes tree only

Inspiration tree rewrite changed every part ID. Mapping old IDs
to new produces misleading state, so the migration resets
currentStage to 0 and partLevels to all-zero on the new keys.
Currency, fame nodes, items, workers, PM, lifetime preserved.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: StagePanel — drop Grow button, dynamic chip names

**Files:**
- Modify: `src/components/tree/StagePanel.tsx` (remove Grow button + props; read names from TREE_STAGES)
- Modify: `src/components/tree/StagePanel.module.css` (tighten chip spacing for 6)
- Modify: `tests/components/tree/StagePanel.test.tsx` (drop Grow-button cases; assert 6 chips)
- Modify: `tests/components/tree/StagePanel.hover.test.tsx` (update names + footer)

- [ ] **Step 1: Rewrite `tests/components/tree/StagePanel.test.tsx`**

Replace the entire file (Grow-button tests removed; chip count → 6; names updated):

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StagePanel } from "@/components/tree/StagePanel";

describe("<StagePanel />", () => {
  it("renders all 6 stage chips with the current one marked active", () => {
    render(
      <StagePanel
        currentStageIndex={1}
        currentStageName="Bud"
        nextStageName="Leaflet"
        totalLevelsInStage={5}
        unlockThreshold={12}
      />,
    );
    const chips = screen.getAllByTestId(/stage-chip-/);
    expect(chips).toHaveLength(6);
    expect(screen.getByTestId("stage-chip-1")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("stage-chip-0")).not.toHaveAttribute("data-active", "true");
  });

  it("renders the title 'Stage A → Stage B' with current and next", () => {
    render(
      <StagePanel
        currentStageIndex={1}
        currentStageName="Bud"
        nextStageName="Leaflet"
        totalLevelsInStage={5}
        unlockThreshold={12}
      />,
    );
    expect(screen.getByText(/Bud.*Leaflet/i)).toBeInTheDocument();
  });

  it("renders the progress label '{N} / {threshold} levels in stage'", () => {
    render(
      <StagePanel
        currentStageIndex={1}
        currentStageName="Bud"
        nextStageName="Leaflet"
        totalLevelsInStage={5}
        unlockThreshold={12}
      />,
    );
    expect(screen.getByText(/5 \/ 12 levels in stage/i)).toBeInTheDocument();
  });

  it("does NOT render a Grow button (advancement is automatic)", () => {
    render(
      <StagePanel
        currentStageIndex={1}
        currentStageName="Bud"
        nextStageName="Leaflet"
        totalLevelsInStage={12}
        unlockThreshold={12}
      />,
    );
    expect(screen.queryByRole("button", { name: /Grow/i })).not.toBeInTheDocument();
  });

  it("renders 'Final stage' when nextStageName is undefined", () => {
    render(
      <StagePanel
        currentStageIndex={5}
        currentStageName="Verdant Shoot"
        nextStageName={undefined}
        totalLevelsInStage={150}
        unlockThreshold={100}
      />,
    );
    expect(screen.getByText(/Final stage/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Update `tests/components/tree/StagePanel.hover.test.tsx`**

Apply these substitutions: stage names "Seed/Sapling/Tree" → "Tiny Sprout/Bud/Leaflet" or any other valid pair from the new config; `unlockThreshold={10}` → `unlockThreshold={5}`; the footer regex `/Grow.*next stage/` becomes `/automatically/i`; and drop the `canGrow` + `onGrow` props from each render call.

Concrete rewrite:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StagePanel } from "@/components/tree/StagePanel";
import { useGameStore } from "@/store";

describe("StagePanel hover wiring", () => {
  beforeEach(() => {
    useGameStore.setState({
      hoverTitle: "", hoverBody: "", hoverFooter: "",
    });
  });

  it("hover (non-final, mid-progress) shows 'Tiny Sprout → Bud' title and need-more body", () => {
    render(
      <StagePanel
        currentStageIndex={0} currentStageName="Tiny Sprout" nextStageName="Bud"
        totalLevelsInStage={2} unlockThreshold={5}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("stage-panel"));
    expect(useGameStore.getState().hoverTitle).toBe("Tiny Sprout → Bud");
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Levels in stage: 2 \/ 5/);
    expect(container.textContent).toMatch(/Progress: 40%/);
    expect(container.textContent).toMatch(/Need 3 more levels/);
    expect(String(useGameStore.getState().hoverFooter)).toMatch(/automatically/i);
  });

  it("hover (non-final, threshold reached) shows 'Ready to grow!'", () => {
    render(
      <StagePanel
        currentStageIndex={0} currentStageName="Tiny Sprout" nextStageName="Bud"
        totalLevelsInStage={5} unlockThreshold={5}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("stage-panel"));
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/Ready to grow!/);
  });

  it("hover (final stage) shows '· Final stage' title and final-state body, empty footer", () => {
    render(
      <StagePanel
        currentStageIndex={5} currentStageName="Verdant Shoot" nextStageName={undefined}
        totalLevelsInStage={150} unlockThreshold={0}
      />,
    );
    fireEvent.mouseEnter(screen.getByTestId("stage-panel"));
    expect(useGameStore.getState().hoverTitle).toBe("Verdant Shoot · Final stage");
    const { container } = render(<>{useGameStore.getState().hoverBody}</>);
    expect(container.textContent).toMatch(/final stage/i);
    expect(String(useGameStore.getState().hoverFooter)).toBe("");
  });
});
```

- [ ] **Step 3: Run the StagePanel tests to confirm they fail**

Run: `npx vitest run tests/components/tree/StagePanel --reporter=basic`
Expected: type errors / runtime failures (component still expects `canGrow` + `onGrow` props; chip strip still has 3).

- [ ] **Step 4: Rewrite `src/components/tree/StagePanel.tsx`**

Replace the file content with:

```tsx
import type { JSX } from "react";
import { Hoverable } from "@/ui/widgets/Hoverable";
import { TREE_STAGES } from "@/config/treeStages";
import styles from "./StagePanel.module.css";

interface Props {
  currentStageIndex: number;
  currentStageName: string;
  nextStageName: string | undefined;
  totalLevelsInStage: number;
  unlockThreshold: number;
}

function stagePanelHoverBody(
  isFinal: boolean,
  totalLevels: number,
  threshold: number,
): JSX.Element {
  if (isFinal) {
    return (
      <>
        <div>You've reached the final stage of the tree.</div>
        <div>Continue earning inspiration to ascend for fame.</div>
      </>
    );
  }
  const pct = threshold > 0 ? Math.min(100, (totalLevels / threshold) * 100) : 0;
  const need = Math.max(0, threshold - totalLevels);
  const canGrow = need === 0;
  return (
    <>
      <div>Levels in stage: {totalLevels} / {threshold}</div>
      <div>Progress: {pct.toFixed(0)}%</div>
      <div>───</div>
      <div>{canGrow ? "Ready to grow!" : `Need ${need} more levels.`}</div>
    </>
  );
}

/**
 * Top-of-right-rail stage progress panel. Stage advancement is automatic
 * (see treeSlice.buyPartLevel + treeTick); this panel is informational only.
 */
export function StagePanel({
  currentStageIndex,
  currentStageName,
  nextStageName,
  totalLevelsInStage,
  unlockThreshold,
}: Props): JSX.Element {
  const isFinal = nextStageName === undefined;
  const progressPct =
    unlockThreshold > 0 ? Math.min(100, (totalLevelsInStage / unlockThreshold) * 100) : 0;

  return (
    <Hoverable
      as="div"
      title={() =>
        isFinal
          ? `${currentStageName} · Final stage`
          : `${currentStageName} → ${nextStageName}`
      }
      body={() => stagePanelHoverBody(isFinal, totalLevelsInStage, unlockThreshold)}
      footer={() => (isFinal ? "" : "Stage advances automatically when threshold is reached.")}
    >
      <section
        className={styles.panel}
        aria-label="Stage progress"
        data-testid="stage-panel"
      >
        <header className={styles.title}>
          {isFinal ? (
            <span>{currentStageName} · Final stage</span>
          ) : (
            <span>
              {currentStageName} → {nextStageName}
            </span>
          )}
        </header>

        <ol className={styles.chips} aria-label="Stage chain">
          {TREE_STAGES.map((stage, idx) => (
            <li
              key={stage.id}
              className={styles.chip}
              data-testid={`stage-chip-${idx}`}
              data-active={idx === currentStageIndex ? "true" : undefined}
            >
              <span>{stage.name}</span>
              {idx < TREE_STAGES.length - 1 && (
                <span className={styles.arrow} aria-hidden="true">→</span>
              )}
            </li>
          ))}
        </ol>

        {!isFinal && (
          <>
            <div
              className={styles.progress}
              role="progressbar"
              aria-valuenow={totalLevelsInStage}
              aria-valuemin={0}
              aria-valuemax={unlockThreshold}
            >
              <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
            </div>
            <div className={styles.progressLabel}>
              {totalLevelsInStage} / {unlockThreshold} levels in stage
            </div>
          </>
        )}
      </section>
    </Hoverable>
  );
}
```

- [ ] **Step 5: Tighten chip spacing in `src/components/tree/StagePanel.module.css`**

The chip strip now has 6 chips. Read the existing `.chips` and `.chip` rules, then reduce horizontal gap / chip padding by ~30-40% so the strip fits in the same rail width.

Open `src/components/tree/StagePanel.module.css`, find the `.chips` and `.chip` selectors. Halve any `gap`, `padding`, or `font-size` values that look tight when rendered (or reduce by 30%, designer choice). Concrete defensible defaults (use these unless existing values say otherwise):

```css
.chips {
  gap: 4px;        /* was likely 8-12px */
  font-size: 11px; /* was likely 13-14px */
}
.chip {
  padding: 2px 6px; /* was likely 4px 10px or similar */
}
.arrow {
  margin: 0 2px;    /* tighter than before */
}
```

If the existing values are already small, skip this step — but the visual landed with 3 chips originally and needs to be revisited.

- [ ] **Step 6: Run StagePanel tests + full suite**

Run: `npx vitest run tests/components/tree/StagePanel --reporter=basic`
Expected: green.

Run: `npx vitest run --reporter=basic`
Expected: green (TreeRoute and other consumers may still pass `canGrow` / `onGrow` as extra unused props; TS will catch this in Task 7 if it does — for now the runtime ignores extra props).

- [ ] **Step 7: Commit**

```bash
git add src/components/tree/StagePanel.tsx src/components/tree/StagePanel.module.css \
        tests/components/tree/StagePanel.test.tsx tests/components/tree/StagePanel.hover.test.tsx
git commit -m "ui(tree): StagePanel reads names from config, drops Grow button

StagePanel.tsx now iterates TREE_STAGES for the chip strip (6
chips instead of a hardcoded 3) and no longer accepts canGrow /
onGrow props — stage advancement is automatic. Hover footer
updated. Chip spacing tightened for 6.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: TreeScene — sprite tier mapping (6 stages → 3 sprites)

**Files:**
- Modify: `src/components/tree/TreeScene.tsx` (replace 3-element STAGE_NAMES lookup with tier mapping)

- [ ] **Step 1: Add a tier-mapping function + update consumer**

In `src/components/tree/TreeScene.tsx`, replace the 3-element `STAGE_NAMES` and the `treeStageName` derivation. The component still renders one of three SVG variants — only the stage→tier mapping changes.

Edit the top of the file (~line 8-19):

```tsx
/**
 * 6 stages map onto 3 sprite tiers: floor(stage/2). Stages 7+ will need new
 * sprite art; this mapping is intentionally minimal until then.
 */
const SPRITE_TIERS = ["seed", "sapling", "tree"] as const;
const getSpriteTier = (stage: number): typeof SPRITE_TIERS[number] => {
  const tier = Math.min(SPRITE_TIERS.length - 1, Math.max(0, Math.floor(stage / 2)));
  return SPRITE_TIERS[tier]!;
};

/**
 * Pixel-art landscape: sky → mountains → hills → pond → ground → tree → motes → fireflies.
 * The tree visual has 3 variants keyed off the sprite tier (= floor(stage/2)).
 */
export function TreeScene({ stage }: Props): JSX.Element {
  const treeStageName = getSpriteTier(stage);
```

And update the sprite-render conditions further down. Currently:
```tsx
{stage === 0 && ( /* seed SVG */ )}
{stage === 1 && ( /* sapling SVG */ )}
{stage === 2 && ( /* tree SVG */ )}
```

Change to use the tier:
```tsx
{treeStageName === "seed" && ( /* unchanged seed SVG */ )}
{treeStageName === "sapling" && ( /* unchanged sapling SVG */ )}
{treeStageName === "tree" && ( /* unchanged tree SVG */ )}
```

(SVG bodies are unchanged.)

- [ ] **Step 2: Run TreeScene-touching tests**

Run: `npx vitest run tests/components/tree tests/routes/TreeRoute.test.tsx --reporter=basic`
Expected: green. TreeRoute already asserts on the SVG existence (`container.querySelector("svg")`) which survives the tier change.

- [ ] **Step 3: Commit**

```bash
git add src/components/tree/TreeScene.tsx
git commit -m "ui(tree): TreeScene maps 6 stages onto 3 sprite tiers

Replaces the 3-element STAGE_NAMES lookup with a floor(stage/2)
tier mapping so stages 0-1 use the seed sprite, 2-3 the sapling
sprite, 4-5 the tree sprite. SVG bodies are unchanged — new art
follows when stages 7+ are authored.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: TreeRoute — drop growSapling wiring + add stage-up toast

**Files:**
- Modify: `src/routes/TreeRoute.tsx` (drop growSapling import + onGrow prop; add toast)
- Modify: `src/routes/TreeRoute.module.css` (toast keyframes)
- Modify: `tests/routes/TreeRoute.test.tsx` (no new assertions strictly required; the existing 6-chip + scene SVG cover the surface)

- [ ] **Step 1: Read the existing CSS to know what's there**

Run: `cat src/routes/TreeRoute.module.css | head -80`

This is for orientation only — note the existing class names (`.layout`, `.scene`, `.rail`, etc.) so the new `.stageUpToast` rule fits the style.

- [ ] **Step 2: Update `src/routes/TreeRoute.tsx`**

Apply two changes:

1. Drop the `growSapling` selector and the `onGrow` prop on `<StagePanel>`. Also drop the `canGrow` prop (no longer in StagePanel's signature).
2. Add a `useEffect` that watches `currentStage` via a `useRef` and shows a 2-second toast inside the `.scene` container when the stage advances.

Replace the file content:

```tsx
import { useEffect, useRef, useState, type JSX } from "react";
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";
import { TREE_STAGES } from "@/config/treeStages";
import { treePartCost, inspiPerSec } from "@/core/balance";
import { getInspiMultiplier } from "@/core/multipliers";
import { getProducingParts, getTotalLevelsInStage } from "@/store/treeSlice";
import { formatBig } from "@/core/formatter";
import { TreeScene } from "@/components/tree/TreeScene";
import { InspiReadout } from "@/components/tree/InspiReadout";
import { StagePanel } from "@/components/tree/StagePanel";
import { UpgradeRow } from "@/components/tree/UpgradeRow";
import styles from "./TreeRoute.module.css";

const TOAST_DURATION_MS = 2000;

export function TreeRoute(): JSX.Element {
  const currentStage = useGameStore((s) => s.currentStage);
  const partLevels = useGameStore((s) => s.partLevels);
  const gold = useGameStore((s) => s.gold);
  const equipped = useGameStore((s) => s.equipped);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);
  const buyPartLevel = useGameStore((s) => s.buyPartLevel);
  const buyAllAffordableTreeParts = useGameStore((s) => s.buyAllAffordableTreeParts);

  const helperState = {
    currentStage,
    partLevels,
    equipped,
    purchasedNodes,
  } as unknown as GameStore;

  const rate = inspiPerSec(getProducingParts(helperState), getInspiMultiplier(helperState));
  const stageConfig = TREE_STAGES[currentStage];
  const stageName = stageConfig?.name ?? "?";
  const nextStageConfig = TREE_STAGES[currentStage + 1];
  const totalLevels = getTotalLevelsInStage(helperState, currentStage);

  // Visible parts: every part of stages 0..currentStage.
  const visibleParts = TREE_STAGES.slice(0, currentStage + 1).flatMap((stage) => stage.parts);
  const anyAffordable = visibleParts.some((part) =>
    gold.gte(treePartCost(partLevels[part.id] ?? 0, part.baseCost)),
  );

  // Stage-up toast — show for 2s when currentStage advances.
  const lastStageRef = useRef(currentStage);
  const [toastName, setToastName] = useState<string | null>(null);
  useEffect(() => {
    if (currentStage > lastStageRef.current) {
      setToastName(stageName);
      const t = window.setTimeout(() => setToastName(null), TOAST_DURATION_MS);
      lastStageRef.current = currentStage;
      return () => window.clearTimeout(t);
    }
    lastStageRef.current = currentStage;
    return undefined;
  }, [currentStage, stageName]);

  return (
    <div className={styles.layout}>
      <div className={styles.scene}>
        <TreeScene stage={currentStage} />
        <InspiReadout rate={formatBig(rate)} stageName={stageName} />
        {toastName && (
          <div className={styles.stageUpToast} data-testid="stage-up-toast">
            Grown into {toastName}!
          </div>
        )}
      </div>

      <aside className={styles.rail}>
        <StagePanel
          currentStageIndex={currentStage}
          currentStageName={stageName}
          nextStageName={nextStageConfig?.name}
          totalLevelsInStage={totalLevels}
          unlockThreshold={nextStageConfig?.unlockThreshold ?? 0}
        />

        <section className={styles.upgrades} aria-label="Upgrades">
          <header className={styles.upgradesHeader}>
            <span>Upgrades · spend gold</span>
            <button
              type="button"
              className={styles.buyAllBtn}
              disabled={!anyAffordable}
              onClick={() => buyAllAffordableTreeParts()}
              title={anyAffordable ? "Buy all affordable upgrades (cheapest first)" : "Nothing affordable"}
            >
              Buy all
            </button>
          </header>
          <ul className={styles.upgradeList}>
            {visibleParts.map((part) => {
              const level = partLevels[part.id] ?? 0;
              const cost = treePartCost(level, part.baseCost);
              const canAfford = gold.gte(cost);
              return (
                <UpgradeRow
                  key={part.id}
                  partId={part.id}
                  name={part.name}
                  level={level}
                  rate={part.rate}
                  cost={formatBig(cost)}
                  canAfford={canAfford}
                  onBuy={() => buyPartLevel(part.id)}
                />
              );
            })}
          </ul>
        </section>
      </aside>
    </div>
  );
}
```

- [ ] **Step 3: Append toast styles to `src/routes/TreeRoute.module.css`**

Append at the end of the file:

```css
.stageUpToast {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 14px;
  border-radius: 6px;
  background: rgba(20, 26, 18, 0.85);
  color: #f4efe6;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  pointer-events: none;
  animation: stageUpFade 2s ease forwards;
  z-index: 10;
}
@keyframes stageUpFade {
  0%   { opacity: 0; transform: translate(-50%, -8px); }
  10%  { opacity: 1; transform: translate(-50%, 0); }
  85%  { opacity: 1; transform: translate(-50%, 0); }
  100% { opacity: 0; transform: translate(-50%, -4px); }
}
```

Verify `.scene` has `position: relative` already; if not, add `position: relative;` to its rule. (Likely yes — the InspiReadout is positioned similarly.)

- [ ] **Step 4: Run tree-related tests + tsc**

Run: `npx vitest run tests/routes/TreeRoute.test.tsx tests/components/tree --reporter=basic && npx tsc --noEmit`
Expected: both clean. TS in particular catches removed-prop mismatches.

- [ ] **Step 5: Commit**

```bash
git add src/routes/TreeRoute.tsx src/routes/TreeRoute.module.css
git commit -m "ui(tree): drop growSapling wiring; add 2-second stage-up toast

TreeRoute no longer threads growSapling / canGrow into StagePanel
(stage advancement is automatic via the slice). A toast inside
the .scene container surfaces \"Grown into {stageName}!\" for 2
seconds when currentStage increases — useRef tracks the prior
value, CSS keyframes drive the fade.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: Final verification

**Files:** none modified — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run --reporter=basic`
Expected: all tests pass (target ≥ 750 tests; the additions in Tasks 2-5 net ~5-8 new test cases).

- [ ] **Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: clean. Bundle size noted in output; assert delta ≤ 5 KB gzipped vs. last build (164 KB per HANDOVER).

- [ ] **Step 4: Manual browser smoke**

Run: `npm run dev`
Open `http://localhost:5173/`. Hard-refresh (Ctrl+Shift+R) to clear stale HMR / localStorage. Open DevTools → Application → IndexedDB → `artdle-save` and confirm the save migrated cleanly (version 14; `currentStage: 0`; `partLevels` keys = the 15 new IDs all at 0).

Then verify by hand:
1. Buy `cotyledon` 5 times → stage flips to **Bud** automatically, toast reads "Grown into Bud!".
2. Buy a couple of `tendril` levels, watch inspi/sec rise.
3. Continue through to **Leaflet** and ideally **Sapling** to confirm the cascade.
4. Confirm there is no `Grow` button anywhere in the right rail.
5. Confirm the chip strip shows all 6 stage names; the current stage is highlighted.

- [ ] **Step 5: (Optional) Push the work**

If the user asks, push the branch — otherwise stop here and report findings.

---

## Self-Review Checklist (run after writing this plan)

- **Spec coverage**
  - Config rewrite → Task 1 ✓
  - Auto-grow in buyPartLevel → Task 2 ✓
  - Auto-grow in treeTick → Task 3 ✓
  - Migration v13 → v14 → Task 4 ✓
  - StagePanel dynamic names + drop Grow → Task 5 ✓
  - TreeScene tier mapping → Task 6 ✓
  - TreeRoute drops growSapling + adds toast → Task 7 ✓
  - Future-stages reference doc → spec only (no code task)
- **Placeholder scan** — no TBD/TODO entries; every code block is complete.
- **Type consistency** — `StagePanel` props are removed identically in component, types-only assertion in tests, and call site (TreeRoute) — the three places to change are listed in the same task.
- **Test ordering** — Task 1 keeps the suite green; subsequent tasks each add cases TDD-style.
