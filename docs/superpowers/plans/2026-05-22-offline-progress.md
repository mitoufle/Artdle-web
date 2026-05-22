# Offline Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the game persistent across page reloads — on load, simulate the elapsed time tick-by-tick against a clone of the rehydrated state, then apply the result. UX is silent (≤ 5s), toast (≤ 2h), or full loading scene + modal (> 2h).

**Architecture:** Refactor each game tick into a pure `(draft, delta) => void` form that mutates a draft state object instead of calling Zustand setters. A new `runCatchupSimulation` function clones the rehydrated state, runs the six pure ticks in a chunked async loop with adaptive delta, applies the final state in one `setState`, then evaluates achievements once. The Bootstrap component branches into the appropriate UX state based on elapsed time before mounting `<Game />`.

**Tech Stack:** TypeScript strict, Zustand 5 + persist middleware, Vitest, React 19, Motion (existing toast pattern), `break_eternity.js` (Big), `idb-keyval`.

**Spec:** `docs/superpowers/specs/2026-05-22-offline-progress-design.md`

---

## Phase 0 — Audit (already done, baked into Phase 1 tasks)

The six tick bodies were audited before writing this plan. Findings inlined per Phase 1 task:

| Tick | Cross-slice calls inlined |
|---|---|
| `treeTick` | `state.add("inspiration", g)`, `state.trackInspirationGain(g)`, `get().growSapling()` |
| `canvasTick` | `add("gold", g)`, `trackSaleGold(g)`, `awardOfficeXp(g)`, `incrementStat(ns, k, n)`, `patchRunStats(p)`, `evaluateAchievements()` (skipped during sim) |
| `skillTreeTick` | `add("inspiration", g)`, `trackInspirationGain(g)` |
| `workshopTick` | `performCraft(state, set, get)` — needs `performCraftPure` |
| `tickOffice` | None (pure already, just uses `set`) |
| `schoolTick` | `incrementStat(ns, k)`, `evaluateAchievements()` (skipped during sim) |

Helpers to inline as pure functions: `addCurrency`, `spendCurrency`, `incrementStatPure`, `patchRunStatsPure`, `trackSaleGoldPure`, `trackInspirationGainPure`, `awardOfficeXpPure`. All live in a new `src/core/pureMutations.ts`.

---

## Phase 1 — Pure tick refactor (6 tasks)

### Task 1: Helpers + treeTickPure

**Files:**
- Create: `src/core/pureMutations.ts`
- Create: `tests/core/pureMutations.test.ts`
- Create: `src/core/treeTickPure.ts`
- Create: `tests/core/treeTickPure.test.ts`
- Modify: `src/store/treeSlice.ts` (treeTick becomes wrapper)

- [ ] **Step 1: Write failing test for `addCurrency` and `spendCurrency`**

```ts
// tests/core/pureMutations.test.ts
import { describe, expect, it } from "vitest";
import { addCurrency, spendCurrency } from "@/core/pureMutations";
import { big } from "@/core/bigNumber";

describe("addCurrency", () => {
  it("adds positive amount", () => {
    const draft = { gold: big(10), inspiration: big(0), fame: big(0) } as any;
    addCurrency(draft, "gold", big(5));
    expect(draft.gold.toNumber()).toBe(15);
  });
  it("refuses negative", () => {
    const draft = { gold: big(10) } as any;
    addCurrency(draft, "gold", big(-5));
    expect(draft.gold.toNumber()).toBe(10);
  });
});

describe("spendCurrency", () => {
  it("subtracts and returns true on sufficient", () => {
    const draft = { gold: big(10) } as any;
    expect(spendCurrency(draft, "gold", big(3))).toBe(true);
    expect(draft.gold.toNumber()).toBe(7);
  });
  it("returns false and leaves balance on insufficient", () => {
    const draft = { gold: big(2) } as any;
    expect(spendCurrency(draft, "gold", big(5))).toBe(false);
    expect(draft.gold.toNumber()).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/pureMutations.test.ts`
Expected: FAIL — `addCurrency` not exported.

- [ ] **Step 3: Implement `src/core/pureMutations.ts`**

```ts
import { type Big } from "@/core/bigNumber";
import type { GameStore } from "@/store";
import type { CurrencyKey } from "@/store/currencySlice";
import type { StatsLifetime, StatsRun } from "@/store/statsSlice";

/** Mutable view of GameStore for draft mutations during simulation. */
export type Mutable<T> = { -readonly [K in keyof T]: T[K] };
export type DraftState = Mutable<GameStore>;

export function addCurrency(draft: DraftState, key: CurrencyKey, amount: Big): void {
  if (amount.lt(0)) return;
  draft[key] = draft[key].add(amount);
}

export function spendCurrency(draft: DraftState, key: CurrencyKey, amount: Big): boolean {
  if (draft[key].lt(amount)) return false;
  draft[key] = draft[key].sub(amount);
  return true;
}

export function trackSaleGoldPure(draft: DraftState, saleGold: Big): void {
  draft.lifetimeGold = draft.lifetimeGold.add(saleGold);
}

export function trackInspirationGainPure(draft: DraftState, amount: Big): void {
  draft.lifetimeInspiration = draft.lifetimeInspiration.add(amount);
}

export function incrementStatPure(
  draft: DraftState,
  namespace: "lifetime" | "run",
  key: string,
  by = 1,
): void {
  if (namespace === "lifetime") {
    const rec = draft.statsLifetime as unknown as Record<string, number>;
    const prev = rec[key] ?? 0;
    draft.statsLifetime = { ...draft.statsLifetime, [key]: prev + by } as StatsLifetime;
  } else {
    const rec = draft.statsRun as unknown as Record<string, unknown>;
    const prev = (rec[key] as number | undefined) ?? 0;
    draft.statsRun = { ...draft.statsRun, [key]: prev + by } as StatsRun;
  }
}

export function patchRunStatsPure(draft: DraftState, patch: Partial<StatsRun>): void {
  draft.statsRun = { ...draft.statsRun, ...patch };
}
```

- [ ] **Step 4: Run test — should pass**

Run: `npm test -- tests/core/pureMutations.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing test for `treeTickPure`**

```ts
// tests/core/treeTickPure.test.ts
import { describe, expect, it } from "vitest";
import { treeTickPure } from "@/core/treeTickPure";
import { big } from "@/core/bigNumber";
import { useGameStore } from "@/store";

describe("treeTickPure", () => {
  it("no-op on delta=0", () => {
    const draft = { ...useGameStore.getState() } as any;
    const before = { ...draft };
    treeTickPure(draft, 0);
    expect(draft.inspiration.toNumber()).toBe(before.inspiration.toNumber());
  });

  it("credits inspiration for producing parts", () => {
    const draft = {
      ...useGameStore.getState(),
      currentStage: 0,
      partLevels: { tinysprout_roots: 5 },
      inspiration: big(0),
      lifetimeInspiration: big(0),
    } as any;
    treeTickPure(draft, 1);
    expect(draft.inspiration.gt(0)).toBe(true);
    expect(draft.lifetimeInspiration.eq(draft.inspiration)).toBe(true);
  });

  it("auto-advances stage if threshold met", () => {
    // construct a draft whose totals already qualify for stage 1
    // ... actual part IDs from TREE_STAGES[0] with enough levels to cross threshold
    const draft = {
      ...useGameStore.getState(),
      currentStage: 0,
      partLevels: makeStage0AtThreshold(),  // helper to be defined in test file
    } as any;
    treeTickPure(draft, 0.001);
    expect(draft.currentStage).toBe(1);
  });
});
```

- [ ] **Step 6: Run test — verify failure**

Run: `npm test -- tests/core/treeTickPure.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement `src/core/treeTickPure.ts`**

Mirrors `treeTick` in `treeSlice.ts:125` but mutates `draft` directly. The `growSapling` loop is inlined as a simple stage increment.

```ts
import { inspiPerSec } from "@/core/balance";
import { big } from "@/core/bigNumber";
import { getInspiMultiplier } from "@/core/multipliers";
import {
  addCurrency,
  trackInspirationGainPure,
  type DraftState,
} from "@/core/pureMutations";
import { TREE_STAGES } from "@/config/treeStages";
import { canGrowSapling, getProducingParts } from "@/store/treeSlice";

const AUTO_GROW_MAX_ITER = 100;

export function treeTickPure(draft: DraftState, deltaSeconds: number): void {
  if (deltaSeconds <= 0) return;
  const producing = getProducingParts(draft);
  if (producing.length > 0) {
    const multiplier = getInspiMultiplier(draft);
    const rate = inspiPerSec(producing, multiplier);
    if (rate.gt(0)) {
      const gain = rate.mul(deltaSeconds);
      addCurrency(draft, "inspiration", gain);
      trackInspirationGainPure(draft, gain);
    }
  }
  for (let i = 0; i < AUTO_GROW_MAX_ITER && canGrowSapling(draft); i++) {
    draft.currentStage = draft.currentStage + 1;
  }
}
```

- [ ] **Step 8: Wrap the slice's `treeTick` around the pure function**

In `src/store/treeSlice.ts:125`, replace the body of `treeTick`:

```ts
import { treeTickPure } from "@/core/treeTickPure";

treeTick: (deltaSeconds) => {
  set((state) => {
    const draft = { ...state } as any;
    treeTickPure(draft, deltaSeconds);
    // Return only the fields treeTickPure can touch (Zustand shallow-merges).
    return {
      currentStage: draft.currentStage,
      inspiration: draft.inspiration,
      lifetimeInspiration: draft.lifetimeInspiration,
    };
  });
},
```

- [ ] **Step 9: Run all tree + tree-tick tests**

Run: `npm test -- tree`
Expected: PASS for both `treeTickPure` and existing `treeSlice` parity tests.

