# Painting School — Design Spec

_Date: 2026-05-15_

---

## 1. Overview

The Painting School is a time-gated research mechanic that sits alongside the Workshop and Office as a right-side room panel. The player launches research projects one at a time; each completes after a fixed in-game duration and grants a permanent bonus. Research is organized into tiers; completing all research in a tier and spending fame to pass an exam unlocks the next tier. All progression survives ascension.

---

## 2. Core Loop

```
Pick a research (free order within tier)
  → wait (in-game time, tab must be open — v1 policy)
  → research complete → permanent bonus applied
  → repeat until all researches in tier done
  → spend fame to pass Tier Exam
  → next tier unlocked
  → repeat up to max tier
```

One research active at a time. Cancelling resets the timer to zero (no partial credit).

---

## 3. Data Model

### 3.1 Config (`src/config/schoolResearches.ts`)

The config is generated from `schoolResearches.json` (edited via the School Designer). The code imports the JSON directly, same pattern as `skillTreeDesign.json → skillTreeNodes.ts`.

```ts
interface SchoolResearchEffect {
  kind: string;   // e.g. "canvas_gold_pct", "speed_pct", "workshop_xp_pct"
  value: number;  // fractional: 0.15 = +15%
}

interface SchoolResearch {
  id: string;
  name: string;
  durationSeconds: number;
  effects: ReadonlyArray<SchoolResearchEffect>;
}

interface SchoolTier {
  tier: number;       // 1-indexed
  label: string;      // "Apprenti", "Élève", "Compagnon", "Maître", "Expert", …
  examCost: number;   // fame required to pass the exam
  researches: ReadonlyArray<SchoolResearch>;
}

export const SCHOOL_TIERS: ReadonlyArray<SchoolTier>
```

**Scalability:** The config is fully data-driven. Adding new tiers (toward the 20-25 target) requires no code changes — only new entries in `schoolResearches.json`.

**Initial content:** 5 tiers, ~10-15 researches each, authored in the School Designer and committed as JSON.

### 3.2 Store state (`schoolSlice`)

```ts
interface SchoolState {
  // All fields persist across ascensions (not reset on resetRunCurrencies / resetTree / etc.)
  completedResearches: Record<string, true>;                         // researches done
  currentTier: number;                                               // 1-indexed, starts at 1
  activeResearch: { id: string; remainingSeconds: number } | null;  // null = idle
  examsPassed: Record<number, true>;                                 // tier number → passed
}
```

### 3.3 Effect system (`src/core/schoolMultipliers.ts`)

```ts
// Sum the value of all completed researches whose effects include `kind`
export const getSchoolBonus = (
  state: Pick<GameStore, "completedResearches">,
  kind: string,
): number
```

Existing multipliers call `getSchoolBonus` as an additive term:

- `getCanvasGoldMultiplier` += `getSchoolBonus(state, "canvas_gold_pct")`
- `getCanvasSpeedMultiplier` += `getSchoolBonus(state, "speed_pct")`
- `getWorkerXpMultiplier` += `getSchoolBonus(state, "worker_xp_pct")`
- Additional `kind` values extend coverage without touching core formulas.

---

## 4. Store Slice Actions

```ts
interface SchoolSlice extends SchoolState {
  startResearch(id: string): boolean;
  // Returns false if: another research is active, research already completed,
  // or research does not belong to currentTier (future tiers are locked;
  // past-tier researches are all completed by definition).

  cancelResearch(): void;
  // Cancels active research, resets timer to 0. No penalty.

  schoolTick(delta: number): void;
  // Called from the main tick loop. Decrements remainingSeconds.
  // On completion: completedResearches[id] = true, activeResearch = null.

  passExam(): boolean;
  // Returns false if: not all researches in currentTier are complete,
  // or fame < examCost for currentTier, or currentTier is already the last tier.
  // On success: deducts fame, examsPassed[currentTier] = true, currentTier += 1.

  resetSchool(): void;
  // NOT called on ascend. Reserved for full-wipe (TopBar reset only).
}
```

---

## 5. Tick Integration

`schoolTick(delta)` is added to the main tick loop in `src/core/tickLoop.ts` alongside `tickOffice`, `skillTreeTick`, etc. No other timing mechanism is introduced.

