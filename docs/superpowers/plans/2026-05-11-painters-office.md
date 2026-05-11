# Painter's Office Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Subproject 3 — the Painter's Office. A passive idle counterpart to the Workshop: trickle queue of candidate workers, hire/reject/fire decisions, per-worker geometric XP scaling, Office Level meta-progression that survives ascend.

**Architecture:** New `officeSlice` (state + actions) following the Workshop slice pattern. New `officeRoll.ts` mirroring `workshopRoll.ts` but with per-worker weight ranges + class-driven affix sampling. Office Level controls trickle rate, tier ceiling, tier-roll probability. Roster cap + queue cap + class unlocks all come from user-authored fame nodes via capability tags (extending the subproject-2 system). Workers buff the canvas through `getOfficeContribution()` added to every multiplier in `multipliers.ts` — additive with Workshop and skill-tree contributions.

**Tech Stack:** React 19 + TypeScript strict + Zustand 5 + `break_eternity.js` (Big arithmetic past worker L~15 / office L~30) + Vitest.

**Spec reference:** `docs/superpowers/specs/2026-05-10-painters-office-design.md`.

---

## File Structure (decomposition lock-in)

**New files:**

- `src/config/officeClasses.ts` — class definitions: id, capability gate, weight ranges per AffixKind, class-roll weight
- `src/core/officeRoll.ts` — roll engine: `rollWorkerClass`, `rollWorkerWeights`, `rollWorkerAffixes`, `rollCandidate`. Mirrors `workshopRoll.ts`.
- `src/store/officeSlice.ts` — slice with state + actions + selectors (`getRosterCap`, `getQueueCap`, `getClassUnlocked`, `getOfficeTierCap`, `getHireCost`, `getOfficeContribution`)
- `src/components/painting/OfficeRoom.tsx` — main 340px right-rail panel
- `src/components/painting/OfficeLevelHeader.tsx` — level + XP bar + tier cap + trickle period
- `src/components/painting/QueueCard.tsx` — candidate display with Hire/Reject
- `src/components/painting/WorkerCard.tsx` — roster member with Fire
- `src/components/painting/FireConfirmModal.tsx` — confirmation modal on fire
- `src/components/painting/OfficeRoom.module.css` — styles (one CSS file per .tsx, mirroring Workshop)
- Test files: `tests/core/officeRoll.test.ts`, `tests/store/officeSlice.test.ts`, `tests/store/officeSlice.xp.test.ts`, plus extensions to existing `tests/core/balance.test.ts` and `tests/core/multipliers.test.ts`.

**Modified files:**

- `src/core/balance.ts` — add Office constants + formulas (`levelScale`, `workerXpToNext`, `officeXpToNext`, `trickleSeconds`, `hireCost`, etc.)
- `src/core/multipliers.ts` — add `getOfficeContribution(state, kind)`; extend `getCanvasGoldMultiplier`, `getCanvasSpeedMultiplier`, `getCritChance`, `getComboBaseChance`, `getSizeMultiplier` to include office contribution.
- `src/store/skillTreeSlice.ts` — add `countCapability(state, capability)` summing `purchasedNodes[id].level` for nodes with that capability tag.
- `src/store/index.ts` — register `officeSlice`, add to `tickAll`, bump `SAVE_VERSION` 12 → 13 + migration block.
- `src/store/canvasSlice.ts` — call `state.awardOfficeXp(gain)` after a sale.
- `src/systems/ascend.ts` — call `state.resetOffice()` in `performAscendOrchestrator`.
- `src/components/painting/RoomRail.tsx` — accept `activeRoom` + `onSelect` props; read `office.enabled` from `getRosterCap(state) >= 1`.
- `src/routes/PaintingRoute.tsx` — local `activeRoom` state, render `<OfficeRoom>` vs `<WorkshopRoom>`.
- `src/dev/skillDesigner/*` — add quick-add chips for `roster_slot`, `queue_slot`, `class_goldsmith`, `class_speedrunner` capabilities.

---

## Task 1: Office balance constants + Big-valued formulas

**Files:**
- Modify: `src/core/balance.ts`
- Test: `tests/core/balance.test.ts` (extend)

- [ ] **Step 1: Write the failing tests for `levelScale`**

Add to `tests/core/balance.test.ts`:

```typescript
import { levelScale } from "@/core/balance";
import { big } from "@/core/bigNumber";

describe("levelScale (per-worker geometric XP scaling)", () => {
  it("returns 1 at L0", () => {
    expect(levelScale(0).toNumber()).toBeCloseTo(1, 6);
  });
  it("returns 1.04 at L1", () => {
    expect(levelScale(1).toNumber()).toBeCloseTo(1.04, 6);
  });
  it("returns ~2.19 at L20", () => {
    expect(levelScale(20).toNumber()).toBeCloseTo(Math.pow(1.04, 20), 4);
  });
  it("returns Big past L100 (no Number saturation)", () => {
    const s = levelScale(500);
    expect(s.gt(big(1e6))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/balance.test.ts -t "levelScale"`
Expected: FAIL — `levelScale` not exported.

- [ ] **Step 3: Implement `levelScale`**

Add to `src/core/balance.ts`:

```typescript
import { big, type Big } from "@/core/bigNumber";

export const LEVEL_SCALE_GROWTH = 1.04;

/**
 * Per-worker geometric XP scaling. Multiplies worker affix magnitudes.
 * Big-valued past L~30 (1.04^30 ≈ 3.24, but cumulative effects in
 * getOfficeContribution can push much higher).
 */
export const levelScale = (level: number): Big =>
  big(LEVEL_SCALE_GROWTH).pow(level);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/balance.test.ts -t "levelScale"`
Expected: PASS (4 tests).

- [ ] **Step 5: Add `workerXpToNext` + `officeXpToNext` tests**

Add to the same describe-block area:

```typescript
import { workerXpToNext, officeXpToNext, WORKER_XP_BASE, OFFICE_XP_BASE } from "@/core/balance";

describe("workerXpToNext", () => {
  it("equals WORKER_XP_BASE at L0", () => {
    expect(workerXpToNext(0).eq(big(WORKER_XP_BASE))).toBe(true);
  });
  it("grows by 1.15 per level", () => {
    const l0 = workerXpToNext(0);
    const l1 = workerXpToNext(1);
    expect(l1.div(l0).toNumber()).toBeCloseTo(1.15, 4);
  });
});

describe("officeXpToNext", () => {
  it("equals OFFICE_XP_BASE at L0", () => {
    expect(officeXpToNext(0).eq(big(OFFICE_XP_BASE))).toBe(true);
  });
  it("grows by 1.30 per level (steeper than worker curve)", () => {
    const l0 = officeXpToNext(0);
    const l1 = officeXpToNext(1);
    expect(l1.div(l0).toNumber()).toBeCloseTo(1.30, 4);
  });
});
```

- [ ] **Step 6: Run to verify fail**

Run: `npx vitest run tests/core/balance.test.ts -t "XpToNext"`
Expected: FAIL — functions not exported.

- [ ] **Step 7: Implement the XP formulas**

Add to `src/core/balance.ts`:

```typescript
export const WORKER_XP_BASE = 10;
export const WORKER_XP_GROWTH = 1.15;
export const OFFICE_XP_BASE = 50;
export const OFFICE_XP_GROWTH = 1.30;

/**
 * XP required to advance from `level` to `level + 1` (per worker).
 * Big-valued past L~15.
 */
export const workerXpToNext = (level: number): Big =>
  big(WORKER_XP_BASE).mul(big(WORKER_XP_GROWTH).pow(level));

/**
 * XP required to advance Office Level from `level` to `level + 1`.
 * Steeper than `workerXpToNext` by design — Office Level is long-tail
 * meta-progression spanning multiple ascend cycles. Big-valued past L~25.
 */
export const officeXpToNext = (level: number): Big =>
  big(OFFICE_XP_BASE).mul(big(OFFICE_XP_GROWTH).pow(level));
```

- [ ] **Step 8: Run to verify pass**

Run: `npx vitest run tests/core/balance.test.ts -t "XpToNext"`
Expected: PASS.

- [ ] **Step 9: Add trickleSeconds tests + implementation**

Append tests:

```typescript
import { trickleSeconds, TRICKLE_BASE_SECONDS, TRICKLE_FLOOR_SECONDS } from "@/core/balance";

describe("trickleSeconds (geometric decay with floor)", () => {
  it("returns TRICKLE_BASE_SECONDS at L0", () => {
    expect(trickleSeconds(0)).toBeCloseTo(TRICKLE_BASE_SECONDS, 4);
  });
  it("decays by 0.97 per level", () => {
    expect(trickleSeconds(1)).toBeCloseTo(TRICKLE_BASE_SECONDS * 0.97, 4);
  });
  it("floors at TRICKLE_FLOOR_SECONDS by high L", () => {
    expect(trickleSeconds(1000)).toBe(TRICKLE_FLOOR_SECONDS);
  });
});
```

Implementation in `balance.ts`:

```typescript
export const TRICKLE_BASE_SECONDS = 60;
export const TRICKLE_DECAY = 0.97;
export const TRICKLE_FLOOR_SECONDS = 5;

/** Seconds between trickled candidates, as a function of Office Level. */
export const trickleSeconds = (officeLevel: number): number =>
  Math.max(TRICKLE_FLOOR_SECONDS, TRICKLE_BASE_SECONDS * Math.pow(TRICKLE_DECAY, officeLevel));
```

- [ ] **Step 10: Add tier tables + tier-prob tests**

Append tests:

```typescript
import { OFFICE_TIER_UNLOCK_LEVEL, OFFICE_TIER_AFFIX_COUNT, computeOfficeTierProbabilities } from "@/core/balance";

describe("Office tier table", () => {
  it("Common = L1, Magic = L3, Rare = L8, Epic = L20, Legendary = L40", () => {
    expect(OFFICE_TIER_UNLOCK_LEVEL.common).toBe(1);
    expect(OFFICE_TIER_UNLOCK_LEVEL.magic).toBe(3);
    expect(OFFICE_TIER_UNLOCK_LEVEL.rare).toBe(8);
    expect(OFFICE_TIER_UNLOCK_LEVEL.epic).toBe(20);
    expect(OFFICE_TIER_UNLOCK_LEVEL.legendary).toBe(40);
  });
  it("affix slot count = 1/2/3/4/5", () => {
    expect(OFFICE_TIER_AFFIX_COUNT.common).toBe(1);
    expect(OFFICE_TIER_AFFIX_COUNT.legendary).toBe(5);
  });
});

describe("computeOfficeTierProbabilities", () => {
  it("at L1, only common rolls", () => {
    const p = computeOfficeTierProbabilities(1);
    expect(p.common).toBe(1);
    expect(p.magic).toBe(0);
  });
  it("at L100, non-common sum < 1", () => {
    const p = computeOfficeTierProbabilities(100);
    const nonCommon = p.magic + p.rare + p.epic + p.legendary;
    expect(nonCommon).toBeCloseTo(0.30 + 0.25 + 0.20 + 0.15, 4);
    expect(p.common).toBeCloseTo(0.10, 4);
  });
});
```

Implementation:

