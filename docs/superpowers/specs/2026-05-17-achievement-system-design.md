# Achievement System — Design Spec

_Date: 2026-05-17_

---

## 1. Overview

This spec redesigns the Paint Mastery (PM) earning mechanism and introduces a dedicated Achievement system. PM passive accumulation (per-canvas-sale drip) is removed. PM is now earned exclusively by completing achievements. Achievements also reward inspiration multipliers and any other bonus expressible as a multiplier effect kind.

The achievement system ships three things:
- A persistent **achievement engine** (`statsSlice` + `achievementSlice`)
- A player-facing **Achievements tab** (grid of icons, all hidden until completed)
- A dev-facing **Achievement Designer** (`/dev/achievement-designer`) for authoring content without touching code

---

## 2. What changes vs. what stays

**Removed:**
- `paintMasterySlice.addGoldEarned()` call from `canvasTick`. PM no longer drips on canvas sales.

**Kept unchanged:**
- `pmMult(paintMastery)` log-curve — PM still multiplies canvas gold exactly as before. Only the earning mechanism changes.
- `lifetimeGold` field in `paintMasterySlice` — reused as `lifetime.goldEarned` alias in the stats ledger (no duplication).
- `ascendCount` in `metaSlice` — reused as `lifetime.ascensions` alias.

**Added:**
- `statsSlice` — `lifetime.*` and `run.*` counters
- `achievementSlice` — completed achievement IDs + notification state
- `achievementsDesign.json` + `achievementConfig.ts` — data-driven config
- `AchievementDesigner` route (`/dev/achievement-designer`)
- Achievements tab in nav
- InfoPanel notification mode (5s animated display on achievement unlock)

**Modified:**
- `multipliers.ts` — adds `getAchievementBonus(state, kind)` called by existing multiplier getters
- `ascend.ts` — resets `statsRun` at ascend; preserves `statsLifetime` and `completedAchievements`
- Relevant call sites — increment stats counters (see §3)

---

## 3. Stats Ledger (`statsSlice`)

Two namespaces with opposite reset semantics, stored in one slice.

### 3.1 `lifetime.*` — never reset, survives ascensions

| Field | Incremented at |
|---|---|
| `lifetime.canvasesSold` | `canvasTick` on each sale |
| `lifetime.goldEarned` | alias → `lifetimeGold` in `paintMasterySlice` |
| `lifetime.critsLanded` | `canvasTick` when `isCritThisCanvas && sale` |
| `lifetime.maxComboChain` | `canvasTick` when `chain > lifetime.maxComboChain` |
| `lifetime.ascensions` | alias → `ascendCount` in `metaSlice` |
| `lifetime.workshopItemsCrafted` | craft action in `workshopSlice` |
| `lifetime.workshopSlotsLevelled` | slot upgrade actions in `workshopSlice` |
| `lifetime.schoolResearchesCompleted` | research completion in `schoolSlice` |
| `lifetime.schoolTiersPassed` | exam passage in `schoolSlice` |
| `lifetime.officeWorkersHired` | hire action in `officeSlice` |

Aliased fields (`lifetime.goldEarned`, `lifetime.ascensions`) are not stored separately — they are read directly from the owning slice at evaluation time. The stats ledger exposes them under a unified namespace for the condition DSL only.

### 3.2 `run.*` — reset on each ascension

| Field | Incremented at | Reset trigger |
|---|---|---|
| `run.canvasesSold` | `canvasTick` on each sale | ascend |
| `run.critsLanded` | `canvasTick` when crit + sale | ascend |
| `run.currentCritStreak` | +1 on crit sale, **→ 0 on miss** | ascend |
| `run.maxCritStreak` | when `currentCritStreak > maxCritStreak` | ascend |
| `run.maxComboChain` | when `chain > run.maxComboChain` | ascend |
| `run.goldEarned` | `canvasTick` on each sale | ascend |
| `run.workshopItemsCrafted` | craft action | ascend |
| `run.schoolResearchesCompleted` | research completion | ascend |

This list is a baseline. New stats are added when an achievement condition requires one — no schema lock.

### 3.3 Slice API