- [ ] **Step 10: Commit**

```bash
git add src/core/pureMutations.ts src/core/treeTickPure.ts tests/core/pureMutations.test.ts tests/core/treeTickPure.test.ts src/store/treeSlice.ts
git commit -m "refactor(tick): extract treeTick + cross-slice mutation helpers as pure draft mutations"
```

---

### Task 2: skillTreeTickPure

Same shape as Task 1. The skill-tree tick is `pokeTree` (timer-based inspiration grants).

**Files:**
- Create: `src/core/skillTreeTickPure.ts`
- Create: `tests/core/skillTreeTickPure.test.ts`
- Modify: `src/store/skillTreeSlice.ts:74`

- [ ] **Step 1: Failing test**

```ts
// tests/core/skillTreeTickPure.test.ts
import { describe, expect, it } from "vitest";
import { skillTreeTickPure } from "@/core/skillTreeTickPure";
import { big } from "@/core/bigNumber";
import { useGameStore } from "@/store";

describe("skillTreeTickPure", () => {
  it("no-op when poke_tree not purchased", () => {
    const draft = { ...useGameStore.getState(), purchasedNodes: {}, pokeTreeTimer: 0 } as any;
    skillTreeTickPure(draft, 60);
    expect(draft.pokeTreeTimer).toBe(0);
  });

  it("grants inspiration when interval crossed at level 1", () => {
    const draft = {
      ...useGameStore.getState(),
      purchasedNodes: { poke_tree: 1 },
      pokeTreeTimer: 0,
      inspiration: big(0),
      lifetimeInspiration: big(0),
    } as any;
    // POKE_TREE_INTERVAL_S × 3 = 3 grants at level 1 (100/grant)
    skillTreeTickPure(draft, 60 * 3 + 1);
    expect(draft.inspiration.toNumber()).toBe(300);
    expect(draft.lifetimeInspiration.toNumber()).toBe(300);
  });
});
```

- [ ] **Step 2: Verify failure** — Run: `npm test -- skillTreeTickPure`. Expected: FAIL.

- [ ] **Step 3: Implement `src/core/skillTreeTickPure.ts`**

```ts
import { big } from "@/core/bigNumber";
import {
  addCurrency,
  trackInspirationGainPure,
  type DraftState,
} from "@/core/pureMutations";
import { POKE_TREE_BASE_INSPI, POKE_TREE_INTERVAL_S } from "@/core/balance";

export function skillTreeTickPure(draft: DraftState, deltaSeconds: number): void {
  if (deltaSeconds <= 0) return;
  const pokeLevel = draft.purchasedNodes.poke_tree ?? 0;
  if (pokeLevel === 0) return;
  const next = draft.pokeTreeTimer + deltaSeconds;
  const grants = Math.floor(next / POKE_TREE_INTERVAL_S);
  if (grants > 0) {
    const inspiPerTick = POKE_TREE_BASE_INSPI * Math.pow(2, pokeLevel - 1);
    const inspiGain = big(inspiPerTick * grants);
    addCurrency(draft, "inspiration", inspiGain);
    trackInspirationGainPure(draft, inspiGain);
  }
  draft.pokeTreeTimer = next - grants * POKE_TREE_INTERVAL_S;
}
```

- [ ] **Step 4: Wrap slice's `skillTreeTick`**

In `src/store/skillTreeSlice.ts:74`:

```ts
import { skillTreeTickPure } from "@/core/skillTreeTickPure";

skillTreeTick: (deltaSeconds) => {
  set((state) => {
    const draft = { ...state } as any;
    skillTreeTickPure(draft, deltaSeconds);
    return {
      pokeTreeTimer: draft.pokeTreeTimer,
      inspiration: draft.inspiration,
      lifetimeInspiration: draft.lifetimeInspiration,
    };
  });
},
```

- [ ] **Step 5: Run tests**

Run: `npm test -- skillTree`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/skillTreeTickPure.ts tests/core/skillTreeTickPure.test.ts src/store/skillTreeSlice.ts
git commit -m "refactor(tick): extract skillTreeTick as pure draft mutation"
```

---

### Task 3: schoolTickPure

**Files:**
- Create: `src/core/schoolTickPure.ts`
- Create: `tests/core/schoolTickPure.test.ts`
- Modify: `src/store/schoolSlice.ts:50`

- [ ] **Step 1: Failing test**

```ts
// tests/core/schoolTickPure.test.ts
import { describe, expect, it } from "vitest";
import { schoolTickPure } from "@/core/schoolTickPure";
import { useGameStore } from "@/store";

describe("schoolTickPure", () => {
  it("no-op when no active research", () => {
    const draft = { ...useGameStore.getState(), activeResearch: null } as any;
    schoolTickPure(draft, 60);
    expect(draft.activeResearch).toBe(null);
  });

  it("decrements remainingSeconds", () => {
    const draft = {
      ...useGameStore.getState(),
      activeResearch: { id: "r1", remainingSeconds: 120 },
    } as any;
    schoolTickPure(draft, 30);
    expect(draft.activeResearch.remainingSeconds).toBe(90);
  });

  it("completes research and bumps stats when remaining hits 0", () => {
    const draft = {
      ...useGameStore.getState(),
      activeResearch: { id: "r1", remainingSeconds: 5 },
      completedResearches: {},
      statsLifetime: { schoolResearchesCompleted: 0 } as any,
      statsRun: { schoolResearchesCompleted: 0 } as any,
    } as any;
    schoolTickPure(draft, 5);
    expect(draft.activeResearch).toBe(null);
    expect(draft.completedResearches.r1).toBe(true);
    expect(draft.statsLifetime.schoolResearchesCompleted).toBe(1);
    expect(draft.statsRun.schoolResearchesCompleted).toBe(1);
  });
});
```

- [ ] **Step 2: Verify failure** — Run: `npm test -- schoolTickPure`. Expected: FAIL.

- [ ] **Step 3: Implement `src/core/schoolTickPure.ts`**

```ts
import { incrementStatPure, type DraftState } from "@/core/pureMutations";

export function schoolTickPure(draft: DraftState, deltaSeconds: number): void {
  if (deltaSeconds <= 0) return;
  if (!draft.activeResearch) return;
  const next = draft.activeResearch.remainingSeconds - deltaSeconds;
  if (next > 0) {
    draft.activeResearch = { ...draft.activeResearch, remainingSeconds: next };
    return;
  }
  draft.completedResearches = { ...draft.completedResearches, [draft.activeResearch.id]: true };
  draft.activeResearch = null;
  incrementStatPure(draft, "lifetime", "schoolResearchesCompleted");
  incrementStatPure(draft, "run", "schoolResearchesCompleted");
}
```

Note: `evaluateAchievements()` is NOT called here — the spec defers evaluation to end-of-sim. The live wrapper below calls it.

- [ ] **Step 4: Wrap slice's `schoolTick`**

In `src/store/schoolSlice.ts:50`:

```ts
import { schoolTickPure } from "@/core/schoolTickPure";

schoolTick: (delta) => {
  const before = get().activeResearch?.id ?? null;
  set((state) => {
    const draft = { ...state } as any;
    schoolTickPure(draft, delta);
    return {
      activeResearch: draft.activeResearch,
      completedResearches: draft.completedResearches,
      statsLifetime: draft.statsLifetime,
      statsRun: draft.statsRun,
    };
  });
  // Fire achievement evaluation only if a research just completed.
  if (before !== null && get().activeResearch === null) {
    get().evaluateAchievements();
  }
},
```

- [ ] **Step 5: Run tests**

Run: `npm test -- school`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/schoolTickPure.ts tests/core/schoolTickPure.test.ts src/store/schoolSlice.ts
git commit -m "refactor(tick): extract schoolTick as pure draft mutation"
```

---

### Task 4: tickOfficePure

**Files:**
- Create: `src/core/officeTickPure.ts`
- Create: `tests/core/officeTickPure.test.ts`
- Modify: `src/store/officeSlice.ts:125`

- [ ] **Step 1: Failing test**

```ts
// tests/core/officeTickPure.test.ts
import { describe, expect, it } from "vitest";
import { officeTickPure } from "@/core/officeTickPure";
import { useGameStore } from "@/store";

describe("officeTickPure", () => {
  it("no-op when queue cap is 0", () => {
    const draft = { ...useGameStore.getState(), purchasedNodes: {} } as any;
    officeTickPure(draft, 600);
    expect(draft.queue.length).toBe(0);
  });

  it("appends candidates when interval crossed", () => {
    const draft = {
      ...useGameStore.getState(),
      purchasedNodes: { office_unlock: 1, queue_size_1: 1, queue_size_2: 1 },
      queue: [],
      trickleTimer: 0,
      officeLevel: 1,
    } as any;
    officeTickPure(draft, 120);  // > one period at officeLevel=1
    expect(draft.queue.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement `src/core/officeTickPure.ts`**

```ts
import { rollCandidate } from "@/systems/officeRoll";
import { getQueueCap, trickleSeconds, type Candidate } from "@/store/officeSlice";
import type { DraftState } from "@/core/pureMutations";

export function officeTickPure(draft: DraftState, delta: number): void {
  if (delta <= 0) return;
  const queueCap = getQueueCap(draft);
  if (queueCap <= 0) return;
  if (draft.queue.length >= queueCap) return;

  const period = trickleSeconds(draft.officeLevel);
  let timer = draft.trickleTimer + delta;
  const newCandidates: Candidate[] = [];
  let queueSize = draft.queue.length;
  while (timer >= period && queueSize < queueCap) {
    timer -= period;
    newCandidates.push(rollCandidate(draft.officeLevel, draft));
    queueSize += 1;
  }
  draft.queue = [...draft.queue, ...newCandidates];
  draft.trickleTimer = timer;
}
```

(Verify `getQueueCap` and `trickleSeconds` are already exported from officeSlice. If not, export them in this task.)

- [ ] **Step 4: Wrap slice's `tickOffice`**

```ts
import { officeTickPure } from "@/core/officeTickPure";