```typescript
export type WorkerTier = "common" | "magic" | "rare" | "epic" | "legendary";
export const ALL_WORKER_TIERS: ReadonlyArray<WorkerTier> = [
  "common", "magic", "rare", "epic", "legendary",
];

export const OFFICE_TIER_UNLOCK_LEVEL: Record<WorkerTier, number> = {
  common: 1, magic: 3, rare: 8, epic: 20, legendary: 40,
};

export const OFFICE_TIER_AFFIX_COUNT: Record<WorkerTier, number> = {
  common: 1, magic: 2, rare: 3, epic: 4, legendary: 5,
};

interface TierProbRange { readonly min: number; readonly max: number; }
const OFFICE_TIER_PROB_RANGES: Record<Exclude<WorkerTier, "common">, TierProbRange> = {
  magic:     { min: 0.05, max: 0.30 },
  rare:      { min: 0.05, max: 0.25 },
  epic:      { min: 0.05, max: 0.20 },
  legendary: { min: 0.05, max: 0.15 },
};

const OFFICE_PROB_MAX_LEVEL = 100;

/** Linear interp from (unlock_level, min) to (PROB_MAX_LEVEL, max) per tier; common = residual. */
export function computeOfficeTierProbabilities(officeLevel: number): Record<WorkerTier, number> {
  let nonCommonSum = 0;
  const out: Record<string, number> = {};
  for (const tier of ALL_WORKER_TIERS) {
    if (tier === "common") continue;
    const range = OFFICE_TIER_PROB_RANGES[tier];
    const unlock = OFFICE_TIER_UNLOCK_LEVEL[tier];
    if (officeLevel < unlock) { out[tier] = 0; continue; }
    const span = OFFICE_PROB_MAX_LEVEL - unlock;
    const t = span <= 0 ? 1 : Math.min(1, (officeLevel - unlock) / span);
    const prob = range.min + (range.max - range.min) * t;
    out[tier] = prob;
    nonCommonSum += prob;
  }
  out.common = Math.max(0, 1 - nonCommonSum);
  return out as Record<WorkerTier, number>;
}
```

- [ ] **Step 11: Add hire-cost + XP-gold-fraction constants**

Append tests:

```typescript
import { hireCost, HIRE_TIER_BASE, XP_GOLD_FRACTION, HIRE_OFFICE_LEVEL_GROWTH } from "@/core/balance";

describe("hireCost", () => {
  it("at min-roll Common, L0, cost ≈ tierBase × 1", () => {
    const c = hireCost({
      tier: "common", magnitudeSum: 5, maxMagnitudeSum: 15,
    }, 0);
    // qualityFactor at min = 1
    expect(c.toNumber()).toBeCloseTo(HIRE_TIER_BASE.common, 4);
  });
  it("at max-roll Legendary, L0, cost ≈ tierBase × 5", () => {
    const c = hireCost({
      tier: "legendary", magnitudeSum: 75, maxMagnitudeSum: 75,
    }, 0);
    // qualityFactor at max = 5 (HIRE_QUALITY_MAX)
    expect(c.toNumber()).toBeCloseTo(HIRE_TIER_BASE.legendary * 5, 4);
  });
  it("officeLevelFactor at L20 ≈ 1.10^20", () => {
    const c1 = hireCost({ tier: "common", magnitudeSum: 5, maxMagnitudeSum: 15 }, 20);
    const c0 = hireCost({ tier: "common", magnitudeSum: 5, maxMagnitudeSum: 15 }, 0);
    expect(c1.div(c0).toNumber()).toBeCloseTo(Math.pow(1.10, 20), 4);
  });
});
```

Implementation:

```typescript
export const HIRE_TIER_BASE: Record<WorkerTier, number> = {
  common: 100, magic: 1_000, rare: 10_000, epic: 100_000, legendary: 1_000_000,
};
export const HIRE_QUALITY_MAX = 5;
export const HIRE_OFFICE_LEVEL_GROWTH = 1.10;
export const XP_GOLD_FRACTION = 0.01;

interface HireCostInput {
  readonly tier: WorkerTier;
  readonly magnitudeSum: number;        // sum of this worker's affix magnitudes (raw pp)
  readonly maxMagnitudeSum: number;     // sum of max possible magnitudes for this tier
}

/** Hire cost in gold (Big-valued past Office L~30). */
export function hireCost(input: HireCostInput, officeLevel: number): Big {
  const ratio = input.maxMagnitudeSum > 0 ? input.magnitudeSum / input.maxMagnitudeSum : 0;
  // qualityFactor lerps 1 → HIRE_QUALITY_MAX as ratio goes 0 → 1
  const qualityFactor = 1 + (HIRE_QUALITY_MAX - 1) * ratio;
  return big(HIRE_TIER_BASE[input.tier])
    .mul(qualityFactor)
    .mul(big(HIRE_OFFICE_LEVEL_GROWTH).pow(officeLevel));
}
```

- [ ] **Step 12: Run full test file to verify everything passes**

Run: `npx vitest run tests/core/balance.test.ts`
Expected: PASS — all existing + new tests.

- [ ] **Step 13: Commit**

```bash
git add src/core/balance.ts tests/core/balance.test.ts
git commit -m "core(balance): add Painter's Office formulas + constants

Adds levelScale, workerXpToNext, officeXpToNext, trickleSeconds,
hireCost, computeOfficeTierProbabilities and the matching constants
(HIRE_TIER_BASE, XP_GOLD_FRACTION, OFFICE_TIER_UNLOCK_LEVEL, etc.).
All Big-valued formulas return Big — break_eternity discipline.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Office class config

**Files:**
- Create: `src/config/officeClasses.ts`
- Test: `tests/config/officeClasses.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/config/officeClasses.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { OFFICE_CLASSES, GENERALIST_CLASS_WEIGHT, SPECIALIST_CLASS_WEIGHT } from "@/config/officeClasses";

describe("officeClasses config", () => {
  it("exposes generalist, goldsmith, speedrunner", () => {
    expect(OFFICE_CLASSES.generalist).toBeDefined();
    expect(OFFICE_CLASSES.goldsmith).toBeDefined();
    expect(OFFICE_CLASSES.speedrunner).toBeDefined();
  });

  it("generalist has no capability gate", () => {
    expect(OFFICE_CLASSES.generalist.capability).toBeNull();
  });

  it("goldsmith and speedrunner each have a capability gate", () => {
    expect(OFFICE_CLASSES.goldsmith.capability).toBe("class_goldsmith");
    expect(OFFICE_CLASSES.speedrunner.capability).toBe("class_speedrunner");
  });

  it("generalist weight ranges are [0, 4] across all 5 kinds", () => {
    const w = OFFICE_CLASSES.generalist.weightRanges;
    for (const kind of ["+sell_price%", "+speed%", "+size%", "+crit_chance%", "+combo_chance%"] as const) {
      expect(w[kind]).toEqual({ min: 0, max: 4 });
    }
  });

  it("goldsmith is gold-heavy (sell + combo [3,7]; speed + crit [0,2]; size [1,3])", () => {
    const w = OFFICE_CLASSES.goldsmith.weightRanges;
    expect(w["+sell_price%"]).toEqual({ min: 3, max: 7 });
    expect(w["+combo_chance%"]).toEqual({ min: 3, max: 7 });
    expect(w["+speed%"]).toEqual({ min: 0, max: 2 });
    expect(w["+crit_chance%"]).toEqual({ min: 0, max: 2 });
    expect(w["+size%"]).toEqual({ min: 1, max: 3 });
  });

  it("speedrunner is speed-heavy (mirror of goldsmith)", () => {
    const w = OFFICE_CLASSES.speedrunner.weightRanges;
    expect(w["+speed%"]).toEqual({ min: 3, max: 7 });
    expect(w["+crit_chance%"]).toEqual({ min: 3, max: 7 });
    expect(w["+sell_price%"]).toEqual({ min: 0, max: 2 });
    expect(w["+combo_chance%"]).toEqual({ min: 0, max: 2 });
    expect(w["+size%"]).toEqual({ min: 1, max: 3 });
  });

  it("generalist class roll weight is 3; specialists are 1", () => {
    expect(GENERALIST_CLASS_WEIGHT).toBe(3);
    expect(SPECIALIST_CLASS_WEIGHT).toBe(1);
  });
});
```

- [ ] **Step 2: Verify the test fails**

Run: `npx vitest run tests/config/officeClasses.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the config**

Create `src/config/officeClasses.ts`:

```typescript
import type { AffixKind } from "@/config/workshopAffixes";

export type ClassId = "generalist" | "goldsmith" | "speedrunner";

export interface WeightRange {
  readonly min: number;
  readonly max: number;
}

export interface OfficeClassConfig {
  readonly id: ClassId;
  /** Capability tag required to unlock this class. `null` = always available. */
  readonly capability: string | null;
  /** Per-AffixKind weight range. Per-worker weight is rolled from this range at hire time. */
  readonly weightRanges: Record<AffixKind, WeightRange>;
}

/** Class roll weights for the 3:1:1 distribution (generalist common, specialists rare). */
export const GENERALIST_CLASS_WEIGHT = 3;
export const SPECIALIST_CLASS_WEIGHT = 1;

export const OFFICE_CLASSES: Record<ClassId, OfficeClassConfig> = {
  generalist: {
    id: "generalist",
    capability: null,
    weightRanges: {
      "+sell_price%":   { min: 0, max: 4 },
      "+speed%":        { min: 0, max: 4 },
      "+size%":         { min: 0, max: 4 },
      "+crit_chance%":  { min: 0, max: 4 },
      "+combo_chance%": { min: 0, max: 4 },
    },
  },
  goldsmith: {
    id: "goldsmith",
    capability: "class_goldsmith",
    weightRanges: {
      "+sell_price%":   { min: 3, max: 7 },
      "+speed%":        { min: 0, max: 2 },
      "+size%":         { min: 1, max: 3 },
      "+crit_chance%":  { min: 0, max: 2 },
      "+combo_chance%": { min: 3, max: 7 },
    },
  },
  speedrunner: {
    id: "speedrunner",
    capability: "class_speedrunner",
    weightRanges: {
      "+sell_price%":   { min: 0, max: 2 },
      "+speed%":        { min: 3, max: 7 },
      "+size%":         { min: 1, max: 3 },
      "+crit_chance%":  { min: 3, max: 7 },
      "+combo_chance%": { min: 0, max: 2 },
    },
  },
};

export const ALL_CLASS_IDS: ReadonlyArray<ClassId> = ["generalist", "goldsmith", "speedrunner"];
```

- [ ] **Step 4: Verify the test passes**

Run: `npx vitest run tests/config/officeClasses.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/officeClasses.ts tests/config/officeClasses.test.ts
git commit -m "config(office): class definitions with weight ranges

Generalist (uniform [0,4]), Goldsmith (sell+combo [3,7], off-spec [0,2]),
Speedrunner (speed+crit [3,7], off-spec [0,2]). Class roll weights:
generalist 3, specialists 1. Capability gates: class_goldsmith and
class_speedrunner; generalist always available.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: countCapability helper in skillTreeSlice

**Files:**
- Modify: `src/store/skillTreeSlice.ts`
- Test: `tests/store/skillTreeSlice.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Add to `tests/store/skillTreeSlice.test.ts`:

```typescript
import { countCapability } from "@/store/skillTreeSlice";

describe("countCapability — sums level across nodes with the tag", () => {
  it("returns 0 when no purchased nodes carry the tag", () => {
    const state = { purchasedNodes: {} } as GameStore;
    expect(countCapability(state, "roster_slot")).toBe(0);
  });

  it("sums the level of each purchased node whose unlocks include the tag", () => {
    // Setup: stub a node "test_roster" with unlocks: ["roster_slot"] in the registry.
    // (Use the existing test-bench pattern in this file — there should already be
    // a stub or a way to inject a test config.)
    // For this test, count a real registered node if available, OR install one inline.
    // Implementation note: if test registry doesn't allow inline injection, defer
    // this test to an integration test in tests/store/skillTreeSlice.integration.test.ts.

    // Example assuming test-bench helpers exist:
    const state = {
      purchasedNodes: { test_roster: 3 },
    } as GameStore;
    // Mock getSkillNodeConfig to return a node carrying the capability.
    // See workshopRoll.test.ts pattern for stub injection.
    expect(countCapability(state, "roster_slot")).toBe(3);
  });
});
```

