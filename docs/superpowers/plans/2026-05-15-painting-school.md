# Painting School Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Painting School — a time-gated research mechanic organized in tiers that grants permanent bonuses, accessed via the right-side room panel.

**Architecture:** New Zustand slice (`schoolSlice`) integrating into the existing `tickAll` loop; config-driven JSON data consumed by a TypeScript module; effects wired into existing multipliers via an additive `getSchoolBonus` helper. UI is a room panel component (`SchoolRoom.tsx`) following the Workshop/Office pattern. A dev designer at `/dev/school-designer` allows authoring research content.

**Tech Stack:** React 19, TypeScript strict, Zustand 5, Vitest, Tailwind 4 CSS Modules, Vite custom middleware plugin.

---

## File Map

**New files:**
- `src/config/schoolResearches.json` — starter content (5 tiers × 3 researches)
- `src/config/schoolResearches.ts` — types + `SCHOOL_TIERS` export
- `src/store/schoolSlice.ts` — Zustand slice (state + actions)
- `src/core/schoolMultipliers.ts` — `getSchoolBonus(state, kind)`
- `src/components/painting/SchoolRoom.tsx` — room panel UI
- `src/components/painting/SchoolRoom.module.css` — panel styles
- `src/dev/school-designer/types.ts` — DesignFile, DesignTier, DesignResearch
- `src/dev/school-designer/storage.ts` — localStorage draft persistence
- `src/dev/school-designer/api.ts` — fetch POST to /api/school-design
- `src/dev/school-designer/useSchoolDesignerState.ts` — state hook
- `src/dev/school-designer/SchoolDesignerRoute.tsx` — dev tool page
- `src/dev/school-designer/SchoolDesignerRoute.module.css` — dev tool styles
- `tests/store/schoolSlice.test.ts`
- `tests/core/schoolMultipliers.test.ts`
- `tests/dev/school-designer/useSchoolDesignerState.test.ts`

**Modified files:**
- `src/store/index.ts` — add SchoolSlice to GameStore; wire createSchoolSlice + schoolTick; bump SAVE_VERSION 16→17; add migration
- `src/core/multipliers.ts` — extend CanvasMultiplierInputs; wire school bonuses into gold/speed/xp multipliers; import getSchoolBonus
- `src/routes/PaintingRoute.tsx` — subscribe to completedResearches; add to helperState; render SchoolRoom
- `src/components/painting/RoomRail.tsx` — gate school tab on `school_access` capability
- `src/config/skillTreeDesign.json` — add `unlock_school` node (parent: fast_learner)
- `vite.config.ts` — add `artdle-school-design-writer` plugin for `/api/school-design`
- `src/App.tsx` — add `/dev/school-designer` route
- `src/dev/skill-designer/SkillDesignerRoute.tsx` — add cross-link to school designer
- `tests/core/multipliers.test.ts` — add `completedResearches: {}` to stubs

---

## Task 1: Config data model

**Files:**
- Create: `src/config/schoolResearches.json`
- Create: `src/config/schoolResearches.ts`

- [ ] **Step 1: Write `schoolResearches.json`**

```json
[
  {
    "tier": 1,
    "label": "Apprenti",
    "examCost": 50,
    "researches": [
      { "id": "color_theory_basics", "name": "Color Theory Basics", "durationSeconds": 300, "effects": [{ "kind": "canvas_gold_pct", "value": 0.15 }] },
      { "id": "brushwork_basics", "name": "Brushwork Basics", "durationSeconds": 240, "effects": [{ "kind": "canvas_gold_pct", "value": 0.10 }] },
      { "id": "light_and_shadow", "name": "Light & Shadow", "durationSeconds": 480, "effects": [{ "kind": "speed_pct", "value": 0.08 }] }
    ]
  },
  {
    "tier": 2,
    "label": "Élève",
    "examCost": 100,
    "researches": [
      { "id": "composition", "name": "Composition", "durationSeconds": 600, "effects": [{ "kind": "canvas_gold_pct", "value": 0.12 }] },
      { "id": "perspective", "name": "Perspective", "durationSeconds": 720, "effects": [{ "kind": "canvas_gold_pct", "value": 0.10 }] },
      { "id": "color_mixing", "name": "Color Mixing", "durationSeconds": 480, "effects": [{ "kind": "speed_pct", "value": 0.07 }] }
    ]
  },
  {
    "tier": 3,
    "label": "Compagnon",
    "examCost": 200,
    "researches": [
      { "id": "anatomy_basics", "name": "Anatomy Basics", "durationSeconds": 900, "effects": [{ "kind": "canvas_gold_pct", "value": 0.15 }] },
      { "id": "still_life_studies", "name": "Still Life Studies", "durationSeconds": 900, "effects": [{ "kind": "speed_pct", "value": 0.12 }] },
      { "id": "texture_techniques", "name": "Texture Techniques", "durationSeconds": 720, "effects": [{ "kind": "worker_xp_pct", "value": 0.10 }] }
    ]
  },
  {
    "tier": 4,
    "label": "Maître",
    "examCost": 400,
    "researches": [
      { "id": "oil_painting", "name": "Oil Painting", "durationSeconds": 1200, "effects": [{ "kind": "canvas_gold_pct", "value": 0.20 }] },
      { "id": "watercolor_mastery", "name": "Watercolor Mastery", "durationSeconds": 1200, "effects": [{ "kind": "speed_pct", "value": 0.15 }] },
      { "id": "portrait_study", "name": "Portrait Study", "durationSeconds": 1500, "effects": [{ "kind": "worker_xp_pct", "value": 0.15 }] }
    ]
  },
  {
    "tier": 5,
    "label": "Expert",
    "examCost": 800,
    "researches": [
      { "id": "master_composition", "name": "Master Composition", "durationSeconds": 1800, "effects": [{ "kind": "canvas_gold_pct", "value": 0.25 }] },
      { "id": "advanced_technique", "name": "Advanced Technique", "durationSeconds": 1800, "effects": [{ "kind": "speed_pct", "value": 0.20 }] },
      { "id": "studio_discipline", "name": "Studio Discipline", "durationSeconds": 2400, "effects": [{ "kind": "worker_xp_pct", "value": 0.20 }] }
    ]
  }
]
```

- [ ] **Step 2: Write `schoolResearches.ts`**

```ts
import rawTiers from "./schoolResearches.json";

export interface SchoolResearchEffect {
  kind: string;
  value: number;
}

export interface SchoolResearch {
  id: string;
  name: string;
  durationSeconds: number;
  effects: ReadonlyArray<SchoolResearchEffect>;
}

export interface SchoolTier {
  tier: number;
  label: string;
  examCost: number;
  researches: ReadonlyArray<SchoolResearch>;
}

export const SCHOOL_TIERS: ReadonlyArray<SchoolTier> = rawTiers as ReadonlyArray<SchoolTier>;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/config/schoolResearches.json src/config/schoolResearches.ts
git commit -m "feat(school): add school researches config (5 tiers × 3 researches)"
```

---

## Task 2: schoolSlice + store wiring

**Files:**
- Create: `src/store/schoolSlice.ts`
- Create: `tests/store/schoolSlice.test.ts`
- Modify: `src/store/index.ts`

- [ ] **Step 1: Write the failing test**