```ts
interface StatsLifetime {
  canvasesSold: number;
  critsLanded: number;
  maxComboChain: number;
  workshopItemsCrafted: number;
  workshopSlotsLevelled: number;
  schoolResearchesCompleted: number;
  schoolTiersPassed: number;
  officeWorkersHired: number;
}

interface StatsRun {
  canvasesSold: number;
  critsLanded: number;
  currentCritStreak: number;
  maxCritStreak: number;
  maxComboChain: number;
  goldEarned: Big;
  workshopItemsCrafted: number;
  schoolResearchesCompleted: number;
}

interface StatsSlice {
  statsLifetime: StatsLifetime;
  statsRun: StatsRun;
  incrementStat: (namespace: "lifetime" | "run", key: string, by?: number) => void;
  resetRunStats: () => void;
}
```

---

## 4. Achievement Data Model

### 4.1 Config shape (`achievementsDesign.json`)

```ts
interface AchievementCondition {
  stat: string;   // e.g. "lifetime.canvasesSold", "run.currentCritStreak"
  op: ">=" | ">" | "==" | "<=" | "<";
  value: number;
}

interface AchievementEffect {
  kind: string;   // same kind system as school/workshop (e.g. "canvas_gold_pct", "inspi_mult", "paint_mastery_flat")
  value: number;  // fractional for % (0.10 = +10%), flat integer for PM
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;                  // emoji
  category: "canvas" | "workshop" | "ascension" | "school_office" | "secret";
  condition: AchievementCondition;
  effects: ReadonlyArray<AchievementEffect>;
}
```

All achievements are hidden until completed — there is no `hidden` field, this is the uniform behavior.

### 4.2 Stat resolution

The condition evaluator resolves `stat` strings as follows:
- `"lifetime.goldEarned"` → reads `paintMasterySlice.lifetimeGold`
- `"lifetime.ascensions"` → reads `metaSlice.ascendCount`
- `"lifetime.*"` (all others) → reads `statsSlice.statsLifetime[key]`
- `"run.*"` → reads `statsSlice.statsRun[key]`

---

## 5. Achievement Slice (`achievementSlice`)

```ts
interface AchievementNotification {
  id: string;
  name: string;
  effects: ReadonlyArray<AchievementEffect>;
}

interface AchievementSlice {
  completedAchievements: ReadonlySet<string>;   // persisted, never reset on ascend
  activeNotification: AchievementNotification | null;   // transient, excluded from persist
  notificationQueue: ReadonlyArray<AchievementNotification>;  // transient

  /** Called after any stat increment. Checks all incomplete achievements. */
  evaluateAchievements: () => void;
  /** Pop the next notification from queue into activeNotification. */
  advanceNotification: () => void;
  /** Clear activeNotification (called after 5s timeout). */
  clearNotification: () => void;
}
```

### 5.1 Evaluation flow

`evaluateAchievements()`:
1. For each achievement in `ACHIEVEMENTS` not in `completedAchievements`, evaluate its condition against current state.
2. For each newly satisfied achievement:
   - Add ID to `completedAchievements`.
   - Apply `paint_mastery_flat` effects immediately (one-shot add to `paintMastery`).
   - Push a notification entry onto `notificationQueue`.
3. If `activeNotification === null` and queue is non-empty, call `advanceNotification()`.

`advanceNotification()`: shifts the queue, sets `activeNotification`, starts a 5s `setTimeout` that calls `clearNotification()` → which then calls `advanceNotification()` again if queue still has entries (FIFO drain).

### 5.2 Evaluation call sites

`evaluateAchievements()` is called from:
- `canvasTick` after each sale
- `upgradeSellPrice`, `upgradeSpeed`, `upgradeSize`, `upgradeCrit`, `upgradeCombo`
- Workshop craft and slot upgrade actions
- School research completion and exam passage
- Office hire action
- `ascend.ts` orchestrator (after stats are updated, before UI transition)
- App startup / rehydration (retroactive check against loaded stats)

---

## 6. Reward Integration (`multipliers.ts`)

```ts
export function getAchievementBonus(state: GameStore, kind: string): number {
  return ACHIEVEMENTS
    .filter(a => state.completedAchievements.has(a.id))
    .flatMap(a => a.effects)
    .filter(e => e.kind === kind)
    .reduce((sum, e) => sum + e.value, 0);
}
```

Each existing multiplier getter in `multipliers.ts` adds one `getAchievementBonus(state, kind)` call for its kind. Example:

```ts
export function getCanvasGoldMultiplier(state: GameStore): number {
  return 1
    + getWorkshopBonus(state, "canvas_gold_pct")
    + getSchoolBonus(state, "canvas_gold_pct")
    + getAchievementBonus(state, "canvas_gold_pct")  // added
    + ...;
}
```