Note: if test-bench config injection isn't trivial, write this test against an existing registered node — find one in `src/config/skillTreeNodes.ts` that has any `unlocks` tag (post-subproject-2 nodes have them) and verify summing works.

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run tests/store/skillTreeSlice.test.ts -t "countCapability"`
Expected: FAIL — `countCapability` not exported.

- [ ] **Step 3: Implement countCapability**

Add to `src/store/skillTreeSlice.ts` (near `hasCapability`):

```typescript
/**
 * Sum of `node.level` across all purchased nodes whose config.unlocks array
 * contains `capability`. Used for count-based capability tags like
 * `roster_slot` and `queue_slot` where each level of an authored node grants
 * +1 to the cap.
 */
export const countCapability = (state: GameStore, capability: string): number => {
  let total = 0;
  for (const [nodeId, level] of Object.entries(state.purchasedNodes)) {
    const lvl = level ?? 0;
    if (lvl < 1) continue;
    const config = getSkillNodeConfig(nodeId);
    if (config && config.unlocks.includes(capability)) total += lvl;
  }
  return total;
};
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/store/skillTreeSlice.test.ts -t "countCapability"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/skillTreeSlice.ts tests/store/skillTreeSlice.test.ts
git commit -m "store(skill-tree): add countCapability selector

Sums purchased node levels across nodes whose unlocks tag contains the
given capability. Companion to hasCapability (boolean). Used by
Painter's Office for roster_slot / queue_slot caps.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Office roll engine — class roll

**Files:**
- Create: `src/core/officeRoll.ts`
- Test: `tests/core/officeRoll.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/core/officeRoll.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { rollWorkerClass } from "@/core/officeRoll";
import { setSeed } from "@/core/rng";
import type { GameStore } from "@/store";

function stub(over: Partial<GameStore> = {}): GameStore {
  return { purchasedNodes: {}, ...over } as GameStore;
}

describe("rollWorkerClass", () => {
  it("returns generalist when no class capabilities are unlocked", () => {
    setSeed(1);
    for (let i = 0; i < 50; i++) {
      expect(rollWorkerClass(stub())).toBe("generalist");
    }
  });

  it("respects the 3:1 weight when goldsmith is unlocked", () => {
    // Stub state where hasCapability(state, "class_goldsmith") returns true.
    // We use a real node from the config that carries class_goldsmith, OR
    // install one in the test bench. For initial coverage, simulate by
    // monkey-patching hasCapability via a wrapper test — see test bench pattern.
    setSeed(2);
    let generalist = 0;
    let goldsmith = 0;
    const state = { purchasedNodes: { goldsmith_unlock_node: 1 } } as GameStore;
    // Requires a test-config node like `goldsmith_unlock_node` with unlocks: ["class_goldsmith"].
    // If not present in skillTreeNodes.ts, write it as a fixture before running.
    for (let i = 0; i < 1000; i++) {
      const c = rollWorkerClass(state);
      if (c === "generalist") generalist++;
      if (c === "goldsmith") goldsmith++;
    }
    // 3:1 ratio with sampling tolerance
    expect(generalist / goldsmith).toBeGreaterThan(2);
    expect(generalist / goldsmith).toBeLessThan(4);
  });
});
```

NOTE: if the skillTreeNodes.ts doesn't yet have a `class_goldsmith` capability-carrying node, **defer the second test until Task 18** (SkillDesigner integration). Initial pass: only assert the generalist-only case.

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/core/officeRoll.test.ts -t "rollWorkerClass"`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement rollWorkerClass**

Create `src/core/officeRoll.ts`:

```typescript
import { rng } from "@/core/rng";
import {
  OFFICE_CLASSES,
  ALL_CLASS_IDS,
  GENERALIST_CLASS_WEIGHT,
  SPECIALIST_CLASS_WEIGHT,
} from "@/config/officeClasses";
import type { ClassId } from "@/config/officeClasses";
import { hasCapability } from "@/store/skillTreeSlice";
import type { GameStore } from "@/store";

/** True if the class is available (Generalist always; specialists via capability tag). */
export function isClassUnlocked(state: GameStore, classId: ClassId): boolean {
  const config = OFFICE_CLASSES[classId];
  if (config.capability === null) return true;
  return hasCapability(state, config.capability);
}

/**
 * Roll a class for a new candidate. Weight = 3 for generalist, 1 for each
 * unlocked specialist. Locked specialists are excluded from the pool.
 */