The active research timer pauses when the tab is hidden — consistent with the v1 "no offline progress" policy.

---

## 6. School Unlock

A new skill tree node `unlock_school` is added to `skillTreeDesign.json`:

- **Capability tag:** `school_access`
- **Placement:** Late-mid tree (depth ~5-6), near the Office unlock nodes
- **Cost:** TBD in balance pass (suggested: same depth-pricing as other d5-d6 nodes)

The `RoomRail` already has the `school` tab defined. Its `enabled` gate changes from `false` to `hasCapability(state, "school_access")`. No layout changes required.

---

## 7. UI — School Room Panel

File: `src/components/painting/SchoolRoom.tsx`

**Layout (368px wide panel, Option B):**

```
┌─────────────────────────────────────┐
│ 🎓 Painting School        Tier 1/5  │
│ Apprenti ━━━━━━━━━━░░░░░  7 / 12   │  ← tier progress bar
├─────────────────────────────────────┤
│ ⏳ Color Theory Basics              │  ← active research card
│   +15% canvas gold — 2:34 left      │    (hidden when idle)
│   ████████████░░░░░░░░░░░           │
├─────────────────────────────────────┤
│ ✓ Brushwork    │ ✓ Light & Shadow   │  ← 2-col research grid
│ +10% gold      │ +8% speed          │
├────────────────┼────────────────────┤
│ ○ Perspective  │ ○ Color Mixing     │  ← available (click to start)
│ +10% · 5min    │ +7% · 8min         │
├─────────────────────────────────────┤
│ 🎓 Tier Exam — 50 ⭐  [5 more left]│  ← exam gate (greyed until complete)
└─────────────────────────────────────┘
```

**Interaction:**
- Clicking an available research card calls `startResearch(id)`. No confirmation needed.
- Active research card shows name, effect summary, countdown timer, and progress bar.
- Completed cards show name + effect, no action.
- Exam button enabled when all researches complete AND fame ≥ examCost. Calls `passExam()`.
- Hover on any card pushes info to `hoverInfoSlice` (InfoPanel strip) — same pattern as Workshop and Office.

---

## 8. Persistence & Reset Semantics

| Field | Survives ascend | Full wipe (TopBar reset) |
|---|---|---|
| `completedResearches` | ✓ yes | cleared |
| `currentTier` | ✓ yes | reset to 1 |
| `activeResearch` | ✓ yes | cleared |
| `examsPassed` | ✓ yes | cleared |

School state is included in Zustand persist / idb-keyval. No migration needed (first introduction).

`resetSchool()` is called only from the full-wipe flow (`TopBar` → "Wipe all progress"). It is **not** called from `performAscendOrchestrator`.

---

## 9. School Designer (Dev Tool)

Route: `/dev/school-designer`
File: `src/dev/school-designer/SchoolDesignerRoute.tsx`

Same architecture as the Skill Designer (`/dev/skill-designer`):

- Reads/writes `src/config/schoolResearches.json`
- Local draft auto-saved to `localStorage` (key: `school-designer-draft`)
- Actions: Add Tier, Add Research (within a tier), Edit Research (name, duration, effects), Delete, Reorder within tier, Import/Export JSON, Reset to file baseline

**Research editor fields:**
- Name (text)
- Duration (number, seconds — designer may show as minutes for convenience)
- Effects: list of `{ kind: string, value: number }` pairs (kind is a free-text dropdown seeded from known kinds)

Navigation: accessible from `/dev/skill-designer` via a link, and directly at `/dev/school-designer`. Listed in the dev nav alongside the Skill Designer.

---

## 10. Testing

- `tests/store/schoolSlice.test.ts` — unit tests for all actions: startResearch, cancelResearch, schoolTick completion, passExam gates, reset semantics
- `tests/core/schoolMultipliers.test.ts` — getSchoolBonus returns correct sum for completed researches
- `tests/dev/school-designer/useSchoolDesignerState.test.ts` — mirrors useDesignerState tests: add/edit/delete research, tier management, reset to baseline

---

## 11. Out of Scope (v1)

- Research queue (auto-start next on completion) — keep it manual for now
- Research cancellation refund — no partial credit, by design
- School effects on Expositions, Painting Office RPG redesign — v2.0+ features
- Notification/toast when research completes — future QoL