`tests/store/schoolSlice.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { initialSchoolState } from "@/store/schoolSlice";
import { big } from "@/core/bigNumber";

describe("schoolSlice", () => {
  beforeEach(() => {
    useGameStore.setState({
      ...initialSchoolState,
      fame: big(0),
    });
  });

  it("initializes with correct defaults", () => {
    const s = useGameStore.getState();
    expect(s.completedResearches).toEqual({});
    expect(s.currentTier).toBe(1);
    expect(s.activeResearch).toBeNull();
    expect(s.examsPassed).toEqual({});
  });

  it("startResearch sets activeResearch and returns true", () => {
    expect(useGameStore.getState().startResearch("color_theory_basics")).toBe(true);
    const active = useGameStore.getState().activeResearch;
    expect(active).not.toBeNull();
    expect(active?.id).toBe("color_theory_basics");
    expect(active?.remainingSeconds).toBe(300);
  });

  it("startResearch returns false when another research is active", () => {
    useGameStore.getState().startResearch("color_theory_basics");
    expect(useGameStore.getState().startResearch("brushwork_basics")).toBe(false);
  });

  it("startResearch returns false for already completed research", () => {
    useGameStore.setState({ completedResearches: { color_theory_basics: true } });
    expect(useGameStore.getState().startResearch("color_theory_basics")).toBe(false);
  });

  it("startResearch returns false for a research not in currentTier", () => {
    // tier 2 research while currentTier is 1
    expect(useGameStore.getState().startResearch("composition")).toBe(false);
  });

  it("cancelResearch clears activeResearch", () => {
    useGameStore.getState().startResearch("color_theory_basics");
    useGameStore.getState().cancelResearch();
    expect(useGameStore.getState().activeResearch).toBeNull();
  });

  it("schoolTick decrements remainingSeconds", () => {
    useGameStore.getState().startResearch("color_theory_basics"); // 300s
    useGameStore.getState().schoolTick(10);
    expect(useGameStore.getState().activeResearch?.remainingSeconds).toBeCloseTo(290, 1);
  });

  it("schoolTick completes research when timer reaches 0", () => {
    useGameStore.getState().startResearch("color_theory_basics"); // 300s
    useGameStore.getState().schoolTick(300);
    expect(useGameStore.getState().activeResearch).toBeNull();
    expect(useGameStore.getState().completedResearches["color_theory_basics"]).toBe(true);
  });

  it("schoolTick is a no-op when no research is active", () => {
    useGameStore.getState().schoolTick(100);
    expect(useGameStore.getState().activeResearch).toBeNull();
  });

  it("passExam returns false when not all researches in tier are complete", () => {
    useGameStore.setState({ fame: big(1000) });
    expect(useGameStore.getState().passExam()).toBe(false);
  });

  it("passExam returns false when fame is insufficient", () => {
    useGameStore.setState({
      completedResearches: {
        color_theory_basics: true,
        brushwork_basics: true,
        light_and_shadow: true,
      },
      fame: big(0),
    });
    expect(useGameStore.getState().passExam()).toBe(false);
  });

  it("passExam succeeds: deducts fame, increments tier, records examsPassed", () => {
    useGameStore.setState({
      completedResearches: {
        color_theory_basics: true,
        brushwork_basics: true,
        light_and_shadow: true,
      },
      fame: big(100),
    });
    expect(useGameStore.getState().passExam()).toBe(true);
    const s = useGameStore.getState();
    expect(s.currentTier).toBe(2);
    expect(s.examsPassed[1]).toBe(true);
    expect(s.fame.eq(50)).toBe(true); // 100 - 50 = 50
  });

  it("passExam returns false when currentTier is already the last tier", () => {
    useGameStore.setState({
      currentTier: 5,
      completedResearches: {
        master_composition: true,
        advanced_technique: true,
        studio_discipline: true,
      },
      fame: big(10000),
    });
    expect(useGameStore.getState().passExam()).toBe(false);
  });

  it("resetSchool resets to initial state", () => {
    useGameStore.setState({
      completedResearches: { color_theory_basics: true },
      currentTier: 2,
      activeResearch: { id: "x", remainingSeconds: 100 },
      examsPassed: { 1: true },
    });
    useGameStore.getState().resetSchool();
    const s = useGameStore.getState();
    expect(s.completedResearches).toEqual({});
    expect(s.currentTier).toBe(1);
    expect(s.activeResearch).toBeNull();
    expect(s.examsPassed).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/store/schoolSlice.test.ts`
Expected: FAIL with module not found or property errors

- [ ] **Step 3: Create `src/store/schoolSlice.ts`**

```ts
import type { StateCreator } from "zustand";
import { SCHOOL_TIERS } from "@/config/schoolResearches";
import { big } from "@/core/bigNumber";
import type { GameStore } from "@/store";

export interface SchoolState {
  completedResearches: Record<string, true>;
  currentTier: number;
  activeResearch: { id: string; remainingSeconds: number } | null;
  examsPassed: Record<number, true>;
}

export const initialSchoolState: SchoolState = Object.freeze({
  completedResearches: Object.freeze({}) as Record<string, true>,
  currentTier: 1,
  activeResearch: null,
  examsPassed: Object.freeze({}) as Record<number, true>,
}) as SchoolState;

export interface SchoolSlice extends SchoolState {
  startResearch: (id: string) => boolean;
  cancelResearch: () => void;
  schoolTick: (delta: number) => void;
  passExam: () => boolean;
  resetSchool: () => void;
}

export const createSchoolSlice: StateCreator<GameStore, [], [], SchoolSlice> = (set, get) => ({
  ...initialSchoolState,

  startResearch: (id) => {
    const state = get();
    if (state.activeResearch !== null) return false;
    if (state.completedResearches[id]) return false;
    const tierDef = SCHOOL_TIERS.find((t) => t.tier === state.currentTier);
    if (!tierDef) return false;
    const research = tierDef.researches.find((r) => r.id === id);
    if (!research) return false;
    set({ activeResearch: { id, remainingSeconds: research.durationSeconds } });
    return true;
  },

  cancelResearch: () => {
    set({ activeResearch: null });
  },

  schoolTick: (delta) => {
    if (delta <= 0) return;
    const state = get();
    if (!state.activeResearch) return;
    const next = state.activeResearch.remainingSeconds - delta;
    if (next > 0) {
      set({ activeResearch: { ...state.activeResearch, remainingSeconds: next } });
      return;
    }
    set({
      completedResearches: { ...state.completedResearches, [state.activeResearch.id]: true },
      activeResearch: null,
    });
  },

  passExam: () => {
    const state = get();
    const tierDef = SCHOOL_TIERS.find((t) => t.tier === state.currentTier);
    if (!tierDef) return false;
    if (!SCHOOL_TIERS.some((t) => t.tier === state.currentTier + 1)) return false;
    const allComplete = tierDef.researches.every((r) => state.completedResearches[r.id]);
    if (!allComplete) return false;
    const examCost = big(tierDef.examCost);
    if (state.fame.lt(examCost)) return false;
    if (!state.spend("fame", examCost)) return false;
    set({
      examsPassed: { ...state.examsPassed, [state.currentTier]: true },
      currentTier: state.currentTier + 1,
    });
    return true;
  },

  resetSchool: () => {
    set({ ...initialSchoolState });
  },
});
```