tickOffice: (delta: number) => {
  set((state) => {
    const draft = { ...state } as any;
    officeTickPure(draft, delta);
    return { queue: draft.queue, trickleTimer: draft.trickleTimer };
  });
},
```

- [ ] **Step 5: Run tests** — Run: `npm test -- office`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/officeTickPure.ts tests/core/officeTickPure.test.ts src/store/officeSlice.ts
git commit -m "refactor(tick): extract tickOffice as pure draft mutation"
```

---

### Task 5: canvasTickPure (most complex — multi-sale loop + 6 cross-slice calls)

**Files:**
- Create: `src/core/canvasTickPure.ts`
- Create: `tests/core/canvasTickPure.test.ts`
- Modify: `src/store/canvasSlice.ts:96`
- Modify: `src/core/pureMutations.ts` (add `awardOfficeXpPure`)

- [ ] **Step 1: Add `awardOfficeXpPure` to `pureMutations.ts`**

Mirrors `awardOfficeXp` in `officeSlice.ts:186`. Pure mutation on `draft.roster`, `draft.officeXp`, `draft.officeLevel`.

```ts
// Append to src/core/pureMutations.ts
import { big, type Big } from "@/core/bigNumber";
import {
  XP_GOLD_FRACTION, workerXpToNext, officeXpToNext,
} from "@/core/balance";
import { getWorkerXpMultiplier } from "@/core/multipliers";
import type { Worker } from "@/store/officeSlice";

function applyLevelUpsPure(level: number, xp: Big, xpToNext: (l: number) => Big): { level: number; xp: Big } {
  let l = level;
  let x = xp;
  const MAX = 10_000;
  for (let i = 0; i < MAX; i++) {
    const need = xpToNext(l);
    if (x.lt(need)) return { level: l, xp: x };
    x = x.sub(need);
    l += 1;
  }
  return { level: l, xp: x };
}

export function awardOfficeXpPure(draft: DraftState, goldSold: Big): void {
  const n = draft.roster.length;
  if (n === 0) return;
  const xpMult = getWorkerXpMultiplier(draft);
  const pot = goldSold.mul(XP_GOLD_FRACTION).mul(xpMult);
  if (pot.lte(big(0))) return;
  const share = pot.div(n);
  draft.roster = draft.roster.map((w: Worker) => {
    const lu = applyLevelUpsPure(w.level, w.xp.add(share), workerXpToNext);
    return { ...w, level: lu.level, xp: lu.xp };
  });
  const office = applyLevelUpsPure(draft.officeLevel, draft.officeXp.add(pot), officeXpToNext);
  draft.officeXp = office.xp;
  draft.officeLevel = office.level;
}
```

(If the source `awardOfficeXp` uses helpers not currently exported from balance.ts or multipliers.ts, export them as part of this task.)

- [ ] **Step 2: Failing test for `canvasTickPure`**

```ts
// tests/core/canvasTickPure.test.ts
import { describe, expect, it } from "vitest";
import { canvasTickPure } from "@/core/canvasTickPure";
import { big } from "@/core/bigNumber";
import { useGameStore } from "@/store";

describe("canvasTickPure", () => {
  it("no-op on delta=0", () => {
    const draft = { ...useGameStore.getState() } as any;
    const beforeGold = draft.gold;
    canvasTickPure(draft, 0);
    expect(draft.gold.eq(beforeGold)).toBe(true);
  });

  it("produces a single sale when delta crosses one paint cycle", () => {
    const draft = makeFreshDraft({
      gold: big(0),
      lifetimeGold: big(0),
      sellPriceLevel: 1, speedLevel: 1,
      sizeLevel: 0, critLevel: 0, comboLevel: 0,
    });
    canvasTickPure(draft, /* slightly > 1 paint time */ 100);
    expect(draft.gold.gt(0)).toBe(true);
    expect(draft.statsLifetime.canvasesSold).toBeGreaterThanOrEqual(1);
  });

  it("produces many sales on a large delta (multi-completion)", () => {
    const draft = makeFreshDraft({ critLevel: 0, comboLevel: 0 });
    canvasTickPure(draft, 600);
    expect(draft.statsLifetime.canvasesSold).toBeGreaterThan(1);
  });

  // helper inline in the test file:
  // function makeFreshDraft(overrides): DraftState { ... }
});
```

- [ ] **Step 3: Verify failure**

- [ ] **Step 4: Implement `src/core/canvasTickPure.ts`**

Port from `canvasSlice.ts:96` line-for-line. Replace:
- `state.add("gold", gain)` → `addCurrency(draft, "gold", gain)`
- `state.trackSaleGold(gain)` → `trackSaleGoldPure(draft, gain)`
- `state.awardOfficeXp(gain)` → `awardOfficeXpPure(draft, gain)`
- `state.incrementStat(...)` → `incrementStatPure(draft, ...)`
- `state.patchRunStats(...)` → `patchRunStatsPure(draft, ...)`
- `state.evaluateAchievements()` → **skip** (eval at end-of-sim per spec §7)
- Final `set({...})` → direct field assignments on draft

The whole function body lives in `canvasTickPure.ts`. Show the full ported code:

```ts
import { big, type Big } from "@/core/bigNumber";
import {
  canvasGold, canvasTime,
  CRIT_SPEED_FACTOR, COMBO_DECAY_PER_LINK, comboBonusFactor, comboEffectiveChance,
} from "@/core/balance";
import {
  getCanvasGoldMultiplier, getCanvasSpeedMultiplier, getPmMultiplier,
  getCritChance, getComboBaseChance, getCanvasSize, getComboDecayReduction,
  getCritGoldBonus,
} from "@/core/multipliers";
import { rng } from "@/core/rng";
import {
  addCurrency, trackSaleGoldPure, awardOfficeXpPure,
  incrementStatPure, patchRunStatsPure, type DraftState,
} from "@/core/pureMutations";

const MAX_SALES_PER_TICK = 1000;

export function canvasTickPure(draft: DraftState, deltaSeconds: number): void {
  if (deltaSeconds <= 0) return;

  let progress = draft.canvasProgress;
  let critFlag = draft.isCritThisCanvas;
  let chain = draft.comboChain;
  let lastSaleId = draft.lastSale?.id ?? 0;
  let lastSaleAmount: Big | null = null;

  if (progress === 0) critFlag = rng() < getCritChance(draft);

  let timeBudget = deltaSeconds;
  let sales = 0;
  let localCritStreak = draft.statsRun.currentCritStreak;
  let localMaxCritStreak = draft.statsRun.maxCritStreak;
  let localMaxCombo = draft.statsRun.maxComboChain;
  let critsThisTick = 0;
  let salesThisTick = 0;
  let tickGoldTotal = big(0);

  while (timeBudget > 0 && sales < MAX_SALES_PER_TICK) {
    const size = getCanvasSize(draft);
    const baseTime = canvasTime(size);
    const speedMult = getCanvasSpeedMultiplier(draft);
    const critFactor = critFlag ? CRIT_SPEED_FACTOR : 1;
    const effectiveTime = baseTime / (speedMult * critFactor);

    const remainingForThisCanvas = effectiveTime - progress;
    if (timeBudget < remainingForThisCanvas) {
      progress += timeBudget;
      timeBudget = 0;
      break;
    }
    timeBudget -= remainingForThisCanvas;
    progress = 0;
    sales += 1;

    const critGoldMult = critFlag ? (1 + getCritGoldBonus(draft)) : 1;
    const goldMult = getCanvasGoldMultiplier(draft) * getPmMultiplier(draft) * critGoldMult;
    const baseGold = canvasGold(size, goldMult);
    const gain = baseGold.mul(comboBonusFactor(chain));

    addCurrency(draft, "gold", gain);
    trackSaleGoldPure(draft, gain);
    awardOfficeXpPure(draft, gain);

    salesThisTick += 1;
    tickGoldTotal = tickGoldTotal.add(gain);
    if (critFlag) {
      critsThisTick += 1;
      localCritStreak += 1;
      if (localCritStreak > localMaxCritStreak) localMaxCritStreak = localCritStreak;
    } else {
      localCritStreak = 0;
    }
    if (chain > localMaxCombo) localMaxCombo = chain;

    const baseChance = getComboBaseChance(draft);
    const decay = Math.max(0, COMBO_DECAY_PER_LINK - getComboDecayReduction(draft));
    const effChance = comboEffectiveChance(baseChance, chain, decay);
    chain = (rng() < effChance) ? chain + 1 : 0;

    critFlag = rng() < getCritChance(draft);
    lastSaleId += 1;
    lastSaleAmount = gain;
  }

  if (salesThisTick > 0) {
    incrementStatPure(draft, "lifetime", "canvasesSold", salesThisTick);
    incrementStatPure(draft, "lifetime", "critsLanded", critsThisTick);
    if (localMaxCombo > draft.statsLifetime.maxComboChain) {
      incrementStatPure(draft, "lifetime", "maxComboChain", localMaxCombo - draft.statsLifetime.maxComboChain);
    }
    incrementStatPure(draft, "run", "canvasesSold", salesThisTick);
    incrementStatPure(draft, "run", "critsLanded", critsThisTick);
    patchRunStatsPure(draft, {
      currentCritStreak: localCritStreak,
      maxCritStreak: localMaxCritStreak,
      maxComboChain: localMaxCombo,
      goldEarned: draft.statsRun.goldEarned.add(tickGoldTotal),
    });
  }

  draft.canvasProgress = progress;
  draft.isCritThisCanvas = critFlag;
  draft.comboChain = chain;
  if (lastSaleAmount !== null) {
    draft.lastSale = { id: lastSaleId, amount: lastSaleAmount };
  }
}
```