`paint_mastery_flat` is handled one-shot at completion time (see §5.1), not as a continuous multiplier. All other effect kinds integrate additively with existing bonus sources.

---

## 7. Notification System

The existing `InfoPanel` gets a new display mode when `activeNotification !== null`.

**Visual behavior:**
- Title: achievement name, rainbow color animation via CSS `@keyframes` cycling `hsl(deg, 80%, 65%)` (same technique as workshop rainbow caterpillar)
- Body: comma-separated reward list (e.g. `+25 PM · ×1.10 inspiration`)
- Text: gentle `translateY` oscillation via Motion `animate` (±3px, 1.5s ease-in-out loop)
- Duration: 5 seconds, then auto-clears via `setTimeout`
- Priority: notification display overrides hover info for its 5s window
- Queue: FIFO — if multiple achievements unlock simultaneously (e.g. on game load), each consumes its own 5s slot

---

## 8. Achievements Tab (UI)

New route in the nav bar: `AchievementsRoute`.

- **Grid layout**: `grid-template-columns: repeat(auto-fill, minmax(64px, 1fr))`
- **Tile states**:
  - **Completed**: colored icon, glowing border (color varies by category), reward badge overlay
  - **Hidden** (everything else): not rendered — absent from the grid entirely
- **Categories**: rendered as labeled sections within the grid (Canvas, Workshop, Ascension, School & Office, Secrets)
- **Header**: achievement count (`N / total completed`) + total PM earned from achievements
- **Filter bar**: chip buttons to filter by category
- **Hover (InfoPanel)**: title, description, rewards. No progress bar shown (hidden until completed, so in-progress state is invisible to the player)

---

## 9. Achievement Designer (`/dev/achievement-designer`)

Same scaffolding pattern as `/dev/skill-designer` and `/dev/school-designer`.

- Left panel: list of all achievements, "New Achievement" button
- Right panel form:
  - `id`, `name`, `description`, `icon` (emoji input), `category` (dropdown)
  - **Condition builder**: stat dropdown (all available `lifetime.*` and `run.*` keys) + operator dropdown + numeric value field. Below: live display of the current stat value in the active game session ("current value: 847") to assist calibration
  - **Effects builder**: list of `kind + value` rows, "Add effect" button. Same kind vocabulary as school researches
  - **"Test fire" button**: forces the achievement to complete in dev mode (bypasses condition check), triggers notification and applies rewards — for testing the full pipeline without grinding
- Save: writes `achievementsDesign.json`, hot-reloads `ACHIEVEMENTS` config
- No in-designer delete (set to a never-reachable condition instead, same discipline as school)

---

## 10. Save schema

New save version. Three new persisted fields:

| Field | Slice | Survives ascend? |
|---|---|---|
| `completedAchievements` | `achievementSlice` | Yes |
| `statsLifetime` | `statsSlice` | Yes |
| `statsRun` | `statsSlice` | No — reset by `resetRunStats()` in ascend orchestrator |

`activeNotification` and `notificationQueue` are transient — excluded from `partialize`.

Save migration: not required (game not in production — start fresh).

---

## 11. Out of scope

- Compound conditions (AND/OR across multiple stats) — deferred
- `pmMult` curve rebalancing — deferred to a future balance pass
- Visible locked achievements / progress bars for incomplete achievements — all hidden until done
- Achievement rarity tiers — content design concern, not engine concern; the designer's `effects` weights handle it implicitly

---

## 12. Definition of done

1. `statsSlice` tracking all `lifetime.*` and `run.*` fields, incremented at all call sites, `resetRunStats()` wired into ascend orchestrator.
2. `achievementSlice` with `completedAchievements` persisted, `evaluateAchievements()` called from all event sites, FIFO notification queue.
3. `getAchievementBonus(state, kind)` in `multipliers.ts`, wired into all existing multiplier getters.
4. `paint_mastery_flat` credited one-shot on achievement completion.
5. PM passive drip removed from `canvasTick`.
6. Achievements tab renders completed achievements only, organized by category with filter bar.
7. InfoPanel notification mode: rainbow title, animated text, 5s duration, FIFO queue.
8. `/dev/achievement-designer` operational: create/edit achievements, live stat preview, test fire.
9. At least 20 authored achievements in `achievementsDesign.json` covering all 5 categories, including ≥3 secrets.
10. Vitest tests: stats increment correctly, `evaluateAchievements` fires on threshold cross, PM flat credited once not twice, `resetRunStats` resets only `run.*`, `completedAchievements` survives ascend.