- [ ] **Step 4: Wire slice into `src/store/index.ts`**

Add import at the top:
```ts
import { createSchoolSlice, type SchoolSlice } from "./schoolSlice";
```

Extend `GameStore` type:
```ts
export type GameStore =
  & MetaSlice
  & CurrencySlice
  & HoverInfoSlice
  & TreeSlice
  & CanvasSlice
  & OfficeSlice
  & PaintMasterySlice
  & SkillTreeSlice
  & WorkshopSlice
  & SchoolSlice
  & GameTick;
```

Update `SAVE_VERSION`:
```ts
const SAVE_VERSION = 17;
```

Add migration block after the `fromVersion < 16` block:
```ts
if (fromVersion < 17) {
  // v16 → v17 (2026-05-15): Painting School launch. Adds school progression
  // fields. All default to empty — school starts from scratch on first play.
  state = {
    ...state,
    completedResearches: {},
    currentTier: 1,
    activeResearch: null,
    examsPassed: {},
  };
}
```

Wire `createSchoolSlice` into the store creator:
```ts
export const useGameStore = create<GameStore>()(
  persist(
    (set, get, store) => ({
      ...createMetaSlice(set, get, store),
      ...createCurrencySlice(set, get, store),
      ...createHoverInfoSlice(set, get, store),
      ...createTreeSlice(set, get, store),
      ...createCanvasSlice(set, get, store),
      ...createPaintMasterySlice(set, get, store),
      ...createSkillTreeSlice(set, get, store),
      ...createWorkshopSlice(set, get, store),
      ...createOfficeSlice(set, get, store),
      ...createSchoolSlice(set, get, store),
      tickAll: (deltaSeconds: number) => {
        const s = get();
        s.treeTick(deltaSeconds);
        s.canvasTick(deltaSeconds);
        s.skillTreeTick(deltaSeconds);
        s.workshopTick(deltaSeconds);
        s.tickOffice(deltaSeconds);
        s.schoolTick(deltaSeconds);
      },
    }),
    // ... persist config unchanged
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/store/schoolSlice.test.ts`
Expected: all tests PASS

- [ ] **Step 6: Run full suite**

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/store/schoolSlice.ts src/store/index.ts tests/store/schoolSlice.test.ts
git commit -m "feat(school): add schoolSlice, wire into GameStore and tickAll (save v17)"
```

---

## Task 3: schoolMultipliers

**Files:**
- Create: `src/core/schoolMultipliers.ts`
- Create: `tests/core/schoolMultipliers.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/core/schoolMultipliers.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { getSchoolBonus } from "@/core/schoolMultipliers";
import type { GameStore } from "@/store";