- [ ] **Step 5: Wrap slice's `canvasTick`**

```ts
import { canvasTickPure } from "@/core/canvasTickPure";

canvasTick: (deltaSeconds) => {
  let fired = false;
  set((state) => {
    const draft = { ...state } as any;
    canvasTickPure(draft, deltaSeconds);
    fired = (draft.statsRun.canvasesSold !== state.statsRun.canvasesSold);
    return {
      canvasProgress: draft.canvasProgress,
      isCritThisCanvas: draft.isCritThisCanvas,
      comboChain: draft.comboChain,
      lastSale: draft.lastSale,
      gold: draft.gold,
      lifetimeGold: draft.lifetimeGold,
      roster: draft.roster,
      officeXp: draft.officeXp,
      officeLevel: draft.officeLevel,
      statsLifetime: draft.statsLifetime,
      statsRun: draft.statsRun,
    };
  });
  if (fired) get().evaluateAchievements();
},
```

- [ ] **Step 6: Run all canvas + multiplier + stats tests**

Run: `npm test -- canvas`
Expected: PASS (existing 776+ tests stay green).

- [ ] **Step 7: Commit**

```bash
git add src/core/canvasTickPure.ts src/core/pureMutations.ts tests/core/canvasTickPure.test.ts src/store/canvasSlice.ts
git commit -m "refactor(tick): extract canvasTick + awardOfficeXp as pure draft mutations"
```

---

### Task 6: workshopTickPure + performCraftPure

**Files:**
- Create: `src/core/workshopTickPure.ts` (includes `performCraftPure`)
- Create: `tests/core/workshopTickPure.test.ts`
- Modify: `src/store/workshopSlice.ts:321`

- [ ] **Step 1: Failing test**

```ts
// tests/core/workshopTickPure.test.ts
import { describe, expect, it } from "vitest";
import { workshopTickPure } from "@/core/workshopTickPure";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

describe("workshopTickPure", () => {
  it("no-op when taylorism not purchased", () => {
    const draft = { ...useGameStore.getState(), purchasedNodes: {}, autoCraftTimer: 0 } as any;
    workshopTickPure(draft, 60);
    expect(draft.autoCraftTimer).toBe(0);
    expect(draft.inventory.length).toBe(0);
  });

  it("no-op when autoCraft disabled", () => {
    const draft = {
      ...useGameStore.getState(),
      purchasedNodes: { taylorsim: 1 },
      autoCraftEnabled: false,
    } as any;
    workshopTickPure(draft, 60);
    expect(draft.inventory.length).toBe(0);
  });

  it("crafts items when interval crosses and gold suffices", () => {
    const draft = {
      ...useGameStore.getState(),
      purchasedNodes: { taylorsim: 1, painters_hat: 1 }, // unlocks slots
      autoCraftEnabled: true,
      autoCraftTimer: 0,
      gold: big(1_000_000),
      inventory: [],
      equipped: {},
      protectedTiers: {},
    } as any;
    workshopTickPure(draft, 60); // 6 intervals at default
    expect(draft.inventory.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement `src/core/workshopTickPure.ts`**

`performCraftPure` is a port of `performCraft` (workshopSlice.ts:166) using `spendCurrency` and direct field writes. Skip the `evaluateAchievements()` call (deferred to end-of-sim).

```ts
import {
  TAYLORISM_INTERVAL_S, THIRD_HAND_INTERVAL_REDUCTION,
  craftCost, MAX_WORKSHOP_LEVEL, xpToNext,
} from "@/core/balance";
import { getNodeLevel } from "@/store/skillTreeSlice";
import {
  getUnlockedSlotKinds, getMaxInventorySlots,
  TIER_XP, nextItemId, type Item,
} from "@/store/workshopSlice";
import { rollTier, rollAffixes } from "@/systems/workshopRoll";
import {
  getAffixMagnitudeBonus, getSchoolAffixMagnitudeMultiplier,
} from "@/core/multipliers";
import { rngPick } from "@/core/rng";
import {
  spendCurrency, incrementStatPure, type DraftState,
} from "@/core/pureMutations";

export function performCraftPure(draft: DraftState): boolean {
  const cap = getMaxInventorySlots(draft);
  const hasShredder = getNodeLevel(draft, "shredder") > 0;
  if (draft.inventory.length >= cap) {
    if (!hasShredder) return false;
    if (draft.inventory.every((i) => draft.protectedTiers[i.tier])) return false;
  }
  const cost = craftCost(draft.workshopLevel);
  if (!spendCurrency(draft, "gold", cost)) return false;

  const unlocked = getUnlockedSlotKinds(draft);
  const slot = rngPick(unlocked);
  const tier = rollTier(draft.workshopLevel);
  const affixes = rollAffixes(tier, draft, getAffixMagnitudeBonus(draft), getSchoolAffixMagnitudeMultiplier(draft));
  const item: Item = { id: nextItemId(), slot, tier, affixes, fuseCount: 0 };

  let newLevel = draft.workshopLevel;
  let newXp = draft.workshopXp + TIER_XP[item.tier];
  while (newLevel < MAX_WORKSHOP_LEVEL && newXp >= xpToNext(newLevel)) {
    newXp -= xpToNext(newLevel);
    newLevel += 1;
  }
  draft.workshopLevel = newLevel;
  draft.workshopXp = newXp;
  if (draft.inventory.length >= cap) {
    const kickIdx = draft.inventory.findIndex((i) => !draft.protectedTiers[i.tier]);
    if (kickIdx === -1) return true; // workshopLevel/Xp still applied
    const trimmed = [
      ...draft.inventory.slice(0, kickIdx),
      ...draft.inventory.slice(kickIdx + 1),
    ];
    draft.inventory = [...trimmed, item];
  } else {
    draft.inventory = [...draft.inventory, item];
  }
  incrementStatPure(draft, "lifetime", "workshopItemsCrafted");
  incrementStatPure(draft, "run", "workshopItemsCrafted");
  return true;
}

export function workshopTickPure(draft: DraftState, deltaSeconds: number): void {
  if (deltaSeconds <= 0) return;
  const taylorismLevel = getNodeLevel(draft, "taylorsim");
  if (taylorismLevel === 0) return;
  if (!draft.autoCraftEnabled) return;
  const thirdHandLevel = getNodeLevel(draft, "third_hand");
  const interval = TAYLORISM_INTERVAL_S * (1 - THIRD_HAND_INTERVAL_REDUCTION * thirdHandLevel);
  const next = draft.autoCraftTimer + deltaSeconds;
  const grants = Math.floor(next / interval);
  if (grants > 0) {
    for (let i = 0; i < grants; i++) {
      if (!performCraftPure(draft)) break;
    }
  }
  draft.autoCraftTimer = next - grants * interval;
}
```

(If `nextItemId` and `TIER_XP` are not currently exported from workshopSlice, export them in this task.)

- [ ] **Step 4: Wrap slice's `workshopTick` and `craft`**

The wrapper for `craft` reuses `performCraftPure`:

```ts
import { workshopTickPure, performCraftPure } from "@/core/workshopTickPure";

// replace existing performCraft body with a wrapper using performCraftPure
function performCraft(state, set, get): boolean {
  let ok = false;
  set((s) => {
    const draft = { ...s } as any;
    ok = performCraftPure(draft);
    return ok ? {
      gold: draft.gold,
      inventory: draft.inventory,
      workshopLevel: draft.workshopLevel,
      workshopXp: draft.workshopXp,
      statsLifetime: draft.statsLifetime,
      statsRun: draft.statsRun,
    } : {};
  });
  if (ok) get().evaluateAchievements();
  return ok;
}

// workshopTick:
workshopTick: (deltaSeconds) => {
  let crafted = false;
  set((state) => {
    const before = state.inventory.length;
    const draft = { ...state } as any;
    workshopTickPure(draft, deltaSeconds);
    crafted = draft.inventory.length !== before;
    return {
      autoCraftTimer: draft.autoCraftTimer,
      gold: draft.gold,
      inventory: draft.inventory,
      workshopLevel: draft.workshopLevel,
      workshopXp: draft.workshopXp,
      statsLifetime: draft.statsLifetime,
      statsRun: draft.statsRun,
    };
  });
  if (crafted) get().evaluateAchievements();
},
```

- [ ] **Step 5: Run all workshop tests**

Run: `npm test -- workshop`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/workshopTickPure.ts tests/core/workshopTickPure.test.ts src/store/workshopSlice.ts
git commit -m "refactor(tick): extract workshopTick + performCraft as pure draft mutations"
```

---

## Phase 2 — `lastSeen` plumbing

### Task 7: Add `lastSeen` to metaSlice + migration v19 → v20

**Files:**
- Modify: `src/store/metaSlice.ts` (add `lastSeen`)
- Modify: `src/store/index.ts` (SAVE_VERSION bump + migration)
- Modify: `tests/store/metaSlice.test.ts`
- Modify: `tests/integration/persistence.test.ts` (if any version assertion present)

- [ ] **Step 1: Write failing test for migration**

```ts
// tests/store/metaSlice.test.ts (add to existing file)
import { migrate } from "@/store";  // export migrate from store/index.ts if not already

describe("save migration v19 → v20", () => {
  it("seeds lastSeen with Date.now() for pre-v20 saves", () => {
    const fakeNow = 1_700_000_000_000;
    const realNow = Date.now;
    Date.now = () => fakeNow;
    try {
      const result = migrate({ /* ...v19 state without lastSeen... */ }, 19);
      expect(result.lastSeen).toBe(fakeNow);
    } finally {
      Date.now = realNow;
    }
  });
});
```