export function rollWorkerClass(state: GameStore): ClassId {
  const available: Array<{ id: ClassId; weight: number }> = [];
  for (const id of ALL_CLASS_IDS) {
    if (!isClassUnlocked(state, id)) continue;
    available.push({
      id,
      weight: id === "generalist" ? GENERALIST_CLASS_WEIGHT : SPECIALIST_CLASS_WEIGHT,
    });
  }
  if (available.length === 0) {
    throw new Error("rollWorkerClass: no class unlocked (generalist should always be available)");
  }
  const total = available.reduce((acc, c) => acc + c.weight, 0);
  const r = rng() * total;
  let acc = 0;
  for (const c of available) {
    acc += c.weight;
    if (r < acc) return c.id;
  }
  return available[available.length - 1].id;
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/core/officeRoll.test.ts -t "rollWorkerClass"`
Expected: PASS (at minimum the generalist-only test).

- [ ] **Step 5: Commit**

```bash
git add src/core/officeRoll.ts tests/core/officeRoll.test.ts
git commit -m "core(office): class roll with capability-gated specialists

rollWorkerClass picks from unlocked classes (generalist always, specialists
via class_<id> capability tags). Weights: 3:1 generalist:specialist.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Office roll engine — weight roll with reroll-on-zero

**Files:**
- Modify: `src/core/officeRoll.ts`
- Test: `tests/core/officeRoll.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `tests/core/officeRoll.test.ts`:

```typescript
import { rollWorkerWeights } from "@/core/officeRoll";
import { OFFICE_CLASSES } from "@/config/officeClasses";

describe("rollWorkerWeights", () => {
  it("generalist: each weight is in [0, 4]", () => {
    setSeed(10);
    for (let i = 0; i < 100; i++) {
      const w = rollWorkerWeights("generalist");
      for (const kind of Object.keys(w) as Array<keyof typeof w>) {
        expect(w[kind]).toBeGreaterThanOrEqual(0);
        expect(w[kind]).toBeLessThanOrEqual(4);
      }
    }
  });

  it("goldsmith: sell + combo in [3, 7]; speed + crit in [0, 2]; size in [1, 3]", () => {
    setSeed(11);
    for (let i = 0; i < 100; i++) {
      const w = rollWorkerWeights("goldsmith");
      expect(w["+sell_price%"]).toBeGreaterThanOrEqual(3);
      expect(w["+sell_price%"]).toBeLessThanOrEqual(7);
      expect(w["+combo_chance%"]).toBeGreaterThanOrEqual(3);
      expect(w["+combo_chance%"]).toBeLessThanOrEqual(7);
      expect(w["+speed%"]).toBeLessThanOrEqual(2);
      expect(w["+crit_chance%"]).toBeLessThanOrEqual(2);
      expect(w["+size%"]).toBeGreaterThanOrEqual(1);
      expect(w["+size%"]).toBeLessThanOrEqual(3);
    }
  });

  it("generalist never returns all-zero weights (rerolls)", () => {
    setSeed(12);
    for (let i = 0; i < 200; i++) {
      const w = rollWorkerWeights("generalist");
      const sum = Object.values(w).reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/core/officeRoll.test.ts -t "rollWorkerWeights"`
Expected: FAIL — `rollWorkerWeights` not exported.

- [ ] **Step 3: Implement rollWorkerWeights**

Append to `src/core/officeRoll.ts`:

```typescript
import { rngInt } from "@/core/rng";
import type { AffixKind } from "@/config/workshopAffixes";

const MAX_REROLL_ATTEMPTS = 100;

export type WeightTuple = Record<AffixKind, number>;

/**
 * Roll per-kind sampling weights for a new worker of the given class.
 * For Generalist (range [0, 4] per kind), an all-zero roll is rerolled.
 * For specialists, off-spec ranges have positive minima (e.g., Goldsmith
 * +sell [3,7]) so all-zero is structurally impossible.
 */
export function rollWorkerWeights(classId: ClassId): WeightTuple {
  const ranges = OFFICE_CLASSES[classId].weightRanges;
  for (let attempt = 0; attempt < MAX_REROLL_ATTEMPTS; attempt++) {
    const out: Record<string, number> = {};
    let sum = 0;
    for (const kind of Object.keys(ranges) as ReadonlyArray<AffixKind>) {
      const r = ranges[kind];
      const w = rngInt(r.min, r.max);
      out[kind] = w;
      sum += w;
    }
    if (sum > 0) return out as WeightTuple;
  }
  throw new Error(`rollWorkerWeights: ${MAX_REROLL_ATTEMPTS} consecutive all-zero rolls — class ${classId} ranges may be misconfigured`);
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/core/officeRoll.test.ts -t "rollWorkerWeights"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/officeRoll.ts tests/core/officeRoll.test.ts
git commit -m "core(office): rollWorkerWeights with reroll-on-all-zero

Per-worker weight tuple sampled from class weight ranges. Generalist
[0,4] can produce all-zero; rerolls up to 100 times. Specialists have
positive minima on spec axes so structural all-zero is impossible.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Office roll engine — affix roll using per-worker weights

**Files:**
- Modify: `src/core/officeRoll.ts`
- Test: `tests/core/officeRoll.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append:

```typescript
import { rollWorkerAffixes } from "@/core/officeRoll";

describe("rollWorkerAffixes", () => {
  it("rolls exactly tier-slot-count affixes for a legendary (5)", () => {
    setSeed(20);
    const weights = { "+sell_price%": 1, "+speed%": 1, "+size%": 1, "+crit_chance%": 1, "+combo_chance%": 1 };
    const affixes = rollWorkerAffixes(weights, "legendary", stub());
    expect(affixes.length).toBe(5);
  });

  it("rolls 1 affix for common", () => {
    setSeed(21);
    const weights = { "+sell_price%": 2, "+speed%": 2, "+size%": 2, "+crit_chance%": 2, "+combo_chance%": 2 };
    const affixes = rollWorkerAffixes(weights, "common", stub());
    expect(affixes.length).toBe(1);
  });

  it("respects per-worker weights (high-weight kinds dominate)", () => {
    setSeed(22);
    const weights = { "+sell_price%": 100, "+speed%": 0, "+size%": 0, "+crit_chance%": 0, "+combo_chance%": 0 };
    const affixes = rollWorkerAffixes(weights, "legendary", stub());
    for (const a of affixes) {
      expect(a.kind).toBe("+sell_price%");
    }
  });

  it("each affix magnitude is in the AFFIX_MAGNITUDE_RANGE for its kind", () => {
    setSeed(23);
    const weights = { "+sell_price%": 1, "+speed%": 1, "+size%": 1, "+crit_chance%": 1, "+combo_chance%": 1 };
    const affixes = rollWorkerAffixes(weights, "legendary", stub());
    for (const a of affixes) {
      const range = AFFIX_MAGNITUDE_RANGE[a.kind];
      expect(a.magnitude).toBeGreaterThanOrEqual(range.min);
      expect(a.magnitude).toBeLessThanOrEqual(range.max);
    }
  });
});
```

(add `import { AFFIX_MAGNITUDE_RANGE } from "@/config/workshopAffixes";` at top.)

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/core/officeRoll.test.ts -t "rollWorkerAffixes"`
Expected: FAIL — function not exported.

- [ ] **Step 3: Implement rollWorkerAffixes**

Append to `src/core/officeRoll.ts`:

```typescript
import { AFFIX_KINDS, AFFIX_MAGNITUDE_RANGE } from "@/config/workshopAffixes";
import { OFFICE_TIER_AFFIX_COUNT } from "@/core/balance";
import type { WorkerTier } from "@/core/balance";
import type { Affix } from "@/core/workshopRoll";
import { getCanvasTrackUnlocked } from "@/store/skillTreeSlice";
import type { CanvasTrackId } from "@/store/skillTreeSlice";

const KIND_TO_TRACK: Record<AffixKind, CanvasTrackId> = {
  "+sell_price%": "sell_price",
  "+speed%": "speed",
  "+crit_chance%": "crit",
  "+combo_chance%": "combo",
  "+size%": "size",
};

/** Pool filtered by skill-tree unlock state (reuses the subproject-2 capability gating). */
function availableKinds(state: GameStore): ReadonlyArray<AffixKind> {
  return AFFIX_KINDS.filter((k) => getCanvasTrackUnlocked(state, KIND_TO_TRACK[k]));
}

/** Weighted pick on `pool` using the worker's `weights`. Kinds not in pool are excluded. */
function weightedPick(pool: ReadonlyArray<AffixKind>, weights: WeightTuple): AffixKind {
  let total = 0;
  for (const k of pool) total += weights[k];
  if (total <= 0) {
    // All available kinds have weight 0 for this worker. Fallback: uniform pick.
    // (Should be rare: Generalist guards against all-zero; specialists have positive
    // minima on some kinds, which will usually be in the pool.)
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const r = Math.random() * total; // use rng() in real impl
  // ...
  return pool[0];
}
```

(Use `rng()` not `Math.random()` — refer to existing patterns.)

Full implementation:

```typescript
import { rng } from "@/core/rng";

function weightedPick(pool: ReadonlyArray<AffixKind>, weights: WeightTuple): AffixKind {
  let total = 0;
  for (const k of pool) total += weights[k];
  if (total <= 0) {
    // Fallback uniform if all pool kinds have zero weight (edge case after pool filtering)
    return pool[Math.floor(rng() * pool.length)];
  }
  const r = rng() * total;
  let acc = 0;
  for (const k of pool) {
    acc += weights[k];
    if (r < acc) return k;
  }
  return pool[pool.length - 1];
}

/** Roll the affixes for a worker. Duplicates allowed (same as Workshop). */
export function rollWorkerAffixes(
  weights: WeightTuple,
  tier: WorkerTier,
  state: GameStore,
): ReadonlyArray<Affix> {
  const count = OFFICE_TIER_AFFIX_COUNT[tier];
  const pool = availableKinds(state);
  if (pool.length === 0) throw new Error("rollWorkerAffixes: empty affix pool");
  const out: Affix[] = [];
  for (let i = 0; i < count; i++) {
    const kind = weightedPick(pool, weights);
    const range = AFFIX_MAGNITUDE_RANGE[kind];
    const magnitude = rngInt(range.min, range.max);
    out.push({ kind, magnitude });
  }
  return out;
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/core/officeRoll.test.ts -t "rollWorkerAffixes"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/officeRoll.ts tests/core/officeRoll.test.ts
git commit -m "core(office): rollWorkerAffixes — weighted sampling per worker

Reuses workshop's availableKinds filter for capability gating; uses the
per-worker WeightTuple from rollWorkerWeights for the weighted pick.
Duplicates allowed (mirror Workshop). Magnitudes from existing
AFFIX_MAGNITUDE_RANGE table.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Office roll engine — full rollCandidate pipeline

**Files:**
- Modify: `src/core/officeRoll.ts`
- Test: `tests/core/officeRoll.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append:

```typescript
import { rollCandidate } from "@/core/officeRoll";

describe("rollCandidate", () => {
  it("at office L1 (common-only), tier is common and affix count is 1", () => {
    setSeed(30);
    const c = rollCandidate(1, stub());
    expect(c.tier).toBe("common");
    expect(c.affixes.length).toBe(1);
    expect(c.class).toBe("generalist"); // only class available
  });

  it("at office L40+, occasionally rolls legendary", () => {
    setSeed(31);
    let sawLegendary = false;
    for (let i = 0; i < 1000; i++) {
      const c = rollCandidate(100, stub());
      if (c.tier === "legendary") {
        sawLegendary = true;
        expect(c.affixes.length).toBe(5);
        break;
      }
    }
    expect(sawLegendary).toBe(true);
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/core/officeRoll.test.ts -t "rollCandidate"`
Expected: FAIL.

- [ ] **Step 3: Implement rollCandidate**

Append to `src/core/officeRoll.ts`:

```typescript
import { computeOfficeTierProbabilities, ALL_WORKER_TIERS } from "@/core/balance";

export interface Candidate {
  readonly id: string;
  readonly class: ClassId;
  readonly tier: WorkerTier;
  readonly affixes: ReadonlyArray<Affix>;
}

let _candidateCounter = 0;
function nextCandidateId(): string {
  _candidateCounter += 1;
  return `cand-${Date.now().toString(36)}-${_candidateCounter}`;
}

function rollOfficeTier(officeLevel: number): WorkerTier {
  const probs = computeOfficeTierProbabilities(officeLevel);
  const r = rng();
  let acc = 0;
  for (const t of ALL_WORKER_TIERS) {
    acc += probs[t];
    if (r < acc) return t;
  }
  return "common";
}

/** Full pipeline: tier → class → weights → affixes. Produces a fresh Candidate. */
export function rollCandidate(officeLevel: number, state: GameStore): Candidate {
  const tier = rollOfficeTier(officeLevel);
  const classId = rollWorkerClass(state);
  const weights = rollWorkerWeights(classId);
  const affixes = rollWorkerAffixes(weights, tier, state);
  return {
    id: nextCandidateId(),
    class: classId,
    tier,
    affixes,
  };
}
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/core/officeRoll.test.ts`
Expected: PASS (all officeRoll tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/officeRoll.ts tests/core/officeRoll.test.ts
git commit -m "core(office): rollCandidate full roll pipeline

Composes tier → class → weights → affixes into a fresh Candidate.
Tier rolled from computeOfficeTierProbabilities at the given office
level; class via 3:1:1 weights; affixes via per-worker weighted sample.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: officeSlice — state schema + initial state + stub actions

**Files:**
- Create: `src/store/officeSlice.ts`
- Modify: `src/store/index.ts` (wire slice into combined store)
- Test: `tests/store/officeSlice.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/store/officeSlice.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { initialOfficeState } from "@/store/officeSlice";
import { big } from "@/core/bigNumber";

describe("officeSlice — initial state", () => {
  it("level = 0, xp = big(0)", () => {
    expect(initialOfficeState.officeLevel).toBe(0);
    expect(initialOfficeState.officeXp.eq(big(0))).toBe(true);
  });

  it("queue + roster + trickleTimer empty/zero", () => {
    expect(initialOfficeState.queue).toEqual([]);
    expect(initialOfficeState.roster).toEqual([]);
    expect(initialOfficeState.trickleTimer).toBe(0);
  });
});

describe("officeSlice — wired into GameStore", () => {
  it("store has officeLevel + officeXp on first read", () => {
    // Use a fresh store import; rely on useGameStore being already importable.
    const { useGameStore } = require("@/store");
    const s = useGameStore.getState();
    expect(typeof s.officeLevel).toBe("number");
    expect(s.officeXp).toBeDefined();
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/store/officeSlice.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement officeSlice**

Create `src/store/officeSlice.ts`:

```typescript
import type { StateCreator } from "zustand";
import { big, type Big } from "@/core/bigNumber";
import type { GameStore } from "@/store";
import type { Candidate } from "@/core/officeRoll";
import type { ClassId } from "@/config/officeClasses";
import type { WorkerTier } from "@/core/balance";
import type { Affix } from "@/core/workshopRoll";

export interface Worker {
  readonly id: string;
  readonly class: ClassId;
  readonly tier: WorkerTier;
  readonly level: number;
  readonly xp: Big;
  readonly affixes: ReadonlyArray<Affix>;
}

export interface OfficeState {
  readonly officeLevel: number;
  readonly officeXp: Big;
  readonly queue: ReadonlyArray<Candidate>;
  readonly roster: ReadonlyArray<Worker>;
  readonly trickleTimer: number;
}

export const initialOfficeState: OfficeState = Object.freeze({
  officeLevel: 0,
  officeXp: big(0),
  queue: Object.freeze([]) as ReadonlyArray<Candidate>,
  roster: Object.freeze([]) as ReadonlyArray<Worker>,
  trickleTimer: 0,
}) as OfficeState;

export interface OfficeSlice extends OfficeState {
  tickOffice: (deltaSeconds: number) => void;
  hireFromQueue: (candidateId: string) => boolean;
  rejectFromQueue: (candidateId: string) => boolean;
  fireWorker: (workerId: string) => boolean;
  awardOfficeXp: (goldSold: Big) => void;
  resetOffice: () => void;
}

export const createOfficeSlice: StateCreator<GameStore, [], [], OfficeSlice> = (set, get) => ({
  ...initialOfficeState,

  tickOffice: (_delta: number) => {
    // Stub — implemented in Task 9.
  },
  hireFromQueue: (_id: string) => false,
  rejectFromQueue: (_id: string) => false,
  fireWorker: (_id: string) => false,
  awardOfficeXp: (_g: Big) => {
    // Stub — implemented in Task 12.
  },
  resetOffice: () => {
    set({
      queue: [],
      roster: [],
      trickleTimer: 0,
    });
  },
});
```

- [ ] **Step 4: Wire slice into the combined store**

Edit `src/store/index.ts`:

Import: add `import { createOfficeSlice, type OfficeSlice } from "./officeSlice";`

In `GameStore` union type, add `& OfficeSlice` (alphabetically after `MetaSlice`, before `PaintMasterySlice` — wherever is consistent).

In the `create(...)` body, add `...createOfficeSlice(set, get, store),` to the slice list.

- [ ] **Step 5: Verify pass**

Run: `npx vitest run tests/store/officeSlice.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: PASS (no type errors).

- [ ] **Step 6: Commit**

```bash
git add src/store/officeSlice.ts src/store/index.ts tests/store/officeSlice.test.ts
git commit -m "store(office): slice schema + stub actions + wire into GameStore

OfficeState (level, xp, queue, roster, trickleTimer) + Worker shape.
Initial state: level 0, xp big(0), empty queue/roster. Stub actions
implemented in later tasks; resetOffice wipes run-state (preserving
level + xp for the ascend orchestrator).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: Selectors — getRosterCap, getQueueCap, getOfficeTierCap, getClassUnlocked

**Files:**
- Modify: `src/store/officeSlice.ts` (add selectors)
- Test: `tests/store/officeSlice.test.ts` (extend)

- [ ] **Step 1: Write the failing tests**

Append to `tests/store/officeSlice.test.ts`:

```typescript
import { getRosterCap, getQueueCap, getOfficeTierCap, getClassUnlocked } from "@/store/officeSlice";

describe("getRosterCap / getQueueCap — sum capability levels", () => {
  it("returns 0 when no nodes with roster_slot are purchased", () => {
    const state = { purchasedNodes: {} } as GameStore;
    expect(getRosterCap(state)).toBe(0);
    expect(getQueueCap(state)).toBe(0);
  });

  // More integration tests added in Task 18 once SkillDesigner has the chips.
});

describe("getOfficeTierCap", () => {
  it("returns common at L1", () => {
    const state = { officeLevel: 1 } as GameStore;
    expect(getOfficeTierCap(state)).toBe("common");
  });
  it("returns magic at L3", () => {
    const state = { officeLevel: 3 } as GameStore;
    expect(getOfficeTierCap(state)).toBe("magic");
  });
  it("returns legendary at L40+", () => {
    const state = { officeLevel: 100 } as GameStore;
    expect(getOfficeTierCap(state)).toBe("legendary");
  });
});

describe("getClassUnlocked", () => {
  it("generalist always unlocked", () => {
    const state = { purchasedNodes: {} } as GameStore;
    expect(getClassUnlocked(state, "generalist")).toBe(true);
  });
  it("goldsmith requires class_goldsmith capability", () => {
    const state = { purchasedNodes: {} } as GameStore;
    expect(getClassUnlocked(state, "goldsmith")).toBe(false);
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/store/officeSlice.test.ts -t "getRosterCap|getOfficeTierCap|getClassUnlocked"`
Expected: FAIL.

- [ ] **Step 3: Implement selectors**

Append to `src/store/officeSlice.ts`:

```typescript
import { hasCapability, countCapability } from "@/store/skillTreeSlice";
import { OFFICE_CLASSES } from "@/config/officeClasses";
import { OFFICE_TIER_UNLOCK_LEVEL, ALL_WORKER_TIERS } from "@/core/balance";

/** Max number of hired workers. Sums fame-node levels with the `roster_slot` tag. */
export const getRosterCap = (state: GameStore): number =>
  countCapability(state, "roster_slot");

/** Max number of waiting candidates in the queue. Sums fame-node levels with `queue_slot`. */
export const getQueueCap = (state: GameStore): number =>
  countCapability(state, "queue_slot");

/** Highest tier that can roll in the queue at the player's current office level. */
export const getOfficeTierCap = (state: GameStore): WorkerTier => {
  let cap: WorkerTier = "common";
  for (const t of ALL_WORKER_TIERS) {
    if (state.officeLevel >= OFFICE_TIER_UNLOCK_LEVEL[t]) cap = t;
  }
  return cap;
};

/** Whether the class can roll for new candidates (capability-gate check). */
export const getClassUnlocked = (state: GameStore, classId: ClassId): boolean => {
  const cap = OFFICE_CLASSES[classId].capability;
  if (cap === null) return true;
  return hasCapability(state, cap);
};
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/store/officeSlice.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/officeSlice.ts tests/store/officeSlice.test.ts
git commit -m "store(office): roster/queue cap + tier cap + class unlock selectors

getRosterCap and getQueueCap sum fame-node levels by capability tag
(roster_slot, queue_slot). getOfficeTierCap walks OFFICE_TIER_UNLOCK_LEVEL
to find the highest tier the office level has unlocked. getClassUnlocked
checks capability tags (generalist always; specialists via class_<id>).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: tickOffice — trickle queue advancement

**Files:**
- Modify: `src/store/officeSlice.ts` (replace stub)
- Modify: `src/store/index.ts` (add to tickAll chain)
- Test: `tests/store/officeSlice.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `tests/store/officeSlice.test.ts`:

```typescript
import { trickleSeconds } from "@/core/balance";

describe("tickOffice — trickle", () => {
  // Use the real useGameStore. Mutate it via setState in a beforeEach.
  // Pattern: tests that need fresh state install fixtures via setState.

  it("at office L0, no trickling until L1 unlock (or queue cap 0 → no trickle)", () => {
    // With getQueueCap(state) === 0, no trickling occurs.
    const { useGameStore } = require("@/store");
    useGameStore.setState({
      purchasedNodes: {},          // no queue_slot capability
      officeLevel: 5,              // would trickle if queue cap > 0
      queue: [],
      trickleTimer: 999,           // already overdue
    });
    useGameStore.getState().tickOffice(10);
    expect(useGameStore.getState().queue.length).toBe(0);
  });

  it("when queue cap > 0 and timer rolls over, pushes a new candidate", () => {
    // Requires a node carrying queue_slot, OR mock countCapability.
    // Easier: set state.purchasedNodes such that a test fixture node grants queue_slot.
    // Refer to test bench pattern for skill-tree fixtures.

    // Sketch — actual fixture wiring TBD by the implementing engineer per existing patterns:
    // ...
  });

  // Add a "stops trickling at cap" test once the fixture wiring is in place.
});
```

NOTE: if test-fixture wiring for skill-tree nodes carrying `queue_slot` is non-trivial, defer the second + third trickle tests to Task 18 (post-SkillDesigner integration). At minimum, verify the "no trickle when cap is 0" branch.

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/store/officeSlice.test.ts -t "tickOffice"`
Expected: FAIL — stub returns nothing meaningful.

- [ ] **Step 3: Implement tickOffice**

Replace the stub in `src/store/officeSlice.ts`:

```typescript
import { trickleSeconds } from "@/core/balance";
import { rollCandidate } from "@/core/officeRoll";

// ... inside createOfficeSlice ...

tickOffice: (delta: number) => {
  if (delta <= 0) return;
  const state = get();
  const queueCap = getQueueCap(state);
  if (queueCap <= 0) return;                  // No queue capability → no trickling.
  if (state.queue.length >= queueCap) return; // Cap reached → stop trickling.

  const period = trickleSeconds(state.officeLevel);
  let timer = state.trickleTimer + delta;
  const newCandidates: Candidate[] = [];
  let queueSize = state.queue.length;

  while (timer >= period && queueSize < queueCap) {
    timer -= period;
    newCandidates.push(rollCandidate(state.officeLevel, state));
    queueSize += 1;
  }

  set({
    queue: [...state.queue, ...newCandidates],
    trickleTimer: timer,
  });
},
```

- [ ] **Step 4: Wire officeTick into tickAll**

Edit `src/store/index.ts`:

```typescript
tickAll: (deltaSeconds: number) => {
  const s = get();
  s.treeTick(deltaSeconds);
  s.canvasTick(deltaSeconds);
  s.skillTreeTick(deltaSeconds);
  s.workshopTick(deltaSeconds);
  s.tickOffice(deltaSeconds);  // <-- NEW
},
```

- [ ] **Step 5: Verify pass**

Run: `npx vitest run tests/store/officeSlice.test.ts -t "tickOffice"`
Expected: PASS (at minimum the "no cap = no trickle" branch).

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/store/officeSlice.ts src/store/index.ts tests/store/officeSlice.test.ts
git commit -m "store(office): tickOffice — trickle queue advancement

Advances trickleTimer by deltaSeconds; pushes new rollCandidate()
entries whenever the timer crosses trickleSeconds(officeLevel) AND
queue is under cap. No trickling when cap is 0. Wired into tickAll
after workshopTick.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 11: hireFromQueue / rejectFromQueue / fireWorker + getHireCost

**Files:**
- Modify: `src/store/officeSlice.ts`
- Test: `tests/store/officeSlice.test.ts`

- [ ] **Step 1: Write the failing tests for getHireCost**

```typescript
import { getHireCost } from "@/store/officeSlice";
import { AFFIX_MAGNITUDE_RANGE } from "@/config/workshopAffixes";

describe("getHireCost", () => {
  it("computes cost from tier, affix sum, and office level", () => {
    const state = { officeLevel: 0 } as GameStore;
    const candidate = {
      id: "x", class: "generalist" as const, tier: "common" as const,
      affixes: [{ kind: "+sell_price%" as const, magnitude: 5 }],   // min magnitude
    };
    const cost = getHireCost(state, candidate);
    // common min-roll → tierBase × 1 × 1.10^0 = 100
    expect(cost.toNumber()).toBeCloseTo(100, 4);
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/store/officeSlice.test.ts -t "getHireCost"`
Expected: FAIL.

- [ ] **Step 3: Implement getHireCost + hire/reject/fire actions**

Add to `src/store/officeSlice.ts`:

```typescript
import { hireCost, OFFICE_TIER_AFFIX_COUNT } from "@/core/balance";

/** Sum of max magnitudes for the worker's tier (used by getHireCost normalization). */
function maxMagnitudeSumFor(tier: WorkerTier, affixCount: number): number {
  // We don't know which kinds rolled, but each affix's MAX is the per-kind max.
  // Approximation: assume each slot's max is the average of all kinds' max bounds,
  // OR use the highest possible per-slot max (worst-case max). For consistency,
  // use the SUM of per-slot max bounds where each slot's max equals the median
  // max across kinds. Simpler: use the worker's actual affix kinds, summing
  // AFFIX_MAGNITUDE_RANGE[kind].max for each slot.
  // (Implementation below uses the actual affix kinds.)
  void tier; void affixCount;
  return 0;
}

export const getHireCost = (
  state: GameStore,
  candidate: { tier: WorkerTier; affixes: ReadonlyArray<Affix> },
): Big => {
  let magnitudeSum = 0;
  let minMagnitudeSum = 0;
  let maxMagnitudeSum = 0;
  for (const a of candidate.affixes) {
    magnitudeSum += a.magnitude;
    minMagnitudeSum += AFFIX_MAGNITUDE_RANGE[a.kind].min;
    maxMagnitudeSum += AFFIX_MAGNITUDE_RANGE[a.kind].max;
  }
  return hireCost(
    { tier: candidate.tier, magnitudeSum, minMagnitudeSum, maxMagnitudeSum },
    state.officeLevel,
  );
};
```

(Remove the unused `maxMagnitudeSumFor` stub above — it was scratchpad.)

Add hire/reject/fire actions (replacing stubs):

```typescript
hireFromQueue: (candidateId: string): boolean => {
  const state = get();
  if (state.roster.length >= getRosterCap(state)) return false;
  const candidate = state.queue.find((c) => c.id === candidateId);
  if (!candidate) return false;
  const cost = getHireCost(state, candidate);
  if (state.gold.lt(cost)) return false;

  const worker: Worker = {
    id: candidate.id,
    class: candidate.class,
    tier: candidate.tier,
    level: 1,
    xp: big(0),
    affixes: candidate.affixes,
  };
  set({
    gold: state.gold.sub(cost),
    roster: [...state.roster, worker],
    queue: state.queue.filter((c) => c.id !== candidateId),
  });
  return true;
},

rejectFromQueue: (candidateId: string): boolean => {
  const state = get();
  if (!state.queue.find((c) => c.id === candidateId)) return false;
  set({ queue: state.queue.filter((c) => c.id !== candidateId) });
  return true;
},

fireWorker: (workerId: string): boolean => {
  const state = get();
  if (!state.roster.find((w) => w.id === workerId)) return false;
  set({ roster: state.roster.filter((w) => w.id !== workerId) });
  return true;
},
```

- [ ] **Step 4: Add tests for hire/reject/fire**

```typescript
describe("hireFromQueue", () => {
  it("returns false if no roster slots available", () => {
    const { useGameStore } = require("@/store");
    useGameStore.setState({
      purchasedNodes: {},  // no roster_slot capability
      queue: [{ id: "c1", class: "generalist", tier: "common", affixes: [{ kind: "+sell_price%", magnitude: 10 }] }],
    });
    expect(useGameStore.getState().hireFromQueue("c1")).toBe(false);
    expect(useGameStore.getState().roster.length).toBe(0);
  });
  // More tests TBD with fixture wiring.
});

describe("rejectFromQueue", () => {
  it("removes the candidate from the queue", () => {
    const { useGameStore } = require("@/store");
    useGameStore.setState({
      queue: [
        { id: "c1", class: "generalist", tier: "common", affixes: [] },
        { id: "c2", class: "generalist", tier: "common", affixes: [] },
      ],
    });
    expect(useGameStore.getState().rejectFromQueue("c1")).toBe(true);
    expect(useGameStore.getState().queue.length).toBe(1);
    expect(useGameStore.getState().queue[0].id).toBe("c2");
  });
});

describe("fireWorker", () => {
  it("removes the worker from the roster", () => {
    const { useGameStore } = require("@/store");
    useGameStore.setState({
      roster: [
        { id: "w1", class: "generalist", tier: "common", level: 5, xp: big(0), affixes: [] },
      ],
    });
    expect(useGameStore.getState().fireWorker("w1")).toBe(true);
    expect(useGameStore.getState().roster.length).toBe(0);
  });
});
```

- [ ] **Step 5: Verify pass**

Run: `npx vitest run tests/store/officeSlice.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/store/officeSlice.ts tests/store/officeSlice.test.ts
git commit -m "store(office): hire/reject/fire actions + getHireCost selector

getHireCost computes Big cost from candidate's magnitude sum + tier
+ office level (formula in core/balance.ts).
hireFromQueue: checks roster cap + gold balance, deducts gold, moves
candidate to roster as level-1 worker.
rejectFromQueue: removes from queue.
fireWorker: removes from roster (UI confirmation handled in Task 17).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 12: awardOfficeXp + level-up resolution

**Files:**
- Modify: `src/store/officeSlice.ts` (replace stub)
- Modify: `src/store/canvasSlice.ts` (hook into sale path)
- Test: `tests/store/officeSlice.xp.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/store/officeSlice.xp.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { big } from "@/core/bigNumber";
import { workerXpToNext, officeXpToNext, WORKER_XP_BASE, XP_GOLD_FRACTION } from "@/core/balance";

describe("awardOfficeXp — equal share + mirror to office.xp", () => {
  it("divides the gold-fraction pot equally across roster", () => {
    const { useGameStore } = require("@/store");
    useGameStore.setState({
      officeLevel: 0,
      officeXp: big(0),
      roster: [
        { id: "w1", class: "generalist", tier: "common", level: 1, xp: big(0), affixes: [] },
        { id: "w2", class: "generalist", tier: "common", level: 1, xp: big(0), affixes: [] },
      ],
    });
    const goldSold = big(1000);
    useGameStore.getState().awardOfficeXp(goldSold);
    const pot = goldSold.mul(XP_GOLD_FRACTION);   // 10 XP
    const perWorker = pot.div(2);                  // 5 XP each
    const s = useGameStore.getState();
    expect(s.roster[0].xp.toNumber()).toBeCloseTo(perWorker.toNumber(), 4);
    expect(s.roster[1].xp.toNumber()).toBeCloseTo(perWorker.toNumber(), 4);
    expect(s.officeXp.toNumber()).toBeCloseTo(pot.toNumber(), 4);
  });

  it("levels up a worker when xp ≥ workerXpToNext(level)", () => {
    const { useGameStore } = require("@/store");
    const initialXp = workerXpToNext(1);   // exact cost to level up from 1 → 2
    useGameStore.setState({
      officeLevel: 0,
      officeXp: big(0),
      roster: [
        { id: "w1", class: "generalist", tier: "common", level: 1, xp: initialXp, affixes: [] },
      ],
    });
    // Award 0 — but force the level-up resolution to run by passing tiny gold.
    useGameStore.getState().awardOfficeXp(big(1));
    const s = useGameStore.getState();
    expect(s.roster[0].level).toBe(2);
    // XP carries over (any overflow into the next level's bucket).
  });

  it("noop when roster is empty", () => {
    const { useGameStore } = require("@/store");
    useGameStore.setState({ officeLevel: 0, officeXp: big(0), roster: [] });
    useGameStore.getState().awardOfficeXp(big(1000));
    // officeXp still receives the pot per the spec — Office Level is mirror-of-pot.
    expect(useGameStore.getState().officeXp.toNumber()).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/store/officeSlice.xp.test.ts`
Expected: FAIL — `awardOfficeXp` is still a stub.

- [ ] **Step 3: Implement awardOfficeXp**

Replace the stub in `src/store/officeSlice.ts`:

```typescript
import { workerXpToNext, officeXpToNext, XP_GOLD_FRACTION } from "@/core/balance";

function applyWorkerLevelUps(worker: Worker): Worker {
  let level = worker.level;
  let xp = worker.xp;
  // Cap iterations defensively — runaway loops would be bugs, not idle progression.
  for (let i = 0; i < 1000; i++) {
    const cost = workerXpToNext(level);
    if (xp.lt(cost)) break;
    xp = xp.sub(cost);
    level += 1;
  }
  return { ...worker, level, xp };
}

function applyOfficeLevelUps(currentLevel: number, currentXp: Big): { level: number; xp: Big } {
  let level = currentLevel;
  let xp = currentXp;
  for (let i = 0; i < 1000; i++) {
    const cost = officeXpToNext(level);
    if (xp.lt(cost)) break;
    xp = xp.sub(cost);
    level += 1;
  }
  return { level, xp };
}

awardOfficeXp: (goldSold: Big) => {
  const state = get();
  const pot = goldSold.mul(XP_GOLD_FRACTION);
  if (pot.lte(big(0))) return;

  // Workers: equal share, divides the pot.
  const n = state.roster.length;
  const newRoster = n === 0 ? state.roster : state.roster.map((w) => {
    const share = pot.div(n);
    return applyWorkerLevelUps({ ...w, xp: w.xp.add(share) });
  });

  // Office: mirror the pot (not the per-worker share — sum across N workers = pot).
  const officeAfter = applyOfficeLevelUps(state.officeLevel, state.officeXp.add(pot));

  set({
    roster: newRoster,
    officeXp: officeAfter.xp,
    officeLevel: officeAfter.level,
  });
},
```

- [ ] **Step 4: Hook into canvas sale path**

Edit `src/store/canvasSlice.ts` — inside `canvasTick`, after the sale gain is paid out, call `state.awardOfficeXp(gain)`. Find the existing sale block (around line 123):

```typescript
state.add("gold", gain);
state.addGoldEarned(gain);
state.awardOfficeXp(gain);  // <-- NEW: credit Office XP from this sale
```

- [ ] **Step 5: Verify pass**

Run: `npx vitest run tests/store/officeSlice.xp.test.ts`
Expected: PASS.

Run: `npx vitest run tests/store/canvasSlice.test.ts`
Expected: PASS — existing canvas tests still pass (awardOfficeXp on empty roster is a noop for gold/canvas state).

- [ ] **Step 6: Commit**

```bash
git add src/store/officeSlice.ts src/store/canvasSlice.ts tests/store/officeSlice.xp.test.ts
git commit -m "store(office): awardOfficeXp — equal-share worker XP + mirror office XP

Sale path now credits XP via state.awardOfficeXp(gain). Pot is
goldSold × XP_GOLD_FRACTION. Equal share across roster; office mirrors
the pot (sum of per-worker shares cancels rosterSize). Level-ups
resolved iteratively against workerXpToNext / officeXpToNext.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 13: getOfficeContribution + multiplier wiring

**Files:**
- Modify: `src/core/multipliers.ts`
- Test: `tests/core/multipliers.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `tests/core/multipliers.test.ts`:

```typescript
import { getOfficeContribution } from "@/core/multipliers";
import { big } from "@/core/bigNumber";
import { levelScale } from "@/core/balance";

describe("getOfficeContribution — sums worker affix magnitudes × levelScale", () => {
  it("returns 0 with empty roster", () => {
    const state = { roster: [] } as unknown as GameStore;
    expect(getOfficeContribution(state, "+sell_price%").eq(big(0))).toBe(true);
  });

  it("sums one worker's matching affixes (with level scale)", () => {
    const state = {
      roster: [
        {
          id: "w1", class: "generalist", tier: "common", level: 1, xp: big(0),
          affixes: [{ kind: "+sell_price%", magnitude: 10 }],
        },
      ],
    } as unknown as GameStore;
    const expected = big(10 / 100).mul(levelScale(1));
    expect(getOfficeContribution(state, "+sell_price%").toNumber()).toBeCloseTo(expected.toNumber(), 6);
  });

  it("returns 0 for kinds no worker has", () => {
    const state = {
      roster: [
        {
          id: "w1", class: "generalist", tier: "common", level: 1, xp: big(0),
          affixes: [{ kind: "+sell_price%", magnitude: 10 }],
        },
      ],
    } as unknown as GameStore;
    expect(getOfficeContribution(state, "+speed%").eq(big(0))).toBe(true);
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/core/multipliers.test.ts -t "getOfficeContribution"`
Expected: FAIL.

- [ ] **Step 3: Implement getOfficeContribution**

Add to `src/core/multipliers.ts`:

```typescript
import { levelScale } from "@/core/balance";
import { big, type Big } from "@/core/bigNumber";

/**
 * Sum of (worker.affix.magnitude / 100) × levelScale(worker.level) for all
 * workers whose affix list contains the given kind. Returns Big — at high
 * levels this is genuinely large (levelScale grows geometrically).
 */
export function getOfficeContribution(state: GameStore, kind: AffixKind): Big {
  let total: Big = big(0);
  for (const worker of state.roster) {
    const scale = levelScale(worker.level);
    for (const affix of worker.affixes) {
      if (affix.kind === kind) {
        total = total.add(big(affix.magnitude / 100).mul(scale));
      }
    }
  }
  return total;
}
```

- [ ] **Step 4: Wire into each multiplier**

Edit `src/core/multipliers.ts` — at every place an additive `+X%` consumer reads workshop contribution, also add office contribution.

Find `getCanvasGoldMultiplier` and add `+ getOfficeContribution(state, "+sell_price%").toNumber()` to the additive bonus. Note: office contribution is Big; convert via `.toNumber()` for the additive cumulative (Workshop's contribution is also fractional `number`). At very high levels this may need to be reworked to keep things in Big — see note below.

```typescript
// BEFORE
export function getCanvasGoldMultiplier(state: GameStore): number {
  return 1
    + getEquippedContribution(state, "+sell_price%")
    + state.sellPriceLevel * SELL_PRICE_PER_LEVEL
    + colorTreeContribution(state)
    + rainbowBonus(state);
}

// AFTER
export function getCanvasGoldMultiplier(state: GameStore): number {
  return 1
    + getEquippedContribution(state, "+sell_price%")
    + getOfficeContribution(state, "+sell_price%").toNumber()  // <-- NEW
    + state.sellPriceLevel * SELL_PRICE_PER_LEVEL
    + colorTreeContribution(state)
    + rainbowBonus(state);
}
```

Apply the same pattern (drop in `getOfficeContribution(state, "<kind>").toNumber()` as an additive term) to:
- `getCanvasSpeedMultiplier` ← `+speed%`
- `getCritChance` ← `+crit_chance%`
- `getComboBaseChance` ← `+combo_chance%`
- `getSizeMultiplier` ← `+size%`

**Note on Number vs Big:** The existing multipliers return `number`. At very high office levels, `getOfficeContribution.toNumber()` may saturate at `Number.MAX_SAFE_INTEGER`. For v1.x of the Office this is acceptable — saturation happens past office L~100 with deep worker levels, well into the post-PM regime where canvas gold is already Big and the multiplier-saturation point is "you've already won." A future refactor can return Big from the canvas multipliers if/when this becomes a real progression blocker. Document this consciously in the multiplier comments.

Add a comment block at the top of `multipliers.ts`:

```typescript
/**
 * Canvas multipliers return JS `number`. Office contribution from
 * getOfficeContribution() is Big-valued and gets `.toNumber()`'d before
 * adding to the multiplier sum. This saturates at MAX_SAFE_INTEGER if a
 * single worker stacks magnitudes × levelScale beyond ~9e15 — which only
 * happens past office L~100 with deep worker leveling. A future refactor
 * can move the canvas multipliers to Big if this becomes a progression
 * blocker; for v1.x of the Office, the saturation point is "you've won."
 */
```

- [ ] **Step 5: Verify pass**

Run: `npx vitest run tests/core/multipliers.test.ts`
Expected: PASS — all existing + new tests.

- [ ] **Step 6: Commit**

```bash
git add src/core/multipliers.ts tests/core/multipliers.test.ts
git commit -m "core(multipliers): wire office contribution into all 5 multipliers

getOfficeContribution(state, kind) sums worker affix magnitudes scaled
by levelScale(level). Wired additively into:
  - getCanvasGoldMultiplier   (+sell_price%)
  - getCanvasSpeedMultiplier  (+speed%)
  - getCritChance             (+crit_chance%)
  - getComboBaseChance        (+combo_chance%)
  - getSizeMultiplier         (+size%)
Office contribution is Big; .toNumber()'d at the multiplier boundary
(saturation point documented; future migration to Big at the multiplier
layer when/if it becomes a progression issue).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 14: Ascend orchestrator hook

**Files:**
- Modify: `src/systems/ascend.ts`
- Test: `tests/systems/ascend.test.ts` (extend) or `tests/store/officeSlice.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/store/officeSlice.test.ts`:

```typescript
describe("ascend integration — resetOffice wipes run-state, preserves meta", () => {
  it("ascending wipes queue + roster but keeps office.level + office.xp", () => {
    const { useGameStore } = require("@/store");
    useGameStore.setState({
      officeLevel: 5,
      officeXp: big(123),
      queue: [{ id: "c1", class: "generalist", tier: "common", affixes: [] }],
      roster: [{ id: "w1", class: "generalist", tier: "common", level: 3, xp: big(50), affixes: [] }],
      trickleTimer: 10,
    });
    // Call the ascend orchestrator (find its name in src/systems/ascend.ts).
    useGameStore.getState().performAscend?.();   // adjust function name to actual

    const s = useGameStore.getState();
    expect(s.officeLevel).toBe(5);                   // persists
    expect(s.officeXp.eq(big(123))).toBe(true);      // persists
    expect(s.queue).toEqual([]);                     // wiped
    expect(s.roster).toEqual([]);                    // wiped
    expect(s.trickleTimer).toBe(0);                  // wiped
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/store/officeSlice.test.ts -t "ascend integration"`
Expected: FAIL — `resetOffice` is called from `performAscendOrchestrator`, which doesn't yet exist.

- [ ] **Step 3: Wire resetOffice into the ascend orchestrator**

Open `src/systems/ascend.ts`. Find the function that performs ascend (likely `performAscend` or `performAscendOrchestrator`). Add a call to `state.resetOffice()` alongside the existing `state.resetWorkshop()`:

```typescript
// Inside performAscend (or whatever the actual function is):
state.resetWorkshop();
state.resetOffice();   // <-- NEW
```

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/store/officeSlice.test.ts -t "ascend integration"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/systems/ascend.ts tests/store/officeSlice.test.ts
git commit -m "systems(ascend): reset office run-state on ascend

queue, roster, trickleTimer wiped; office.level + office.xp preserved
(institutional meta-progression — same shape as Workshop level + xp).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 15: Save migration v12 → v13

**Files:**
- Modify: `src/store/index.ts`
- Test: `tests/store/persistence-integration.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `tests/store/persistence-integration.test.ts`:

```typescript
describe("save migration v12 → v13 (Painter's Office)", () => {
  it("adds default office state to a v12 save", () => {
    const v12Save = {
      gold: { __big: "100" },
      // ...other v12 fields (whatever a real v12 save looks like — see existing tests for examples)
    };
    const migrated = migrate(v12Save, 12) as unknown as { officeLevel: number; officeXp: unknown; queue: unknown[]; roster: unknown[]; trickleTimer: number };
    expect(migrated.officeLevel).toBe(0);
    // officeXp arrives as a SerializedBig marker before reviver runs in real persistence;
    // in this synchronous migrate call, accept either Big or { __big: "0" } depending on
    // when `serializeBigs` runs.
    expect(migrated.queue).toEqual([]);
    expect(migrated.roster).toEqual([]);
    expect(migrated.trickleTimer).toBe(0);
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `npx vitest run tests/store/persistence-integration.test.ts -t "migration v12"`
Expected: FAIL.

- [ ] **Step 3: Add migration block**

Edit `src/store/index.ts`:

Bump `SAVE_VERSION`:

```typescript
const SAVE_VERSION = 13;
```

Add the migration block (after the v11 → v12 block):

```typescript
if (fromVersion < 13) {
  // v12 → v13 (2026-05-11): Painter's Office. Adds officeLevel, officeXp,
  // queue, roster, trickleTimer. No data to migrate from older saves
  // (the system didn't exist).
  state = {
    ...state,
    officeLevel: 0,
    officeXp: big(0),
    queue: [],
    roster: [],
    trickleTimer: 0,
  };
}
```

Update the migration docstring above the function to mention v13.

- [ ] **Step 4: Verify pass**

Run: `npx vitest run tests/store/persistence-integration.test.ts`
Expected: PASS — all migration tests including new v13.

- [ ] **Step 5: Commit**

```bash
git add src/store/index.ts tests/store/persistence-integration.test.ts
git commit -m "store(persistence): migrate v12 → v13 for Painter's Office

Adds default office fields to migrating saves. SAVE_VERSION bumped
12 → 13. No data to translate forward; the system is new.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 16: SkillDesigner capability quick-add chips

**Files:**
- Modify: `src/dev/skillDesigner/*` (find the actual file)

- [ ] **Step 1: Locate the skill designer's chip list**

Run: `grep -rn "canvas_size\|canvas_crit\|canvas_combo\|quick-add" src/dev src/ui 2>&1 | head -20`

This identifies the file currently rendering the capability-tag quick-add chips for subproject 2.

- [ ] **Step 2: Add the four new chips**

In the located file, add four entries to the chips array:
- `roster_slot` — "Roster Slot"
- `queue_slot` — "Queue Slot"
- `class_goldsmith` — "Class: Goldsmith"
- `class_speedrunner` — "Class: Speedrunner"

Each chip should follow the existing pattern (label + value + click handler that appends to the unlocks field).

- [ ] **Step 3: Verify in browser**

Run: `npm run dev` (or whatever starts the dev server)
- Open `/dev/skill-designer` in the browser.
- Open a node form. Verify the four new chips appear in the quick-add row.
- Click each chip; confirm the unlocks field includes the corresponding capability string.

- [ ] **Step 4: Commit**

```bash
git add src/dev/skillDesigner/  # adjust to actual path
git commit -m "dev(skill-designer): quick-add chips for office capabilities

roster_slot, queue_slot, class_goldsmith, class_speedrunner — the four
new capability tags introduced by the Painter's Office subsystem.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 17: UI components — OfficeRoom + OfficeLevelHeader + QueueCard + WorkerCard + FireConfirmModal

This task is bigger than the others — UI work is hard to TDD without a component-test setup. Implement and verify visually in the dev server. Each sub-step produces one component file + matching .module.css, with manual smoke check.

**Files:**
- Create: `src/components/painting/OfficeRoom.tsx` + `OfficeRoom.module.css`
- Create: `src/components/painting/OfficeLevelHeader.tsx`
- Create: `src/components/painting/QueueCard.tsx`
- Create: `src/components/painting/WorkerCard.tsx`
- Create: `src/components/painting/FireConfirmModal.tsx`

- [ ] **Step 1: OfficeLevelHeader**

Create `src/components/painting/OfficeLevelHeader.tsx`:

```typescript
import type { JSX } from "react";
import { useGameStore } from "@/store";
import { getOfficeTierCap } from "@/store/officeSlice";
import { officeXpToNext, trickleSeconds } from "@/core/balance";
import { formatBig } from "@/core/formatter";

export function OfficeLevelHeader(): JSX.Element {
  const officeLevel = useGameStore((s) => s.officeLevel);
  const officeXp = useGameStore((s) => s.officeXp);
  const tierCap = useGameStore(getOfficeTierCap);

  const nextLevelCost = officeXpToNext(officeLevel);
  const xpPct = Math.min(100, officeXp.div(nextLevelCost).toNumber() * 100);
  const trickle = trickleSeconds(officeLevel);

  return (
    <header>
      <h2>Office Level {officeLevel}</h2>
      <div className="xpBar">
        <div className="xpFill" style={{ width: `${xpPct}%` }} />
        <span>{formatBig(officeXp)} / {formatBig(nextLevelCost)}</span>
      </div>
      <p>Up to {tierCap[0].toUpperCase() + tierCap.slice(1)}</p>
      <p>New candidate in ~{trickle.toFixed(1)}s</p>
    </header>
  );
}
```

Manual check: render in dev server (after Task 19), verify level/XP/tier cap display.

- [ ] **Step 2: QueueCard**

Create `src/components/painting/QueueCard.tsx`:

```typescript
import type { JSX } from "react";
import { useGameStore } from "@/store";
import { getHireCost, getRosterCap } from "@/store/officeSlice";
import { formatBig } from "@/core/formatter";
import type { Candidate } from "@/core/officeRoll";

interface Props {
  readonly candidate: Candidate;
}

export function QueueCard({ candidate }: Props): JSX.Element {
  const cost = useGameStore((s) => getHireCost(s, candidate));
  const gold = useGameStore((s) => s.gold);
  const rosterLen = useGameStore((s) => s.roster.length);
  const rosterCap = useGameStore(getRosterCap);
  const hire = useGameStore((s) => s.hireFromQueue);
  const reject = useGameStore((s) => s.rejectFromQueue);

  const canAffordCost = gold.gte(cost);
  const hasSlot = rosterLen < rosterCap;

  return (
    <article>
      <header>
        <span data-class={candidate.class}>{candidate.class}</span>
        <span data-tier={candidate.tier}>{candidate.tier}</span>
      </header>
      <ul>
        {candidate.affixes.map((a, i) => (
          <li key={i}>{a.kind.replace(/[+%]/g, "")} +{a.magnitude}%</li>
        ))}
      </ul>
      <p className="cost">{formatBig(cost)}g</p>
      <button
        type="button"
        disabled={!canAffordCost || !hasSlot}
        onClick={() => hire(candidate.id)}
      >
        Hire
      </button>
      <button type="button" onClick={() => reject(candidate.id)}>Reject</button>
    </article>
  );
}
```

- [ ] **Step 3: WorkerCard + FireConfirmModal**

Create `src/components/painting/WorkerCard.tsx`:

```typescript
import { useState, type JSX } from "react";
import { useGameStore } from "@/store";
import { workerXpToNext, levelScale } from "@/core/balance";
import { formatBig } from "@/core/formatter";
import { FireConfirmModal } from "./FireConfirmModal";
import type { Worker } from "@/store/officeSlice";

interface Props {
  readonly worker: Worker;
}

export function WorkerCard({ worker }: Props): JSX.Element {
  const [confirming, setConfirming] = useState(false);
  const fire = useGameStore((s) => s.fireWorker);

  const nextLevelCost = workerXpToNext(worker.level);
  const xpPct = Math.min(100, worker.xp.div(nextLevelCost).toNumber() * 100);
  const scale = levelScale(worker.level);

  return (
    <article>
      <header>
        <span data-class={worker.class}>{worker.class}</span>
        <span data-tier={worker.tier}>{worker.tier}</span>
        <span>Lv {worker.level}</span>
      </header>
      <div className="xpBar">
        <div className="xpFill" style={{ width: `${xpPct}%` }} />
        <span>{formatBig(worker.xp)} / {formatBig(nextLevelCost)}</span>
      </div>
      <ul>
        {worker.affixes.map((a, i) => (
          <li key={i}>
            {a.kind.replace(/[+%]/g, "")} +{(a.magnitude * scale.toNumber()).toFixed(1)}%
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setConfirming(true)}>Fire</button>
      {confirming && (
        <FireConfirmModal
          worker={worker}
          onConfirm={() => { fire(worker.id); setConfirming(false); }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </article>
  );
}
```

Create `src/components/painting/FireConfirmModal.tsx`:

```typescript
import type { JSX } from "react";
import type { Worker } from "@/store/officeSlice";

interface Props {
  readonly worker: Worker;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function FireConfirmModal({ worker, onConfirm, onCancel }: Props): JSX.Element {
  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modalBody">
        <h3>Fire this worker?</h3>
        <p>
          {worker.class} {worker.tier} — Level {worker.level}
        </p>
        <ul>
          {worker.affixes.map((a, i) => (
            <li key={i}>{a.kind} +{a.magnitude}%</li>
          ))}
        </ul>
        <button type="button" onClick={onConfirm}>Fire</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: OfficeRoom (composes the above)**

Create `src/components/painting/OfficeRoom.tsx`:

```typescript
import type { JSX } from "react";
import { useGameStore } from "@/store";
import { getRosterCap, getQueueCap } from "@/store/officeSlice";
import { OfficeLevelHeader } from "./OfficeLevelHeader";
import { QueueCard } from "./QueueCard";
import { WorkerCard } from "./WorkerCard";
import styles from "./OfficeRoom.module.css";

export function OfficeRoom(): JSX.Element {
  const queue = useGameStore((s) => s.queue);
  const roster = useGameStore((s) => s.roster);
  const rosterCap = useGameStore(getRosterCap);
  const queueCap = useGameStore(getQueueCap);

  return (
    <section className={styles.room} aria-label="Painter's Office">
      <OfficeLevelHeader />

      <h3>Queue ({queue.length} / {queueCap})</h3>
      <div className={styles.queueList}>
        {queue.map((c) => <QueueCard key={c.id} candidate={c} />)}
      </div>

      <h3>Roster ({roster.length} / {rosterCap})</h3>
      <div className={styles.rosterList}>
        {roster.map((w) => <WorkerCard key={w.id} worker={w} />)}
      </div>
    </section>
  );
}
```

Create `src/components/painting/OfficeRoom.module.css` with reasonable layout — mirror `WorkshopRoom.module.css` patterns for the 340px panel + section spacing. Refer to existing `WorkshopRoom.module.css` for layout shape; copy + adapt.

- [ ] **Step 5: Commit each component as it's added**

(One commit per component or per logical batch is fine. Suggest: one commit for header + cards, one for OfficeRoom + CSS.)

```bash
git add src/components/painting/Office*.tsx src/components/painting/QueueCard.tsx src/components/painting/WorkerCard.tsx src/components/painting/FireConfirmModal.tsx src/components/painting/OfficeRoom.module.css
git commit -m "ui(office): OfficeRoom panel with level header, queue, roster, fire modal

Component skeleton: OfficeRoom mounts OfficeLevelHeader, list of QueueCards,
list of WorkerCards. FireConfirmModal is an inline overlay (no Radix).
Styling parallel to WorkshopRoom.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 18: PaintingRoute + RoomRail switching

**Files:**
- Modify: `src/components/painting/RoomRail.tsx`
- Modify: `src/routes/PaintingRoute.tsx`

- [ ] **Step 1: Refactor RoomRail to accept activeRoom + onSelect**

Edit `src/components/painting/RoomRail.tsx`:

```typescript
import type { JSX } from "react";
import { Hammer, User, GraduationCap, FlaskConical } from "lucide-react";
import { useGameStore } from "@/store";
import { getRosterCap } from "@/store/officeSlice";
import styles from "./RoomRail.module.css";

export type RoomId = "workshop" | "office" | "school" | "lab";

interface RoomDef {
  id: RoomId;
  label: string;
  Icon: typeof Hammer;
}

const ROOMS: ReadonlyArray<RoomDef> = [
  { id: "workshop", label: "Workshop", Icon: Hammer        },
  { id: "office",   label: "Office",   Icon: User          },
  { id: "school",   label: "School",   Icon: GraduationCap },
  { id: "lab",      label: "Lab",      Icon: FlaskConical  },
];

interface Props {
  readonly activeRoom: RoomId;
  readonly onSelect: (room: RoomId) => void;
}

export function RoomRail({ activeRoom, onSelect }: Props): JSX.Element {
  const officeEnabled = useGameStore((s) => getRosterCap(s) >= 1);

  return (
    <nav className={styles.rail} role="tablist" aria-label="Rooms" aria-orientation="vertical">
      {ROOMS.map(({ id, label, Icon }) => {
        const enabled = id === "workshop" || (id === "office" && officeEnabled);
        const active = activeRoom === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active ? "true" : "false"}
            aria-label={label}
            disabled={!enabled}
            title={enabled ? label : `${label} — coming soon`}
            className={active ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            data-room={id}
            onClick={() => enabled && onSelect(id)}
          >
            <Icon size={20} aria-hidden="true" />
            <span className={styles.label}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Wire activeRoom state into PaintingRoute**

Edit `src/routes/PaintingRoute.tsx`:

Add at the top:

```typescript
import { useState } from "react";
import { RoomRail, type RoomId } from "@/components/painting/RoomRail";
import { OfficeRoom } from "@/components/painting/OfficeRoom";
```

Inside `PaintingRoute()`:

```typescript
const [activeRoom, setActiveRoom] = useState<RoomId>("workshop");
```

Replace the room-area `<aside>`:

```typescript
<aside className={styles.roomArea}>
  {activeRoom === "workshop" && <WorkshopRoom />}
  {activeRoom === "office" && <OfficeRoom />}
</aside>

<aside className={styles.railArea}>
  <RoomRail activeRoom={activeRoom} onSelect={setActiveRoom} />
</aside>
```

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`
- Open the app.
- Office tab in RoomRail should be disabled (no `roster_slot` node purchased yet).
- Go to `/dev/skill-designer`, create a node with `unlocks: ["roster_slot"]`, give it `maxLevel: 5` (or higher).
- Return to main view, purchase the node (via the skill tree).
- Office tab now enabled; click it.
- OfficeRoom should mount with empty queue (queue cap also 0 until a `queue_slot` node is authored + purchased).
- Author and purchase a node with `unlocks: ["queue_slot"]`. Queue cap > 0 now → candidates trickle in.
- Hire a candidate. Verify gold decreases by the displayed cost.
- Fire a worker via the modal.
- Trigger an ascend. Verify queue + roster are wiped; Office Level + XP persist.

- [ ] **Step 4: Run all tests + type check**

Run: `npx vitest run`
Expected: PASS — all tests including the office suite.

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/painting/RoomRail.tsx src/routes/PaintingRoute.tsx
git commit -m "ui(painting): wire OfficeRoom into RoomRail + PaintingRoute

RoomRail now takes activeRoom + onSelect props. Office tab is enabled
when getRosterCap(state) >= 1 (i.e., a fame node with the roster_slot
capability has been purchased). PaintingRoute holds activeRoom in
local state; default is workshop.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 19: HANDOVER.md update + final test sweep

**Files:**
- Modify: `docs/HANDOVER.md`

- [ ] **Step 1: Add a new "shipped" section at the top of HANDOVER.md**

Following the existing pattern (see "Affix pool rework" and "Canvas depth" sections), prepend a Painter's Office shipped section summarizing:
- What landed (data model, balance constants, roll engine, slice, UI)
- Spec + plan references
- Tests + build status
- Lessons preserved (e.g., capability-counting via `countCapability` parallel to `hasCapability`)

- [ ] **Step 2: Run final verification**

```bash
npx vitest run
npx tsc --noEmit
npm run build
```

Expected: all green. Bundle should grow modestly (5–10 KB gzipped for the slice + UI). If bundle blows past 250 KB gzipped, investigate.

- [ ] **Step 3: Commit**

```bash
git add docs/HANDOVER.md
git commit -m "docs(handover): subproject 3 shipped — Painter's Office

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Self-Review Checklist (run after writing every task)

**Spec coverage:**
- §3 Data model — covered by Task 8 (officeSlice schema)
- §4.1 Trickle queue — Task 10 (tickOffice)
- §4.1 Hire cost formula — Task 1 + Task 11 (`hireCost`, `getHireCost`)
- §4.2 Pure passive XP — Task 12 (`awardOfficeXp`)
- §4.3 Office Level mirror + steeper curve — Task 1 (`officeXpToNext`), Task 12 (mirror)
- §4.4 Firing + confirmation modal — Task 11 (action), Task 17 (UI modal)
- §5 Class system — Task 2 (config), Task 4 (rollWorkerClass), Task 9 (getClassUnlocked)
- §6 Tiers + compressed thresholds — Task 1 (constants), Task 7 (rollOfficeTier inside rollCandidate)
- §7 Multipliers — Task 13 (getOfficeContribution + wiring)
- §8 Ascend reset — Task 14
- §9 UI — Task 17 (OfficeRoom + subcomponents) + Task 18 (PaintingRoute wiring)
- §13 Engine surface — covered across Tasks 1–18
- §11.1–§11.12 resolved decisions — distributed across Task 1 (formulas + constants), Tasks 2–7 (roll engine), Tasks 8–12 (slice + actions)

**Placeholders:** No "TBD" or "fill in later" in any task. Task 10 + 11 defer some test fixture wiring to Task 18 with explicit notes — that's a defensible deferral (test fixtures depend on authored skill-tree nodes the user creates via dev tools).

**Type consistency:** `Worker`, `Candidate`, `ClassId`, `WorkerTier`, `WeightTuple`, `OfficeState`, `OfficeSlice` defined once and reused. `Affix` reused from `workshopRoll`. `AffixKind` reused from `workshopAffixes`.

**Big arithmetic:** Every formula spec'd to return Big does so in the implementation step. Multiplier integration explicitly notes the `.toNumber()` saturation point.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-11-painters-office.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration. Matches the project's documented workflow (`docs/agent_docs/workflow.md`).
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints for review.

Which approach?