describe("getSchoolBonus", () => {
  it("returns 0 when no researches completed", () => {
    const state = { completedResearches: {} } as unknown as GameStore;
    expect(getSchoolBonus(state, "canvas_gold_pct")).toBe(0);
  });

  it("sums value of completed researches matching the kind", () => {
    // color_theory_basics: +0.15 canvas_gold_pct
    // brushwork_basics: +0.10 canvas_gold_pct
    const state = {
      completedResearches: {
        color_theory_basics: true,
        brushwork_basics: true,
      },
    } as unknown as GameStore;
    expect(getSchoolBonus(state, "canvas_gold_pct")).toBeCloseTo(0.25, 5);
  });

  it("ignores completed researches of a different kind", () => {
    // light_and_shadow: +0.08 speed_pct (not canvas_gold_pct)
    const state = {
      completedResearches: { light_and_shadow: true },
    } as unknown as GameStore;
    expect(getSchoolBonus(state, "canvas_gold_pct")).toBe(0);
    expect(getSchoolBonus(state, "speed_pct")).toBeCloseTo(0.08, 5);
  });

  it("sums across tiers", () => {
    // tier 1: color_theory_basics +0.15
    // tier 2: composition +0.12
    const state = {
      completedResearches: {
        color_theory_basics: true,
        composition: true,
      },
    } as unknown as GameStore;
    expect(getSchoolBonus(state, "canvas_gold_pct")).toBeCloseTo(0.27, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/schoolMultipliers.test.ts`
Expected: FAIL with module not found

- [ ] **Step 3: Create `src/core/schoolMultipliers.ts`**

```ts
import { SCHOOL_TIERS } from "@/config/schoolResearches";
import type { GameStore } from "@/store";

export const getSchoolBonus = (
  state: Pick<GameStore, "completedResearches">,
  kind: string,
): number => {
  let total = 0;
  for (const tier of SCHOOL_TIERS) {
    for (const research of tier.researches) {
      if (state.completedResearches[research.id]) {
        for (const effect of research.effects) {
          if (effect.kind === kind) {
            total += effect.value;
          }
        }
      }
    }
  }
  return total;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/schoolMultipliers.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/schoolMultipliers.ts tests/core/schoolMultipliers.test.ts
git commit -m "feat(school): add getSchoolBonus multiplier helper with tests"
```

---

## Task 4: Wire school effects into multipliers

**Files:**
- Modify: `src/core/multipliers.ts`
- Modify: `src/routes/PaintingRoute.tsx`
- Modify: `tests/core/multipliers.test.ts`

- [ ] **Step 1: Update `tests/core/multipliers.test.ts` — add `completedResearches: {}` to stubs**

In the `stub` helper function (around line 19), add `completedResearches: {}`:
```ts
const stub = (over: Partial<GameStore> = {}): GameStore => ({
  purchasedNodes: {},
  equipped: {},
  roster: [],
  sellPriceLevel: 1,
  speedLevel: 1,
  paintMastery: big(0),
  completedResearches: {},
  ...over,
} as GameStore);
```

Also update the `getWorkerXpMultiplier` test at the line with `{ purchasedNodes: { accelerator: 4 } }`:
```ts
const state = { purchasedNodes: { accelerator: 4 }, completedResearches: {} } as unknown as GameStore;
```

- [ ] **Step 2: Run tests to confirm they still pass before touching multipliers**

Run: `npx vitest run tests/core/multipliers.test.ts`
Expected: all PASS (stubs now carry completedResearches)

- [ ] **Step 3: Update `src/core/multipliers.ts`**

Add `getSchoolBonus` import at the top:
```ts
import { getSchoolBonus } from "@/core/schoolMultipliers";
```

Extend `CanvasMultiplierInputs` with `"completedResearches"`:
```ts
export type CanvasMultiplierInputs = Pick<GameStore,
  | "equipped"
  | "roster"
  | "purchasedNodes"
  | "paintMastery"
  | "sellPriceLevel"
  | "speedLevel"
  | "sizeLevel"
  | "critLevel"
  | "comboLevel"
  | "completedResearches"
>;
```

In `getCanvasGoldMultiplier`, add after `bonus += SELL_PRICE_PER_LEVEL * state.sellPriceLevel;`:
```ts
bonus += getSchoolBonus(state, "canvas_gold_pct");
```

In `getCanvasSpeedMultiplier`, add after `bonus += getOfficeContribution(state, "+speed%").toNumber();`:
```ts
bonus += getSchoolBonus(state, "speed_pct");
```

Update `getWorkerXpMultiplier` signature and body:
```ts
export const getWorkerXpMultiplier = (
  state: Pick<GameStore, "purchasedNodes" | "completedResearches">,
): number =>
  1 + countCapability(state, "worker_xp_mult") * 0.10 + getSchoolBonus(state, "worker_xp_pct");
```

- [ ] **Step 4: Update `src/routes/PaintingRoute.tsx`**

Add selector:
```ts
const completedResearches = useGameStore((s) => s.completedResearches);
```

Add to `helperState`:
```ts
const helperState: CanvasMultiplierInputs = {
  equipped, purchasedNodes, paintMastery, roster,
  sellPriceLevel, speedLevel, sizeLevel, critLevel, comboLevel,
  completedResearches,
};
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/multipliers.ts src/routes/PaintingRoute.tsx tests/core/multipliers.test.ts
git commit -m "feat(school): wire school bonus into gold/speed/workerXp multipliers"
```

---

## Task 5: Skill tree node + RoomRail gate

**Files:**
- Modify: `src/config/skillTreeDesign.json`
- Modify: `src/components/painting/RoomRail.tsx`

- [ ] **Step 1: Add `unlock_school` node to `skillTreeDesign.json`**

In the `nodes` array, append after the last existing node (before the closing `]`):
```json
{
  "id": "unlock_school",
  "name": "Painting School",
  "description": "Unlocks the Painting School — research permanent bonuses one at a time.",
  "numericEffect": "",
  "parentIds": ["fast_learner"],
  "stacking": "additive",
  "kind": "major",
  "maxLevel": 1,
  "costs": [100],
  "unlocks": ["school_access"],
  "position": null
}
```

- [ ] **Step 2: Update `src/components/painting/RoomRail.tsx`**

Add import of `countCapability` from skillTreeSlice:
```ts
import { getRosterCap, countCapability } from "@/store/skillTreeSlice";
```

Wait — `countCapability` is exported from `@/store/skillTreeSlice`, but it takes `Pick<GameStore, "purchasedNodes">`. Check the import works. Actually `getRosterCap` is from `officeSlice`. Let me use the correct import:

```ts
import { countCapability } from "@/store/skillTreeSlice";
import { getRosterCap } from "@/store/officeSlice";
```

Add a new selector:
```ts
const schoolEnabled = useGameStore((s) => countCapability(s, "school_access") >= 1);
```

Update the `enabled` line:
```ts
const enabled =
  id === "workshop" ||
  id === "stats" ||
  (id === "office" && officeEnabled) ||
  (id === "school" && schoolEnabled);
```

- [ ] **Step 3: Run full suite**

Run: `npx vitest run`
Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/config/skillTreeDesign.json src/components/painting/RoomRail.tsx
git commit -m "feat(school): add unlock_school skill node and gate RoomRail school tab"
```

---

## Task 6: SchoolRoom UI

**Files:**
- Create: `src/components/painting/SchoolRoom.tsx`
- Create: `src/components/painting/SchoolRoom.module.css`
- Modify: `src/routes/PaintingRoute.tsx`

- [ ] **Step 1: Create `src/components/painting/SchoolRoom.module.css`**

```css
.room {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  height: 100%;
  overflow-y: auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  color: #a78bfa;
  font-weight: bold;
  font-size: 14px;
}

.tierBadge {
  color: #6b7280;
  font-size: 11px;
}

.tierProgress {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tierProgressRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tierLabel {
  color: #c4b5fd;
  font-size: 12px;
}

.tierCount {
  color: #6b7280;
  font-size: 11px;
}

.progressBar {
  background: #1f2937;
  border-radius: 2px;
  height: 4px;
  overflow: hidden;
}

.progressFill {
  height: 100%;
  background: #7c3aed;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.activeCard {
  background: #1c1917;
  border: 1px solid #92400e;
  border-radius: 6px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.activeHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.activeName {
  color: #fbbf24;
  font-weight: bold;
  font-size: 12px;
}

.activeTimer {
  color: #fcd34d;
  font-size: 11px;
}

.activeEffect {
  color: #d97706;
  font-size: 11px;
}

.activeProgressFill {
  height: 100%;
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
  border-radius: 2px;
  transition: width 0.5s linear;
}

.cancelBtn {
  align-self: flex-end;
  background: #374151;
  color: #9ca3af;
  border: none;
  border-radius: 3px;
  padding: 2px 8px;
  font-size: 10px;
  cursor: pointer;
}

.cancelBtn:hover {
  background: #4b5563;
  color: #e5e7eb;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.cardDone {
  background: #064e3b;
  border-radius: 4px;
  padding: 6px;
  cursor: default;
}

.cardActive {
  background: #78350f;
  border: 1px solid #92400e;
  border-radius: 4px;
  padding: 6px;
}

.cardAvailable {
  background: #1f2937;
  border-radius: 4px;
  padding: 6px;
  cursor: pointer;
}

.cardAvailable:hover {
  background: #374151;
  outline: 1px solid #3730a3;
}

.cardName {
  font-size: 11px;
  margin-bottom: 2px;
}

.cardDone .cardName { color: #34d399; }
.cardActive .cardName { color: #fbbf24; }
.cardAvailable .cardName { color: #9ca3af; }

.cardEffect {
  font-size: 10px;
}

.cardDone .cardEffect { color: #059669; }
.cardActive .cardEffect { color: #d97706; }
.cardAvailable .cardEffect { color: #6b7280; }

.cardDuration {
  font-size: 9px;
  color: #4b5563;
  margin-top: 2px;
}

.examGate {
  background: #1f2937;
  border: 1px dashed #4b5563;
  border-radius: 5px;
  padding: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
}

.examTitle {
  color: #6b7280;
  font-size: 11px;
}

.examHint {
  color: #4b5563;
  font-size: 10px;
}

.examBtn {
  background: #374151;
  color: #4b5563;
  border: none;
  border-radius: 3px;
  padding: 4px 10px;
  font-size: 11px;
  cursor: not-allowed;
}

.examBtn:not(:disabled) {
  background: #4c1d95;
  color: #c4b5fd;
  cursor: pointer;
}

.examBtn:not(:disabled):hover {
  background: #5b21b6;
}
```

- [ ] **Step 2: Create `src/components/painting/SchoolRoom.tsx`**

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import { SCHOOL_TIERS } from "@/config/schoolResearches";
import { big } from "@/core/bigNumber";
import styles from "./SchoolRoom.module.css";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds) % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function effectSummary(effects: ReadonlyArray<{ kind: string; value: number }>): string {
  return effects
    .map((e) => `+${(e.value * 100).toFixed(0)}% ${e.kind.replace(/_pct$/, "").replace(/_/g, " ")}`)
    .join(", ");
}

export function SchoolRoom(): JSX.Element {
  const completedResearches = useGameStore((s) => s.completedResearches);
  const currentTier = useGameStore((s) => s.currentTier);
  const activeResearch = useGameStore((s) => s.activeResearch);
  const fame = useGameStore((s) => s.fame);
  const startResearch = useGameStore((s) => s.startResearch);
  const cancelResearch = useGameStore((s) => s.cancelResearch);
  const passExam = useGameStore((s) => s.passExam);
  const pushHoverInfo = useGameStore((s) => s.pushHoverInfo);
  const clearHoverInfo = useGameStore((s) => s.clearHoverInfo);

  const tierDef = SCHOOL_TIERS.find((t) => t.tier === currentTier);
  if (!tierDef) return <div className={styles.room}>School unavailable</div>;

  const totalResearches = tierDef.researches.length;
  const completedCount = tierDef.researches.filter((r) => completedResearches[r.id]).length;
  const allComplete = completedCount === totalResearches;
  const isLastTier = !SCHOOL_TIERS.some((t) => t.tier === currentTier + 1);
  const canPassExam = allComplete && !isLastTier && fame.gte(big(tierDef.examCost));

  const activeResearchDef = activeResearch
    ? SCHOOL_TIERS.flatMap((t) => t.researches).find((r) => r.id === activeResearch.id)
    : null;
  const activeProgress = activeResearch && activeResearchDef
    ? 1 - activeResearch.remainingSeconds / activeResearchDef.durationSeconds
    : 0;

  return (
    <div className={styles.room}>
      <div className={styles.header}>
        <span className={styles.title}>Painting School</span>
        <span className={styles.tierBadge}>Tier {currentTier}/{SCHOOL_TIERS.length}</span>
      </div>

      <div className={styles.tierProgress}>
        <div className={styles.tierProgressRow}>
          <span className={styles.tierLabel}>{tierDef.label}</span>
          <span className={styles.tierCount}>{completedCount} / {totalResearches}</span>
        </div>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${(completedCount / Math.max(1, totalResearches)) * 100}%` }}
          />
        </div>
      </div>

      {activeResearch && activeResearchDef && (
        <div className={styles.activeCard}>
          <div className={styles.activeHeader}>
            <span className={styles.activeName}>{activeResearchDef.name}</span>
            <span className={styles.activeTimer}>
              {formatDuration(Math.max(0, activeResearch.remainingSeconds))}
            </span>
          </div>
          <div className={styles.activeEffect}>{effectSummary(activeResearchDef.effects)}</div>
          <div className={styles.progressBar}>
            <div
              className={styles.activeProgressFill}
              style={{ width: `${activeProgress * 100}%` }}
            />
          </div>
          <button className={styles.cancelBtn} onClick={cancelResearch} type="button">
            Cancel
          </button>
        </div>
      )}

      <div className={styles.grid}>
        {tierDef.researches.map((research) => {
          const done = !!completedResearches[research.id];
          const isActive = activeResearch?.id === research.id;
          const summary = effectSummary(research.effects);

          return (
            <div
              key={research.id}
              className={done ? styles.cardDone : isActive ? styles.cardActive : styles.cardAvailable}
              onClick={() => {
                if (!done && !isActive && !activeResearch) startResearch(research.id);
              }}
              onMouseEnter={() =>
                pushHoverInfo(
                  research.name,
                  summary,
                  done
                    ? "Completed"
                    : isActive
                      ? `${formatDuration(Math.max(0, activeResearch!.remainingSeconds))} remaining`
                      : `${formatDuration(research.durationSeconds)} to complete`,
                )
              }
              onMouseLeave={clearHoverInfo}
            >
              <div className={styles.cardName}>
                {done ? "✓ " : isActive ? "⏳ " : "○ "}
                {research.name}
              </div>
              <div className={styles.cardEffect}>{summary}</div>
              {!done && !isActive && (
                <div className={styles.cardDuration}>{formatDuration(research.durationSeconds)}</div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.examGate}>
        <div>
          <div className={styles.examTitle}>Tier Exam</div>
          {isLastTier && allComplete && (
            <div className={styles.examHint}>Max tier reached</div>
          )}
          {!isLastTier && !allComplete && (
            <div className={styles.examHint}>{totalResearches - completedCount} more to go</div>
          )}
          {!isLastTier && allComplete && fame.lt(big(tierDef.examCost)) && (
            <div className={styles.examHint}>Need {tierDef.examCost} ⭐</div>
          )}
        </div>
        <button
          className={styles.examBtn}
          disabled={!canPassExam}
          onClick={() => passExam()}
          type="button"
        >
          {tierDef.examCost} ⭐
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire `SchoolRoom` into `src/routes/PaintingRoute.tsx`**

Add import:
```ts
import { SchoolRoom } from "@/components/painting/SchoolRoom";
```

In the `<aside className={styles.roomArea}>` section, add:
```tsx
{activeRoom === "school" && <SchoolRoom />}
```

- [ ] **Step 4: Run full suite**

Run: `npx vitest run`
Expected: all tests PASS (no unit tests for SchoolRoom — UI-only component)

- [ ] **Step 5: Commit**

```bash
git add src/components/painting/SchoolRoom.tsx src/components/painting/SchoolRoom.module.css src/routes/PaintingRoute.tsx
git commit -m "feat(school): add SchoolRoom panel and wire into PaintingRoute"
```

---

## Task 7: School designer infrastructure + Vite plugin

**Files:**
- Create: `src/dev/school-designer/types.ts`
- Create: `src/dev/school-designer/storage.ts`
- Create: `src/dev/school-designer/api.ts`
- Modify: `vite.config.ts`

- [ ] **Step 1: Create `src/dev/school-designer/types.ts`**

```ts
export interface DesignResearchEffect {
  kind: string;
  value: number;
}

export interface DesignResearch {
  id: string;
  name: string;
  durationSeconds: number;
  effects: ReadonlyArray<DesignResearchEffect>;
}

export interface DesignTier {
  tier: number;
  label: string;
  examCost: number;
  researches: ReadonlyArray<DesignResearch>;
}

export type DesignFile = ReadonlyArray<DesignTier>;

export const EMPTY_DESIGN: DesignFile = [];
```

- [ ] **Step 2: Create `src/dev/school-designer/storage.ts`**

```ts
import type { DesignFile } from "./types";

export const STORAGE_KEY = "artdle:school-design:draft";

export function loadDraft(): DesignFile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as DesignFile;
    return null;
  } catch {
    return null;
  }
}

export function saveDraft(design: DesignFile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(design));
  } catch {
    // Quota exceeded — silently ignore.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
```

- [ ] **Step 3: Create `src/dev/school-designer/api.ts`**

```ts
import type { DesignFile } from "./types";

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export async function saveToFile(design: DesignFile): Promise<SaveResult> {
  try {
    const response = await fetch("/api/school-design", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(design),
    });
    const json = (await response.json()) as SaveResult;
    return json;
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
```

- [ ] **Step 4: Add Vite plugin to `vite.config.ts`**

Add the plugin object before `export default defineConfig`:
```ts
const schoolDesignWriterPlugin = {
  name: "artdle-school-design-writer",
  configureServer(server: any) {
    server.middlewares.use(
      "/api/school-design",
      async (req: any, res: any, next: any) => {
        if (req.method !== "POST") return next();
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk);
          const body = Buffer.concat(chunks).toString("utf-8");
          const parsed = JSON.parse(body);
          if (!Array.isArray(parsed)) {
            res.statusCode = 400;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ ok: false, error: "Expected array" }));
            return;
          }
          const target = path.resolve(
            __dirname,
            "src/config/schoolResearches.json",
          );
          await fs.writeFile(target, JSON.stringify(parsed, null, 2), "utf-8");
          res.statusCode = 200;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ ok: false, error: String(e) }));
        }
      },
    );
  },
};
```

Register in `defineConfig`:
```ts
export default defineConfig({
  plugins: [react(), skillDesignWriterPlugin, schoolDesignWriterPlugin],
  // ... rest unchanged
```

- [ ] **Step 5: Run full suite**

Run: `npx vitest run`
Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/dev/school-designer/types.ts src/dev/school-designer/storage.ts src/dev/school-designer/api.ts vite.config.ts
git commit -m "feat(school-designer): add types, storage, api, vite plugin for /api/school-design"
```

---

## Task 8: useSchoolDesignerState (TDD)

**Files:**
- Create: `src/dev/school-designer/useSchoolDesignerState.ts`
- Create: `tests/dev/school-designer/useSchoolDesignerState.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/dev/school-designer/useSchoolDesignerState.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useSchoolDesignerState } from "@/dev/school-designer/useSchoolDesignerState";
import { EMPTY_DESIGN } from "@/dev/school-designer/types";

describe("useSchoolDesignerState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("falls back to file baseline when localStorage is empty", () => {
    const { result } = renderHook(() => useSchoolDesignerState());
    expect(result.current.design.length).toBeGreaterThan(0);
    expect(result.current.design[0]?.tier).toBe(1);
  });

  it("addTier appends a new tier with the next tier number", () => {
    const { result } = renderHook(() => useSchoolDesignerState());
    act(() => result.current.actions.importDesign(EMPTY_DESIGN));
    act(() => result.current.actions.addTier());
    expect(result.current.design).toHaveLength(1);
    expect(result.current.design[0]?.tier).toBe(1);
    act(() => result.current.actions.addTier());
    expect(result.current.design).toHaveLength(2);
    expect(result.current.design[1]?.tier).toBe(2);
  });

  it("deleteTier removes the tier and renumbers remaining tiers", () => {
    const { result } = renderHook(() => useSchoolDesignerState());
    act(() => result.current.actions.importDesign(EMPTY_DESIGN));
    act(() => result.current.actions.addTier()); // tier 1
    act(() => result.current.actions.addTier()); // tier 2
    act(() => result.current.actions.addTier()); // tier 3
    act(() => result.current.actions.deleteTier(2));
    expect(result.current.design).toHaveLength(2);
    expect(result.current.design[0]?.tier).toBe(1);
    expect(result.current.design[1]?.tier).toBe(2); // was tier 3, renumbered
  });

  it("updateTier applies patch to the matching tier", () => {
    const { result } = renderHook(() => useSchoolDesignerState());
    act(() => result.current.actions.importDesign(EMPTY_DESIGN));
    act(() => result.current.actions.addTier());
    act(() => result.current.actions.updateTier(1, { label: "Maître" }));
    expect(result.current.design[0]?.label).toBe("Maître");
  });

  it("addResearch adds a research to the specified tier", () => {
    const { result } = renderHook(() => useSchoolDesignerState());
    act(() => result.current.actions.importDesign(EMPTY_DESIGN));
    act(() => result.current.actions.addTier());
    act(() => result.current.actions.addResearch(1));
    expect(result.current.design[0]?.researches).toHaveLength(1);
  });

  it("updateResearch patches the matching research", () => {
    const { result } = renderHook(() => useSchoolDesignerState());
    act(() => result.current.actions.importDesign(EMPTY_DESIGN));
    act(() => result.current.actions.addTier());
    act(() => result.current.actions.addResearch(1));
    const researchId = result.current.design[0]!.researches[0]!.id;
    act(() => result.current.actions.updateResearch(1, researchId, { name: "Renamed" }));
    expect(result.current.design[0]?.researches[0]?.name).toBe("Renamed");
  });

  it("deleteResearch removes the matching research", () => {
    const { result } = renderHook(() => useSchoolDesignerState());
    act(() => result.current.actions.importDesign(EMPTY_DESIGN));
    act(() => result.current.actions.addTier());
    act(() => result.current.actions.addResearch(1));
    act(() => result.current.actions.addResearch(1));
    const researchId = result.current.design[0]!.researches[0]!.id;
    act(() => result.current.actions.deleteResearch(1, researchId));
    expect(result.current.design[0]?.researches).toHaveLength(1);
  });

  it("resetAll reloads the file baseline", () => {
    const { result } = renderHook(() => useSchoolDesignerState());
    act(() => result.current.actions.importDesign(EMPTY_DESIGN));
    act(() => result.current.actions.resetAll());
    expect(result.current.design.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dev/school-designer/useSchoolDesignerState.test.ts`
Expected: FAIL with module not found

- [ ] **Step 3: Create `src/dev/school-designer/useSchoolDesignerState.ts`**

```ts
import { useState, useEffect, useCallback, useRef } from "react";
import type { DesignFile, DesignTier, DesignResearch } from "./types";
import { EMPTY_DESIGN } from "./types";
import { loadDraft, saveDraft, clearDraft } from "./storage";
import rawTiers from "@/config/schoolResearches.json";

const SAVE_DEBOUNCE_MS = 500;

export interface SchoolDesignerActions {
  addTier: () => void;
  deleteTier: (tier: number) => void;
  updateTier: (tier: number, patch: Partial<Omit<DesignTier, "tier" | "researches">>) => void;
  addResearch: (tier: number) => void;
  updateResearch: (tier: number, id: string, patch: Partial<DesignResearch>) => void;
  deleteResearch: (tier: number, id: string) => void;
  resetAll: () => void;
  importDesign: (design: DesignFile) => void;
}

export interface SchoolDesignerState {
  design: DesignFile;
  actions: SchoolDesignerActions;
}

function loadFileBaseline(): DesignFile {
  return rawTiers as DesignFile;
}

export function useSchoolDesignerState(): SchoolDesignerState {
  const [design, setDesign] = useState<DesignFile>(
    () => loadDraft() ?? loadFileBaseline(),
  );
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveDraft(design), SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [design]);

  const addTier = useCallback(() => {
    setDesign((d) => {
      const nextTier = d.length + 1;
      const newTier: DesignTier = {
        tier: nextTier,
        label: `Tier ${nextTier}`,
        examCost: 50,
        researches: [],
      };
      return [...d, newTier];
    });
  }, []);

  const deleteTier = useCallback((tier: number) => {
    setDesign((d) => {
      const filtered = d.filter((t) => t.tier !== tier);
      return filtered.map((t, i) => ({ ...t, tier: i + 1 }));
    });
  }, []);

  const updateTier = useCallback(
    (tier: number, patch: Partial<Omit<DesignTier, "tier" | "researches">>) => {
      setDesign((d) => d.map((t) => (t.tier === tier ? { ...t, ...patch } : t)));
    },
    [],
  );

  const addResearch = useCallback((tier: number) => {
    setDesign((d) =>
      d.map((t) => {
        if (t.tier !== tier) return t;
        const newId = `research_${t.tier}_${t.researches.length + 1}`;
        const newResearch: DesignResearch = {
          id: newId,
          name: "New Research",
          durationSeconds: 300,
          effects: [],
        };
        return { ...t, researches: [...t.researches, newResearch] };
      }),
    );
  }, []);

  const updateResearch = useCallback(
    (tier: number, id: string, patch: Partial<DesignResearch>) => {
      setDesign((d) =>
        d.map((t) => {
          if (t.tier !== tier) return t;
          return {
            ...t,
            researches: t.researches.map((r) => (r.id === id ? { ...r, ...patch } : r)),
          };
        }),
      );
    },
    [],
  );

  const deleteResearch = useCallback((tier: number, id: string) => {
    setDesign((d) =>
      d.map((t) => {
        if (t.tier !== tier) return t;
        return { ...t, researches: t.researches.filter((r) => r.id !== id) };
      }),
    );
  }, []);

  const resetAll = useCallback(() => {
    clearDraft();
    setDesign([...loadFileBaseline()]);
  }, []);

  const importDesign = useCallback((d: DesignFile) => {
    setDesign(d);
  }, []);

  return {
    design,
    actions: {
      addTier,
      deleteTier,
      updateTier,
      addResearch,
      updateResearch,
      deleteResearch,
      resetAll,
      importDesign,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dev/school-designer/useSchoolDesignerState.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/dev/school-designer/useSchoolDesignerState.ts tests/dev/school-designer/useSchoolDesignerState.test.ts
git commit -m "feat(school-designer): add useSchoolDesignerState hook with full TDD coverage"
```

---

## Task 9: SchoolDesignerRoute + App wiring

**Files:**
- Create: `src/dev/school-designer/SchoolDesignerRoute.tsx`
- Create: `src/dev/school-designer/SchoolDesignerRoute.module.css`
- Modify: `src/App.tsx`
- Modify: `src/dev/skill-designer/SkillDesignerRoute.tsx`

- [ ] **Step 1: Create `src/dev/school-designer/SchoolDesignerRoute.module.css`**

```css
.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #111827;
  color: #e5e7eb;
  font-family: monospace;
}

.topBar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: #1f2937;
  border-bottom: 1px solid #374151;
  flex-shrink: 0;
}

.title {
  color: #a78bfa;
  font-weight: bold;
  font-size: 14px;
}

.statusSaved { color: #34d399; font-size: 12px; }
.statusDirty { color: #fbbf24; font-size: 12px; }
.statusSaving { color: #60a5fa; font-size: 12px; }

.btn {
  background: #374151;
  color: #e5e7eb;
  border: none;
  border-radius: 4px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
}

.btn:hover { background: #4b5563; }

.btnPrimary {
  background: #4c1d95;
  color: #c4b5fd;
}

.btnPrimary:hover { background: #5b21b6; }

.link {
  color: #60a5fa;
  font-size: 12px;
  text-decoration: none;
  margin-left: auto;
}

.link:hover { text-decoration: underline; }

.content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tier {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 6px;
  padding: 12px;
}

.tierHeader {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.tierLabel {
  color: #c4b5fd;
  font-weight: bold;
  font-size: 13px;
}

.tierInput {
  background: #111827;
  color: #e5e7eb;
  border: 1px solid #374151;
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 12px;
  font-family: monospace;
}

.tierDelete {
  background: none;
  color: #6b7280;
  border: none;
  cursor: pointer;
  font-size: 12px;
  margin-left: auto;
}

.tierDelete:hover { color: #ef4444; }

.researches {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}

.research {
  background: #111827;
  border: 1px solid #374151;
  border-radius: 4px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.researchRow {
  display: flex;
  align-items: center;
  gap: 6px;
}

.researchInput {
  background: #1f2937;
  color: #e5e7eb;
  border: 1px solid #374151;
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 12px;
  font-family: monospace;
}

.researchDelete {
  background: none;
  color: #6b7280;
  border: none;
  cursor: pointer;
  font-size: 11px;
}

.researchDelete:hover { color: #ef4444; }

.effects {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-left: 8px;
}

.effectRow {
  display: flex;
  align-items: center;
  gap: 4px;
}

.effectKindInput {
  background: #1f2937;
  color: #e5e7eb;
  border: 1px solid #374151;
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 11px;
  font-family: monospace;
  width: 160px;
}

.effectValueInput {
  background: #1f2937;
  color: #e5e7eb;
  border: 1px solid #374151;
  border-radius: 3px;
  padding: 2px 4px;
  font-size: 11px;
  font-family: monospace;
  width: 60px;
}

.effectDelete {
  background: none;
  color: #6b7280;
  border: none;
  cursor: pointer;
  font-size: 10px;
}

.effectDelete:hover { color: #ef4444; }

.addEffectBtn {
  background: none;
  color: #4b5563;
  border: 1px dashed #374151;
  border-radius: 3px;
  padding: 1px 6px;
  font-size: 10px;
  cursor: pointer;
  align-self: flex-start;
}

.addEffectBtn:hover { color: #9ca3af; }
```

- [ ] **Step 2: Create `src/dev/school-designer/SchoolDesignerRoute.tsx`**

```tsx
import type { JSX } from "react";
import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useSchoolDesignerState } from "./useSchoolDesignerState";
import { saveToFile } from "./api";
import type { DesignResearchEffect } from "./types";
import styles from "./SchoolDesignerRoute.module.css";

type Status = "saved" | "dirty" | "saving";

const KNOWN_EFFECT_KINDS = [
  "canvas_gold_pct",
  "speed_pct",
  "worker_xp_pct",
];

export function SchoolDesignerRoute(): JSX.Element {
  const { design, actions } = useSchoolDesignerState();
  const [status, setStatus] = useState<Status>("saved");

  const markDirty = useCallback(() => setStatus("dirty"), []);

  const handleSave = useCallback(async () => {
    setStatus("saving");
    const result = await saveToFile(design);
    setStatus(result.ok ? "saved" : "dirty");
  }, [design]);

  const wrap = <T extends (...args: never[]) => unknown>(fn: T): T =>
    ((...args: Parameters<T>) => {
      markDirty();
      return fn(...args);
    }) as T;

  return (
    <div className={styles.layout}>
      <div className={styles.topBar}>
        <span className={styles.title}>School Designer</span>
        <span className={
          status === "saved" ? styles.statusSaved :
          status === "saving" ? styles.statusSaving :
          styles.statusDirty
        }>
          {status === "saved" ? "Saved" : status === "saving" ? "Saving…" : "Unsaved changes"}
        </span>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave} type="button">
          Save to file
        </button>
        <button className={styles.btn} onClick={() => { wrap(actions.resetAll)(); }} type="button">
          Reset
        </button>
        <Link className={styles.link} to="/dev/skill-designer">→ Skill Designer</Link>
      </div>

      <div className={styles.content}>
        {design.map((tier) => (
          <div key={tier.tier} className={styles.tier}>
            <div className={styles.tierHeader}>
              <span className={styles.tierLabel}>Tier {tier.tier}</span>
              <input
                className={styles.tierInput}
                value={tier.label}
                placeholder="Label"
                onChange={(e) => { markDirty(); actions.updateTier(tier.tier, { label: e.target.value }); }}
              />
              <input
                className={styles.tierInput}
                type="number"
                value={tier.examCost}
                min={0}
                style={{ width: 70 }}
                title="Exam cost (fame)"
                onChange={(e) => { markDirty(); actions.updateTier(tier.tier, { examCost: Number(e.target.value) }); }}
              />
              <span style={{ color: "#6b7280", fontSize: 10 }}>⭐ exam</span>
              <button
                className={styles.tierDelete}
                onClick={() => { markDirty(); actions.deleteTier(tier.tier); }}
                type="button"
                title="Delete tier"
              >
                ✕ tier
              </button>
            </div>

            <div className={styles.researches}>
              {tier.researches.map((research) => (
                <div key={research.id} className={styles.research}>
                  <div className={styles.researchRow}>
                    <input
                      className={styles.researchInput}
                      value={research.id}
                      placeholder="id"
                      style={{ width: 180 }}
                      onChange={(e) => { markDirty(); actions.updateResearch(tier.tier, research.id, { id: e.target.value }); }}
                    />
                    <input
                      className={styles.researchInput}
                      value={research.name}
                      placeholder="Name"
                      style={{ flex: 1 }}
                      onChange={(e) => { markDirty(); actions.updateResearch(tier.tier, research.id, { name: e.target.value }); }}
                    />
                    <input
                      className={styles.researchInput}
                      type="number"
                      value={research.durationSeconds}
                      min={1}
                      style={{ width: 70 }}
                      title="Duration (seconds)"
                      onChange={(e) => { markDirty(); actions.updateResearch(tier.tier, research.id, { durationSeconds: Number(e.target.value) }); }}
                    />
                    <span style={{ color: "#6b7280", fontSize: 10 }}>s</span>
                    <button
                      className={styles.researchDelete}
                      onClick={() => { markDirty(); actions.deleteResearch(tier.tier, research.id); }}
                      type="button"
                    >
                      ✕
                    </button>
                  </div>

                  <div className={styles.effects}>
                    {research.effects.map((effect, ei) => (
                      <div key={ei} className={styles.effectRow}>
                        <input
                          className={styles.effectKindInput}
                          list="effect-kinds"
                          value={effect.kind}
                          placeholder="kind (e.g. canvas_gold_pct)"
                          onChange={(e) => {
                            markDirty();
                            const newEffects: ReadonlyArray<DesignResearchEffect> = research.effects.map((ef, i) =>
                              i === ei ? { ...ef, kind: e.target.value } : ef,
                            );
                            actions.updateResearch(tier.tier, research.id, { effects: newEffects });
                          }}
                        />
                        <input
                          className={styles.effectValueInput}
                          type="number"
                          step="0.01"
                          min={0}
                          value={effect.value}
                          title="Fractional value (0.15 = 15%)"
                          onChange={(e) => {
                            markDirty();
                            const newEffects: ReadonlyArray<DesignResearchEffect> = research.effects.map((ef, i) =>
                              i === ei ? { ...ef, value: Number(e.target.value) } : ef,
                            );
                            actions.updateResearch(tier.tier, research.id, { effects: newEffects });
                          }}
                        />
                        <button
                          className={styles.effectDelete}
                          type="button"
                          onClick={() => {
                            markDirty();
                            const newEffects = research.effects.filter((_, i) => i !== ei);
                            actions.updateResearch(tier.tier, research.id, { effects: newEffects });
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      className={styles.addEffectBtn}
                      type="button"
                      onClick={() => {
                        markDirty();
                        const newEffects: ReadonlyArray<DesignResearchEffect> = [
                          ...research.effects,
                          { kind: "canvas_gold_pct", value: 0 },
                        ];
                        actions.updateResearch(tier.tier, research.id, { effects: newEffects });
                      }}
                    >
                      + effect
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              className={styles.btn}
              type="button"
              onClick={() => { markDirty(); actions.addResearch(tier.tier); }}
            >
              + Research
            </button>
          </div>
        ))}

        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          type="button"
          onClick={() => { markDirty(); actions.addTier(); }}
        >
          + Tier
        </button>
      </div>

      <datalist id="effect-kinds">
        {KNOWN_EFFECT_KINDS.map((k) => <option key={k} value={k} />)}
      </datalist>
    </div>
  );
}
```

- [ ] **Step 3: Wire route into `src/App.tsx`**

Add import:
```ts
import { SchoolDesignerRoute } from "@/dev/school-designer/SchoolDesignerRoute";
```

Add route inside the `isDev` block:
```tsx
if (isDev) {
  return (
    <Routes>
      <Route path="/dev/skill-designer" element={<SkillDesignerRoute />} />
      <Route path="/dev/school-designer" element={<SchoolDesignerRoute />} />
    </Routes>
  );
}
```

- [ ] **Step 4: Add cross-link in `src/dev/skill-designer/SkillDesignerRoute.tsx`**

Find the ActionBar component call and add a link to the school designer nearby. The exact placement depends on the ActionBar props, but at minimum add a `<Link>` in the layout. Near the top of the `SkillDesignerRoute` return, add:

```tsx
import { Link } from "react-router-dom";
```

In the JSX, after the `<ActionBar ... />` element:
```tsx
<Link
  to="/dev/school-designer"
  style={{ position: "absolute", top: 12, right: 16, color: "#60a5fa", fontSize: 12, textDecoration: "none" }}
>
  → School Designer
</Link>
```

Wrap the layout div with `position: relative` if not already.

- [ ] **Step 5: Run full suite**

Run: `npx vitest run`
Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/dev/school-designer/SchoolDesignerRoute.tsx src/dev/school-designer/SchoolDesignerRoute.module.css src/App.tsx src/dev/skill-designer/SkillDesignerRoute.tsx
git commit -m "feat(school-designer): add SchoolDesignerRoute and wire into App + cross-link from skill designer"
```

---

## Self-Review Checklist

**Spec coverage:**
- §2 Core loop: startResearch / schoolTick / passExam / cancelResearch — Task 2 ✓
- §3.1 Config: SCHOOL_TIERS, SchoolTier, SchoolResearch — Task 1 ✓
- §3.2 Store state: all 4 fields — Task 2 ✓
- §3.3 Effect system: getSchoolBonus — Task 3 ✓
- §4 Actions: all 5 actions — Task 2 ✓
- §5 Tick integration: schoolTick in tickAll — Task 2 ✓
- §6 School unlock: unlock_school node + RoomRail gate — Task 5 ✓
- §7 UI panel: SchoolRoom.tsx — Task 6 ✓
- §8 Persistence: migration v16→v17, resetSchool not called on ascend — Task 2 ✓; resetSchool only wired in TopBar wipe flow (already handled by existing wipe pattern, no additional wiring needed since `resetSchool` exists and TopBar calls reset via a dedicated pattern — confirm this in the codebase)
- §9 School Designer: types, storage, api, hook, route, vite plugin — Tasks 7-9 ✓
- §10 Testing: all three test files — Tasks 2, 3, 8 ✓

**Note on `resetSchool` + TopBar wipe:** The TopBar full-wipe flow calls each slice's reset function. Verify that `resetSchool` is added to the TopBar wipe call or the ascend orchestrator exclusion list. Check `src/components/shell/TopBar.tsx` for the wipe pattern and add `s.resetSchool()` to the wipe handler if needed. This may require a small amendment to Task 2.

**Placeholder scan:** None found.

**Type consistency:** All action signatures consistent across slice, test, and UI call sites.