- [ ] **Step 2: Verify failure** — Run: `npm test -- metaSlice`. Expected: FAIL.

- [ ] **Step 3: Add `lastSeen` to `MetaSlice`**

In `src/store/metaSlice.ts`:

```ts
export interface MetaSlice {
  playerId: string;
  ascendCount: number;
  pastRuns: ReadonlyArray<PastRun>;
  /** Epoch ms of last save flush (visibilitychange/beforeunload/heartbeat). */
  lastSeen: number;
  // ... existing actions
}

export const createMetaSlice: StateCreator<GameStore, [], [], MetaSlice> = (set, get) => ({
  playerId: newPlayerId(),
  ascendCount: 0,
  pastRuns: [],
  lastSeen: Date.now(),
  // ... existing actions unchanged
});
```

- [ ] **Step 4: Bump SAVE_VERSION + migration**

In `src/store/index.ts`:

```ts
const SAVE_VERSION = 20;

// In the migrate function, append:
if (fromVersion < 20) {
  state.lastSeen = Date.now();
}
```

Also: extend the migration's documentation comment block (top of file) with a v19 → v20 entry.

- [ ] **Step 5: Run tests** — Run: `npm test -- metaSlice`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/store/metaSlice.ts src/store/index.ts tests/store/metaSlice.test.ts
git commit -m "feat(save): add lastSeen timestamp to metaSlice (SAVE_VERSION 19 → 20)"
```

---

### Task 8: Lifecycle hooks update `lastSeen` on hide/unload

**Files:**
- Modify: `src/systems/lifecycle.ts`
- Modify: `tests/systems/lifecycle.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/systems/lifecycle.test.ts (extend existing)
import { defaultLifecycleHooks } from "@/systems/lifecycle";
import { useGameStore } from "@/store";

it("onHide writes lastSeen before flush", () => {
  const fakeNow = 1_700_000_999_999;
  const realNow = Date.now;
  Date.now = () => fakeNow;
  try {
    useGameStore.setState({ lastSeen: 0 } as any);
    defaultLifecycleHooks.onHide();
    expect(useGameStore.getState().lastSeen).toBe(fakeNow);
  } finally {
    Date.now = realNow;
  }
});

it("onUnload writes lastSeen before flush", () => { /* same shape */ });
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement** — In `src/systems/lifecycle.ts`:

```ts
import { useGameStore } from "@/store";

export const defaultLifecycleHooks: LifecycleHooks = {
  onHide: (): void => {
    useGameStore.setState({ lastSeen: Date.now() } as any);
    pauseTickLoop();
    void persistedAdapter.flush().catch((err: unknown) =>
      reportError(err as Error, "persist.flush.visibilitychange"),
    );
  },
  onShow: (): void => {
    resumeTickLoop();
  },
  onUnload: (): void => {
    useGameStore.setState({ lastSeen: Date.now() } as any);
    void persistedAdapter.flush().catch((err: unknown) =>
      reportError(err as Error, "persist.flush.beforeunload"),
    );
  },
};
```

- [ ] **Step 4: Run tests** — Run: `npm test -- lifecycle`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/systems/lifecycle.ts tests/systems/lifecycle.test.ts
git commit -m "feat(lifecycle): write lastSeen on hide and unload"
```

---

### Task 9: 10-second heartbeat in `tickAll`

**Files:**
- Modify: `src/store/index.ts` (tickAll)
- Create: `tests/store/lastSeenHeartbeat.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/store/lastSeenHeartbeat.test.ts
import { describe, expect, it } from "vitest";
import { useGameStore } from "@/store";

describe("lastSeen heartbeat", () => {
  it("updates lastSeen every ~10 simulated seconds in tickAll", () => {
    const fakeNow = 1_700_001_000_000;
    Date.now = () => fakeNow;
    useGameStore.setState({ lastSeen: 0 } as any);
    // 5 second tick — should NOT update yet
    useGameStore.getState().tickAll(5);
    expect(useGameStore.getState().lastSeen).toBe(0);
    // 6 more seconds — accumulator crosses 10s
    useGameStore.getState().tickAll(6);
    expect(useGameStore.getState().lastSeen).toBe(fakeNow);
  });
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement** — In `src/store/index.ts` near `tickAll`:

```ts
// Module-level accumulator (resets when lastSeen flushes)
let _heartbeatAccum = 0;
const HEARTBEAT_INTERVAL_S = 10;

// Inside tickAll, after the six tick calls:
tickAll: (deltaSeconds: number) => {
  const s = get();
  s.treeTick(deltaSeconds);
  s.canvasTick(deltaSeconds);
  s.skillTreeTick(deltaSeconds);
  s.workshopTick(deltaSeconds);
  s.tickOffice(deltaSeconds);
  s.schoolTick(deltaSeconds);
  _heartbeatAccum += deltaSeconds;
  if (_heartbeatAccum >= HEARTBEAT_INTERVAL_S) {
    _heartbeatAccum = 0;
    set({ lastSeen: Date.now() });
  }
},
```

- [ ] **Step 4: Run tests** — Run: `npm test -- lastSeen`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/index.ts tests/store/lastSeenHeartbeat.test.ts
git commit -m "feat(tick): 10s lastSeen heartbeat in tickAll"
```

---

## Phase 3 — Clone helper

### Task 10: `cloneGameState` + tests

**Files:**
- Create: `src/systems/catchupClone.ts`
- Create: `tests/systems/catchupClone.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/systems/catchupClone.test.ts
import { describe, expect, it } from "vitest";
import { cloneGameState } from "@/systems/catchupClone";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

describe("cloneGameState", () => {
  it("mutating clone.gold does not affect source", () => {
    const src = useGameStore.getState();
    const clone = cloneGameState(src);
    clone.gold = clone.gold.add(big(100));
    expect(src.gold.eq(clone.gold)).toBe(false);
  });

  it("mutating clone.partLevels does not affect source", () => {
    const src = { ...useGameStore.getState(), partLevels: { p1: 5 } } as any;
    const clone = cloneGameState(src);
    clone.partLevels.p1 = 99;
    expect(src.partLevels.p1).toBe(5);
  });

  it("mutating clone.inventory item affixes does not affect source", () => {
    const src = {
      ...useGameStore.getState(),
      inventory: [{ id: "i1", slot: "brush", tier: "normal", affixes: [{ kind: "$", magnitude: 10 }], fuseCount: 0 }],
    } as any;
    const clone = cloneGameState(src);
    clone.inventory[0].affixes[0].magnitude = 999;
    expect((src.inventory[0] as any).affixes[0].magnitude).toBe(10);
  });

  it("mutating clone.completedAchievements does not affect source", () => {
    const src = { ...useGameStore.getState(), completedAchievements: { a1: true as const } } as any;
    const clone = cloneGameState(src);
    clone.completedAchievements.a2 = true;
    expect((src.completedAchievements as any).a2).toBeUndefined();
  });

  it("clone.gold.add() returns a new Big without mutating source", () => {
    const src = { ...useGameStore.getState(), gold: big(100) } as any;
    const clone = cloneGameState(src);
    const next = clone.gold.add(big(50));
    expect(src.gold.toNumber()).toBe(100);
    expect(next.toNumber()).toBe(150);
  });
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement `src/systems/catchupClone.ts`**

Per spec §5, concrete rules per field type. Big is immutable (break_eternity's `add`/`sub` return new instances), so it can be shared by reference.

```ts
import type { GameStore } from "@/store";
import type { DraftState } from "@/core/pureMutations";

/**
 * Shallow-clone the GameStore for the catch-up simulation. Per spec §5:
 * - Primitives / Big / Date: copy by value or share reference (Big is immutable)
 * - Records: { ...obj }
 * - Arrays of items: deep-clone items + their affix array (the only mutable
 *   nested array in the store)
 * - Maps: not currently used in any slice — if added later, extend here
 * - Configs / static IDs: share reference (immutable by convention)
 */
export function cloneGameState(state: GameStore): DraftState {
  return {
    ...state,
    partLevels: { ...state.partLevels },
    purchasedNodes: { ...state.purchasedNodes },
    protectedTiers: { ...state.protectedTiers } as Record<string, boolean>,
    completedResearches: { ...state.completedResearches },
    examsPassed: { ...state.examsPassed },
    completedAchievements: { ...state.completedAchievements },
    statsLifetime: { ...state.statsLifetime },
    statsRun: { ...state.statsRun },
    pastRuns: state.pastRuns,            // ReadonlyArray — never mutated by ticks
    inventory: state.inventory.map((i) => ({ ...i, affixes: [...i.affixes] })),
    equipped: Object.fromEntries(
      Object.entries(state.equipped).map(([k, v]) => [k, { ...v, affixes: [...v.affixes] }]),
    ) as typeof state.equipped,
    queue: state.queue.map((c) => ({ ...c, affixes: [...c.affixes] })),
    roster: state.roster.map((w) => ({ ...w, affixes: w.affixes })),  // worker.affixes is ReadonlyArray, shared
    activeResearch: state.activeResearch ? { ...state.activeResearch } : null,
    lastSale: state.lastSale ? { ...state.lastSale } : null,
    notificationQueue: [...state.notificationQueue],
  } as DraftState;
}
```

- [ ] **Step 4: Run tests** — Run: `npm test -- catchupClone`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/systems/catchupClone.ts tests/systems/catchupClone.test.ts
git commit -m "feat(catchup): cloneGameState for simulation drafts"
```

---

## Phase 4 — Simulation engine

### Task 11: `runCatchupSimulation` + tests

**Files:**
- Create: `src/systems/catchup.ts`
- Create: `tests/systems/catchup.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/systems/catchup.test.ts
import { describe, expect, it, vi } from "vitest";
import { runCatchupSimulation, chooseDelta } from "@/systems/catchup";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

describe("chooseDelta", () => {
  it("returns 0.1 for < 30 min", () => expect(chooseDelta(60)).toBe(0.1));
  it("returns 1 for 30min – 1h", () => expect(chooseDelta(2000)).toBe(1));
  it("returns 10 for 1h – 1d", () => expect(chooseDelta(10_000)).toBe(10));
  it("returns 60 for >= 1d", () => expect(chooseDelta(100_000)).toBe(60));
});

describe("runCatchupSimulation", () => {
  it("no-op on elapsed = 0", async () => {
    const gold = useGameStore.getState().gold;
    const result = await runCatchupSimulation(0, () => {});
    expect(result.elapsedSeconds).toBe(0);
    expect(useGameStore.getState().gold.eq(gold)).toBe(true);
  });

  it("clamps negative elapsed to 0", async () => {
    const result = await runCatchupSimulation(-100, () => {});
    expect(result.elapsedSeconds).toBe(0);
  });

  it("credits inspiration over 1h for a producing tree", async () => {
    useGameStore.setState({
      currentStage: 0,
      partLevels: { tinysprout_roots: 5 },  // actual stage-0 part ID
      inspiration: big(0),
    } as any);
    const result = await runCatchupSimulation(3600, () => {});
    expect(result.inspiGained.gt(0)).toBe(true);
    expect(useGameStore.getState().inspiration.gt(0)).toBe(true);
  });

  it("calls onProgress monotonically from 0 to 1", async () => {
    const pcts: number[] = [];
    await runCatchupSimulation(3600, (p) => pcts.push(p));
    expect(pcts.length).toBeGreaterThan(0);
    for (let i = 1; i < pcts.length; i++) {
      expect(pcts[i]).toBeGreaterThanOrEqual(pcts[i-1]);
    }
    expect(pcts[pcts.length-1]).toBeCloseTo(1, 2);
  });

  it("does not mutate store mid-simulation", async () => {
    const goldBefore = useGameStore.getState().gold;
    let goldMidSim: any = null;
    await runCatchupSimulation(3600, (p) => {
      if (p > 0.2 && p < 0.8 && goldMidSim === null) {
        goldMidSim = useGameStore.getState().gold;
      }
    });
    if (goldMidSim) expect(goldMidSim.eq(goldBefore)).toBe(true);
  });
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement `src/systems/catchup.ts`**

```ts
import type { Big } from "@/core/bigNumber";
import { useGameStore } from "@/store";
import { cloneGameState } from "@/systems/catchupClone";
import { treeTickPure } from "@/core/treeTickPure";
import { canvasTickPure } from "@/core/canvasTickPure";
import { skillTreeTickPure } from "@/core/skillTreeTickPure";
import { workshopTickPure } from "@/core/workshopTickPure";
import { officeTickPure } from "@/core/officeTickPure";
import { schoolTickPure } from "@/core/schoolTickPure";

export interface CatchupResult {
  elapsedSeconds: number;
  goldGained: Big;
  inspiGained: Big;
  canvasesSold: number;
  itemsCrafted: number;
  paintMasteryGained: Big;
  achievementsUnlocked: string[];
}

const BATCH_SIZE = 200;

export function chooseDelta(elapsedSeconds: number): number {
  if (elapsedSeconds < 30 * 60) return 0.1;
  if (elapsedSeconds < 60 * 60) return 1;
  if (elapsedSeconds < 24 * 60 * 60) return 10;
  return 60;
}

function yieldToBrowser(): Promise<void> {
  return new Promise((res) => setTimeout(res, 0));
}

export async function runCatchupSimulation(
  elapsedSeconds: number,
  onProgress: (pct: number) => void,
): Promise<CatchupResult> {
  const clampedElapsed = Math.max(0, elapsedSeconds);
  const baseline = useGameStore.getState();

  if (clampedElapsed === 0) {
    return emptyResult(0);
  }

  const draft = cloneGameState(baseline);
  const delta = chooseDelta(clampedElapsed);
  let simulated = 0;

  while (simulated < clampedElapsed) {
    for (let i = 0; i < BATCH_SIZE && simulated < clampedElapsed; i++) {
      const step = Math.min(delta, clampedElapsed - simulated);
      treeTickPure(draft, step);
      canvasTickPure(draft, step);
      skillTreeTickPure(draft, step);
      workshopTickPure(draft, step);
      officeTickPure(draft, step);
      schoolTickPure(draft, step);
      simulated += step;
    }
    onProgress(simulated / clampedElapsed);
    await yieldToBrowser();
  }

  // Evaluate achievements once over the final draft. The achievement engine
  // expects to read from the live store, so we apply the draft *before*
  // calling evaluate. Notifications it pushes will queue and display after the
  // catch-up UI dismisses.
  useGameStore.setState(draft as any);
  const beforeAchCount = Object.keys(baseline.completedAchievements).length;
  useGameStore.getState().evaluateAchievements();
  const afterCompleted = useGameStore.getState().completedAchievements;
  const newlyUnlocked = Object.keys(afterCompleted).filter(
    (id) => !(id in baseline.completedAchievements),
  );

  return {
    elapsedSeconds: clampedElapsed,
    goldGained: draft.gold.sub(baseline.gold),
    inspiGained: draft.inspiration.sub(baseline.inspiration),
    canvasesSold: draft.statsRun.canvasesSold - baseline.statsRun.canvasesSold,
    itemsCrafted: draft.statsRun.workshopItemsCrafted - baseline.statsRun.workshopItemsCrafted,
    paintMasteryGained: useGameStore.getState().paintMastery.sub(baseline.paintMastery),
    achievementsUnlocked: newlyUnlocked,
  };
}

function emptyResult(elapsed: number): CatchupResult {
  const s = useGameStore.getState();
  return {
    elapsedSeconds: elapsed,
    goldGained: s.gold.sub(s.gold),   // big(0)
    inspiGained: s.inspiration.sub(s.inspiration),
    canvasesSold: 0,
    itemsCrafted: 0,
    paintMasteryGained: s.paintMastery.sub(s.paintMastery),
    achievementsUnlocked: [],
  };
}
```

- [ ] **Step 4: Run tests** — Run: `npm test -- catchup`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/systems/catchup.ts tests/systems/catchup.test.ts
git commit -m "feat(catchup): runCatchupSimulation engine with adaptive delta"
```

---

### Task 12: Bot convergence test

**Files:**
- Modify: `tests/integration/bot-simulation.test.ts`

- [ ] **Step 1: Add a new test case to the existing file**

```ts
// tests/integration/bot-simulation.test.ts (add after existing tests)
import { runCatchupSimulation } from "@/systems/catchup";

it("catch-up simulation converges with live tick over 1h", async () => {
  // 1. Save initial state
  const initial = cloneInitialBotState();
  // 2. Run live ticks for 3600 simulated seconds
  setupStoreFromState(initial);
  for (let s = 0; s < 3600; s++) useGameStore.getState().tickAll(1);
  const liveResult = snapshotEconomy(useGameStore.getState());
  // 3. Restart from same initial state, run catch-up sim for 3600s
  setupStoreFromState(initial);
  await runCatchupSimulation(3600, () => {});
  const simResult = snapshotEconomy(useGameStore.getState());
  // 4. Compare with tolerance — RNG drift over 3600 cycles allows ±5%
  expect(simResult.gold.toNumber()).toBeCloseTo(liveResult.gold.toNumber(), -2); // within 1% of magnitude
  expect(simResult.inspiration.toNumber()).toBeCloseTo(liveResult.inspiration.toNumber(), -2);
  expect(Math.abs(simResult.canvasesSold - liveResult.canvasesSold)).toBeLessThan(liveResult.canvasesSold * 0.05);
}, /* timeout */ 60_000);

// helpers `cloneInitialBotState`, `setupStoreFromState`, `snapshotEconomy`
// to be added in the same file
```

- [ ] **Step 2: Run** — Run: `npm test -- bot-simulation`. Expected: PASS (or skip with clear log if RNG drift exceeds tolerance, then tighten the test).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/bot-simulation.test.ts
git commit -m "test(catchup): convergence between live ticks and catchup simulation over 1h"
```

---

## Phase 5 — UI components

### Task 13: `CatchupToast` component

**Files:**
- Create: `src/components/catchup/CatchupToast.tsx`
- Create: `src/components/catchup/CatchupToast.module.css`
- Create: `tests/components/CatchupToast.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
// tests/components/CatchupToast.test.tsx
import { render, screen } from "@testing-library/react";
import { CatchupToast } from "@/components/catchup/CatchupToast";
import { big } from "@/core/bigNumber";

describe("CatchupToast", () => {
  it("renders elapsed time + gold + inspi + canvases", () => {
    render(
      <CatchupToast
        result={{
          elapsedSeconds: 720,  // 12 min
          goldGained: big(1230),
          inspiGained: big(450),
          canvasesSold: 14,
          itemsCrafted: 0,
          paintMasteryGained: big(0),
          achievementsUnlocked: [],
        }}
        onDismiss={() => {}}
      />
    );
    expect(screen.getByText(/12 min/)).toBeInTheDocument();
    expect(screen.getByText(/14 canvases/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement**

```tsx
// src/components/catchup/CatchupToast.tsx
import { useEffect } from "react";
import { motion } from "motion/react";
import { formatBig } from "@/core/formatter";
import { formatElapsed } from "@/core/formatElapsed";  // new utility (see below)
import type { CatchupResult } from "@/systems/catchup";
import styles from "./CatchupToast.module.css";

const HOLD_MS = 6000;

export function CatchupToast({
  result,
  onDismiss,
}: {
  result: CatchupResult;
  onDismiss: () => void;
}): JSX.Element {
  useEffect(() => {
    const t = setTimeout(onDismiss, HOLD_MS);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      className={styles.toast}
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      transition={{ type: "spring", stiffness: 250, damping: 28 }}
    >
      <div className={styles.title}>⏱ Welcome back ({formatElapsed(result.elapsedSeconds)} away)</div>
      <div className={styles.body}>
        +{formatBig(result.goldGained)} gold · +{formatBig(result.inspiGained)} inspi · {result.canvasesSold} canvases
      </div>
    </motion.div>
  );
}
```

Add `src/core/formatElapsed.ts`:

```ts
export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds/60)} min`;
  if (seconds < 86400) {
    const h = Math.floor(seconds/3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}min`;
  }
  const d = Math.floor(seconds/86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return `${d}d ${h}h`;
}
```

CSS module (mirrors `AchievementToast.module.css` palette — same right-anchored fixed position):

```css
/* src/components/catchup/CatchupToast.module.css */
.toast {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 9000;
  min-width: 280px;
  padding: 12px 16px;
  background: var(--bg-stone-d);
  border: 2px solid var(--ink-2);
  border-radius: 6px;
  color: var(--ink-1);
  font-family: var(--mono);
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}
.title { font-weight: bold; margin-bottom: 6px; font-size: 14px; }
.body { font-size: 12px; color: var(--ink-2); }
@media (prefers-reduced-motion: reduce) {
  .toast { transition: none !important; }
}
```

- [ ] **Step 4: Run tests** — Run: `npm test -- CatchupToast`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/catchup/CatchupToast.tsx src/components/catchup/CatchupToast.module.css src/core/formatElapsed.ts tests/components/CatchupToast.test.tsx
git commit -m "feat(catchup): CatchupToast component for short-absence summary"
```

---

### Task 14: `CatchupLoadingScene` component

**Files:**
- Create: `src/components/catchup/CatchupLoadingScene.tsx`
- Create: `src/components/catchup/CatchupLoadingScene.module.css`
- Create: `tests/components/CatchupLoadingScene.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { CatchupLoadingScene } from "@/components/catchup/CatchupLoadingScene";

describe("CatchupLoadingScene", () => {
  it("renders elapsed time and progress bar", () => {
    render(<CatchupLoadingScene elapsedSeconds={4*3600+23*60} progress={0.68} />);
    expect(screen.getByText(/4h 23min/)).toBeInTheDocument();
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("68");
  });
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement**

```tsx
// src/components/catchup/CatchupLoadingScene.tsx
import { formatElapsed } from "@/core/formatElapsed";
import styles from "./CatchupLoadingScene.module.css";

export function CatchupLoadingScene({
  elapsedSeconds,
  progress,
}: {
  elapsedSeconds: number;
  progress: number;
}): JSX.Element {
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <div className={styles.scene}>
      <div className={styles.title}>Catching up on {formatElapsed(elapsedSeconds)} away…</div>
      <div
        className={styles.barOuter}
        role="progressbar"
        aria-valuenow={Math.round(pct * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={styles.barInner} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}
```

```css
/* src/components/catchup/CatchupLoadingScene.module.css */
.scene {
  position: fixed; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: linear-gradient(180deg, var(--bg-stone-d) 0%, #0a0a0e 100%);
  z-index: 10000;
  font-family: var(--mono);
  color: var(--ink-1);
}
.title { font-size: 18px; margin-bottom: 24px; }
.barOuter {
  width: 320px; height: 16px;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--ink-2);
  border-radius: 4px;
  overflow: hidden;
}
.barInner {
  height: 100%;
  background: var(--gold);
  transition: width 120ms linear;
}
@media (prefers-reduced-motion: reduce) {
  .barInner { transition: none; }
}
```

- [ ] **Step 4: Run tests** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/catchup/CatchupLoadingScene.tsx src/components/catchup/CatchupLoadingScene.module.css tests/components/CatchupLoadingScene.test.tsx
git commit -m "feat(catchup): CatchupLoadingScene with progress bar"
```

---

### Task 15: `CatchupRecapModal` component

**Files:**
- Create: `src/components/catchup/CatchupRecapModal.tsx`
- Create: `src/components/catchup/CatchupRecapModal.module.css`
- Create: `tests/components/CatchupRecapModal.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { CatchupRecapModal } from "@/components/catchup/CatchupRecapModal";
import { big } from "@/core/bigNumber";

describe("CatchupRecapModal", () => {
  it("renders all summary fields and calls onContinue", () => {
    const onContinue = vi.fn();
    render(
      <CatchupRecapModal
        result={{
          elapsedSeconds: 4*3600+23*60,
          goldGained: big(12400),
          inspiGained: big(8100),
          canvasesSold: 287,
          itemsCrafted: 3,
          paintMasteryGained: big(24),
          achievementsUnlocked: ["Millionaire", "T3"],
        }}
        onContinue={onContinue}
      />
    );
    expect(screen.getByText(/4h 23min/)).toBeInTheDocument();
    expect(screen.getByText(/287/)).toBeInTheDocument();
    expect(screen.getByText(/Millionaire/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onContinue).toHaveBeenCalled();
  });

  it("omits the achievements section when none unlocked", () => {
    render(
      <CatchupRecapModal
        result={{ elapsedSeconds: 60, goldGained: big(10), inspiGained: big(5), canvasesSold: 1, itemsCrafted: 0, paintMasteryGained: big(0), achievementsUnlocked: [] }}
        onContinue={() => {}}
      />
    );
    expect(screen.queryByText(/unlocked/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement**

```tsx
// src/components/catchup/CatchupRecapModal.tsx
import { formatBig } from "@/core/formatter";
import { formatElapsed } from "@/core/formatElapsed";
import type { CatchupResult } from "@/systems/catchup";
import styles from "./CatchupRecapModal.module.css";

export function CatchupRecapModal({
  result,
  onContinue,
}: {
  result: CatchupResult;
  onContinue: () => void;
}): JSX.Element {
  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        <h2 className={styles.title}>You were away for {formatElapsed(result.elapsedSeconds)}</h2>
        <dl className={styles.stats}>
          <dt>Gold earned</dt><dd>+{formatBig(result.goldGained)}</dd>
          <dt>Inspiration</dt><dd>+{formatBig(result.inspiGained)}</dd>
          <dt>Canvases sold</dt><dd>{result.canvasesSold}</dd>
          <dt>Items crafted</dt><dd>{result.itemsCrafted}</dd>
          <dt>Paint mastery</dt><dd>+{formatBig(result.paintMasteryGained)}</dd>
        </dl>
        {result.achievementsUnlocked.length > 0 && (
          <div className={styles.achievements}>
            <h3>Achievements unlocked:</h3>
            <ul>
              {result.achievementsUnlocked.map((id) => <li key={id}>✦ {id}</li>)}
            </ul>
          </div>
        )}
        <button className={styles.continueBtn} onClick={onContinue}>Continue</button>
      </div>
    </div>
  );
}
```

```css
/* src/components/catchup/CatchupRecapModal.module.css */
.backdrop {
  position: fixed; inset: 0; z-index: 10000;
  background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--mono); color: var(--ink-1);
}
.modal {
  background: var(--bg-stone-d);
  border: 2px solid var(--ink-2);
  border-radius: 6px;
  padding: 24px;
  min-width: 360px;
  max-width: 480px;
}
.title { font-size: 16px; margin: 0 0 16px; text-align: center; }
.stats { display: grid; grid-template-columns: 1fr auto; gap: 6px 16px; margin: 0 0 16px; }
.stats dt { color: var(--ink-2); }
.stats dd { margin: 0; text-align: right; color: var(--gold); }
.achievements { margin: 12px 0; }
.achievements h3 { font-size: 12px; margin: 0 0 6px; color: var(--ink-2); }
.achievements ul { list-style: none; padding: 0; margin: 0; }
.achievements li { padding: 2px 0; }
.continueBtn {
  display: block; margin: 16px auto 0;
  padding: 8px 24px;
  background: var(--gold); color: black; border: none; border-radius: 4px;
  font-family: var(--mono); cursor: pointer;
}
```

- [ ] **Step 4: Run tests** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/catchup/CatchupRecapModal.tsx src/components/catchup/CatchupRecapModal.module.css tests/components/CatchupRecapModal.test.tsx
git commit -m "feat(catchup): CatchupRecapModal with stats and achievement list"
```

---

## Phase 6 — Bootstrap branching

### Task 16: Wire it all together in `Bootstrap`

**Files:**
- Modify: `src/main.tsx`
- Create: `tests/integration/catchupBoot.test.tsx`

- [ ] **Step 1: Failing integration test**

```tsx
// tests/integration/catchupBoot.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The Bootstrap component needs to be exported from main.tsx for testing.
// In step 3 below, refactor main.tsx to export Bootstrap.

describe("Bootstrap catch-up branching", () => {
  it("with elapsed = 1h shows toast then game", async () => {
    seedStoreWithLastSeen(Date.now() - 3600_000);
    render(<Bootstrap />);
    await waitFor(() => expect(screen.getByText(/Welcome back/)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/Welcome back/)).not.toBeInTheDocument(), { timeout: 7000 });
  });

  it("with elapsed = 3h shows loading scene then recap modal then game", async () => {
    seedStoreWithLastSeen(Date.now() - 3*3600_000);
    render(<Bootstrap />);
    expect(screen.getByText(/Catching up/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument(), { timeout: 10000 });
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(screen.queryByText(/Catching up/)).toBeNull());
  });

  it("with elapsed = 2s mounts game directly", () => {
    seedStoreWithLastSeen(Date.now() - 2000);
    render(<Bootstrap />);
    expect(screen.queryByText(/Welcome back/)).toBeNull();
    expect(screen.queryByText(/Catching up/)).toBeNull();
  });

  it("when sim throws, mounts game without catch-up UI", async () => {
    vi.spyOn(catchupModule, "runCatchupSimulation").mockRejectedValueOnce(new Error("boom"));
    seedStoreWithLastSeen(Date.now() - 3*3600_000);
    render(<Bootstrap />);
    await waitFor(() => expect(screen.queryByText(/Catching up/)).toBeNull(), { timeout: 5000 });
  });
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Refactor `src/main.tsx` and implement branching**

```tsx
// src/main.tsx — full file replacement
import { StrictMode, useEffect, useState } from "react";
import type { JSX } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { useGameStore } from "@/store";
import { LoadingScreen } from "@/ui/widgets/LoadingScreen";
import { App } from "@/App";
import { startTickLoop, stopTickLoop } from "@/core/tickLoop";
import { installLifecycle, defaultLifecycleHooks } from "@/systems/lifecycle";
import { big } from "@/core/bigNumber";
import { runCatchupSimulation, type CatchupResult } from "@/systems/catchup";
import { reportError } from "@/systems/telemetry";
import { CatchupToast } from "@/components/catchup/CatchupToast";
import { CatchupLoadingScene } from "@/components/catchup/CatchupLoadingScene";
import { CatchupRecapModal } from "@/components/catchup/CatchupRecapModal";
import "./styles/globals.css";
import "./index.css";

if (import.meta.env.DEV) {
  (window as unknown as { useGameStore: typeof useGameStore; big: typeof big }).useGameStore = useGameStore;
  (window as unknown as { useGameStore: typeof useGameStore; big: typeof big }).big = big;
}

const SILENT_THRESHOLD_S = 5;
const TOAST_THRESHOLD_S = 2 * 3600;

type Phase =
  | { kind: "rehydrating" }
  | { kind: "silent_sim" }
  | { kind: "loading_scene"; elapsed: number; progress: number }
  | { kind: "recap"; result: CatchupResult }
  | { kind: "playing"; toast: CatchupResult | null };

export function Bootstrap(): JSX.Element {
  const [phase, setPhase] = useState<Phase>(() =>
    useGameStore.persist.hasHydrated() ? { kind: "silent_sim" } : { kind: "rehydrating" }
  );

  // Wait for hydration, then enter the appropriate sim phase
  useEffect(() => {
    if (phase.kind !== "rehydrating") return;
    const unsub = useGameStore.persist.onFinishHydration(() => {
      decideEntry();
    });
    return unsub;
  }, [phase.kind]);

  const decideEntry = async (): Promise<void> => {
    const lastSeen = useGameStore.getState().lastSeen;
    const elapsed = Math.max(0, (Date.now() - lastSeen) / 1000);
    if (elapsed <= SILENT_THRESHOLD_S) {
      setPhase({ kind: "playing", toast: null });
      return;
    }
    if (elapsed < TOAST_THRESHOLD_S) {
      setPhase({ kind: "silent_sim" });
      try {
        const result = await runCatchupSimulation(elapsed, () => {});
        setPhase({ kind: "playing", toast: result });
      } catch (err) {
        reportError(err as Error, "catchup.simulation");
        setPhase({ kind: "playing", toast: null });
      }
      return;
    }
    setPhase({ kind: "loading_scene", elapsed, progress: 0 });
    try {
      const result = await runCatchupSimulation(elapsed, (p) => {
        setPhase((cur) => cur.kind === "loading_scene" ? { ...cur, progress: p } : cur);
      });
      setPhase({ kind: "recap", result });
    } catch (err) {
      reportError(err as Error, "catchup.simulation");
      setPhase({ kind: "playing", toast: null });
    }
  };

  // Start tick loop only once we reach "playing"
  useEffect(() => {
    if (phase.kind !== "playing") return;
    startTickLoop((delta) => useGameStore.getState().tickAll(delta));
    return () => stopTickLoop();
  }, [phase.kind]);

  // Single lifecycle install when reaching playing
  useEffect(() => {
    if (phase.kind !== "playing") return;
    return installLifecycle(defaultLifecycleHooks);
  }, [phase.kind]);

  // Retroactive achievement eval was previously here — now happens inside
  // runCatchupSimulation at end-of-sim, OR on the no-catch-up path below.
  useEffect(() => {
    if (phase.kind === "playing") {
      useGameStore.getState().evaluateAchievements();
    }
  }, [phase.kind]);

  if (phase.kind === "rehydrating") return <LoadingScreen />;
  if (phase.kind === "silent_sim") return <LoadingScreen />;
  if (phase.kind === "loading_scene")
    return <CatchupLoadingScene elapsedSeconds={phase.elapsed} progress={phase.progress} />;
  if (phase.kind === "recap")
    return <CatchupRecapModal result={phase.result} onContinue={() => setPhase({ kind: "playing", toast: phase.result })} />;
  return (
    <BrowserRouter>
      <App />
      {phase.toast && <CatchupToast result={phase.toast} onDismiss={() => setPhase({ kind: "playing", toast: null })} />}
    </BrowserRouter>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("#root element not found in index.html");

createRoot(root).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
```

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: ALL tests pass (existing + new). If `Bootstrap` tests fail because of jsdom timer issues, allow `vi.useFakeTimers()` + manual `vi.runAllTimersAsync()` between phases.

- [ ] **Step 5: TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean (no new errors; pre-existing errors in `achievementSlice.ts`, `officeSlice.ts`, `statsSlice.ts`, `bot-simulation.test.ts`, `SchoolDesignerRoute.test.tsx`, `SortableCard.tsx` remain — they were not introduced by this work).

- [ ] **Step 6: Commit**

```bash
git add src/main.tsx tests/integration/catchupBoot.test.tsx
git commit -m "feat(catchup): Bootstrap branching — silent / toast / loading-scene / recap"
```

---

## Phase 7 — Manual browser playtest

### Task 17: Playtest at three elapsed values

- [ ] **Step 1: Start dev server**

Run: `npm run dev -- --port 5173`

- [ ] **Step 2: Test silent (≤ 5s)**

Open browser DevTools console:
```js
// Set lastSeen to 2 seconds ago, then reload
const state = useGameStore.getState();
useGameStore.setState({ lastSeen: Date.now() - 2000 });
location.reload();
```
Expected: game mounts immediately, no toast.

- [ ] **Step 3: Test toast (5s – 2h)**

```js
useGameStore.setState({ lastSeen: Date.now() - 30 * 60 * 1000 });  // 30 min
location.reload();
```
Expected: brief loading, then toast appears top-right with stats matching ~30 min of progression.

- [ ] **Step 4: Test loading scene + modal (> 2h)**

```js
useGameStore.setState({ lastSeen: Date.now() - 6 * 3600 * 1000 });  // 6 hours
location.reload();
```
Expected: full-screen "Catching up on 6h…" with animated progress bar; then recap modal appears; click Continue → game mounts.

- [ ] **Step 5: Test fail-open (sim throws)**

In `src/systems/catchup.ts` temporarily inject `throw new Error("test")` at the top of `runCatchupSimulation`; reload with a 1h elapsed value; verify game mounts directly without catch-up UI; check console for `reportError` log; revert the throw.

- [ ] **Step 6: Test absurd elapsed (1 year)**

```js
useGameStore.setState({ lastSeen: Date.now() - 365 * 24 * 3600 * 1000 });
location.reload();
```
Expected: loading scene with progress bar; sim completes within ~3-5 seconds; recap modal shows massive gains.

- [ ] **Step 7: Deploy to production**

```bash
git push
npx vercel --prod
```
Verify the new bundle by fetching `/assets/index-<hash>.js` from the production URL and grepping for "Welcome back" or "Catching up".

- [ ] **Step 8: Update HANDOVER.md**

Append a new dated section summarizing what shipped (offline progress catch-up), test count delta, and any open follow-ups.

---

## Notes for the implementer

- **Test-first discipline.** Every code change goes red → green → commit. No batch implementations.
- **Pre-existing tsc errors.** The 6 files listed under "Status" in HANDOVER.md (achievementSlice.ts, officeSlice.ts, statsSlice.ts, bot-simulation.test.ts, SchoolDesignerRoute.test.tsx, SortableCard.tsx) have pre-existing errors unrelated to this work. Do not attempt to fix them unless they directly block compilation of new files.
- **Big number care.** `break_eternity.js` is immutable — `.add()` and `.sub()` return new instances. The clone helper does not need to deep-copy Big fields. But if any tick code does `state.gold.x = …` (direct mutation), that's a bug — fix it.
- **Cross-slice helper exports.** Several existing helpers (e.g., `getQueueCap`, `trickleSeconds`, `nextItemId`, `TIER_XP`) may need to be exported from their slice files for use by the pure tick functions. Add the `export` keyword in the same task as the consumer.
- **Don't add the Skip button.** Spec §12 explicitly drops it; YAGNI.
- **Don't catch tab-hide.** Spec §13 documents this intentional asymmetry. Leave `defaultLifecycleHooks.onShow` calling only `resumeTickLoop()`.
- **Heartbeat accumulator is module-level.** In Task 9, `_heartbeatAccum` lives at module scope so it persists across Vitest test cases. Either (a) export a `_resetHeartbeat()` test helper and call it in `beforeEach`, or (b) reset the accumulator at the top of every test that calls `tickAll`. Without this, test order will affect results.
- **Test helpers in Task 1 and Task 12.** A few inline test snippets reference helpers (`makeStage0AtThreshold`, `makeFreshDraft`, `cloneInitialBotState`, `setupStoreFromState`, `snapshotEconomy`) without giving full code — these are intentionally left as "fill in" by the implementer, since they're test scaffolding specific to the existing helpers in `tests/integration/bot-simulation.test.ts`. Read that file before writing them to match the existing pattern.
