# Achievement Designer — Collapsible Groups & DnD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group achievements in `/dev/achievement-designer` by category with collapsible headers (all collapsed by default, no persistence) and let the user reorder achievements within a category by drag-and-drop.

**Architecture:** Keep `DesignFile` as a flat ordered array; derive groups at render time via a pure `groupByCategory` helper. Wrap the whole content in one `<DndContext>` (from `@dnd-kit/core`) with one `<SortableContext>` per group (from `@dnd-kit/sortable`). A new `moveAchievement(id, toIndex)` action on the existing hook performs the flat-array reorder. `onDragEnd` enforces same-category-only by checking both items' categories and no-op'ing cross-group drops.

**Tech Stack:** React 19 + TypeScript strict + Vite + Vitest + `@dnd-kit/core` ^6.x + `@dnd-kit/sortable` ^10.x (new — picked up from current `latest` at install time). Uses existing Tailwind 4 + `*.module.css` patterns in `src/dev/achievement-designer/`.

**Spec:** `docs/superpowers/specs/2026-05-20-achievement-designer-groups-dnd-design.md`

---

## File Structure

**New files:**
- `src/dev/achievement-designer/groupByCategory.ts` — pure helper that takes `DesignFile` and returns groups in first-occurrence-of-category order.
- `src/dev/achievement-designer/SortableCard.tsx` — extracts the per-achievement card from the current inline render; adds `useSortable` wiring and a grip cell.
- `src/dev/achievement-designer/CategoryGroup.tsx` — header (chevron + name + count, whole row is the toggle) plus a body that, when expanded, hosts a `<SortableContext>` over the group's cards.
- `tests/dev/achievement-designer/` — new directory mirroring the source.
  - `groupByCategory.test.ts`
  - `useAchievementDesignerState.test.ts` (just for the new `moveAchievement` action)
  - `AchievementDesignerRoute.test.tsx`

**Modified files:**
- `package.json` — add `@dnd-kit/core` and `@dnd-kit/sortable` to `dependencies`.
- `src/dev/achievement-designer/useAchievementDesignerState.ts` — add `moveAchievement` action and expose it.
- `src/dev/achievement-designer/AchievementDesignerRoute.tsx` — replace the inline `design.map(...)` block with `groupByCategory(design).map(...)` rendering `<CategoryGroup>`s; wrap content in `<DndContext>`; manage `expanded: Set<string>` state.
- `src/dev/achievement-designer/AchievementDesignerRoute.module.css` — new styles for the group header (chevron + count badge), the grip cell, and the dragging-state opacity.

---

## Task 1: Install dependencies and write `groupByCategory` helper

**Files:**
- Modify: `package.json`
- Create: `src/dev/achievement-designer/groupByCategory.ts`
- Test: `tests/dev/achievement-designer/groupByCategory.test.ts`

- [ ] **Step 1: Install the two @dnd-kit packages**

Run:
```bash
npm install --save @dnd-kit/core @dnd-kit/sortable
```

Expected: Both packages added to `dependencies` in `package.json`; `@dnd-kit/utilities` appears as a transitive in `package-lock.json`. No peer-dependency warnings.

- [ ] **Step 2: Create the test directory and write the failing test**

Create `tests/dev/achievement-designer/groupByCategory.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { groupByCategory } from "@/dev/achievement-designer/groupByCategory";
import type { DesignAchievement, DesignFile } from "@/dev/achievement-designer/types";

function ach(id: string, category: DesignAchievement["category"]): DesignAchievement {
  return {
    id,
    name: id,
    description: "",
    icon: "",
    category,
    condition: { stat: "x", op: ">=", value: 0 },
    effects: [],
  };
}

describe("groupByCategory", () => {
  it("returns an empty array for empty input", () => {
    expect(groupByCategory([] as DesignFile)).toEqual([]);
  });

  it("returns one group when all achievements share a category", () => {
    const design: DesignFile = [ach("a", "canvas"), ach("b", "canvas"), ach("c", "canvas")];
    const groups = groupByCategory(design);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.category).toBe("canvas");
    expect(groups[0]!.achievements.map((a) => a.id)).toEqual(["a", "b", "c"]);
  });

  it("preserves first-occurrence order of categories", () => {
    const design: DesignFile = [
      ach("a", "canvas"),
      ach("b", "secret"),
      ach("c", "canvas"),
      ach("d", "workshop"),
      ach("e", "secret"),
    ];
    const groups = groupByCategory(design);
    expect(groups.map((g) => g.category)).toEqual(["canvas", "secret", "workshop"]);
  });

  it("preserves flat-array order within each group", () => {
    const design: DesignFile = [
      ach("a", "canvas"),
      ach("b", "secret"),
      ach("c", "canvas"),
      ach("d", "canvas"),
    ];
    const groups = groupByCategory(design);
    expect(groups[0]!.achievements.map((a) => a.id)).toEqual(["a", "c", "d"]);
    expect(groups[1]!.achievements.map((a) => a.id)).toEqual(["b"]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:
```bash
npx vitest run tests/dev/achievement-designer/groupByCategory.test.ts
```

Expected: FAIL with module-resolution error ("Cannot find module '@/dev/achievement-designer/groupByCategory'") — the source file doesn't exist yet.

- [ ] **Step 4: Implement `groupByCategory`**

Create `src/dev/achievement-designer/groupByCategory.ts`:

```ts
import type { DesignAchievement, DesignFile, AchievementCategory } from "./types";

export interface CategoryGroup {
  readonly category: AchievementCategory;
  readonly achievements: ReadonlyArray<DesignAchievement>;
}

/**
 * Groups achievements by category. Categories appear in first-occurrence
 * order (the order in which each category's first achievement appears in
 * the flat input). Achievements within a group are in flat-array order.
 *
 * Empty input → empty output. Empty categories are not represented — only
 * categories with at least one achievement get a group.
 */
export function groupByCategory(design: DesignFile): ReadonlyArray<CategoryGroup> {
  const byCategory = new Map<AchievementCategory, DesignAchievement[]>();
  for (const a of design) {
    const existing = byCategory.get(a.category);
    if (existing) {
      existing.push(a);
    } else {
      byCategory.set(a.category, [a]);
    }
  }
  return Array.from(byCategory.entries()).map(([category, achievements]) => ({
    category,
    achievements,
  }));
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```bash
npx vitest run tests/dev/achievement-designer/groupByCategory.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/dev/achievement-designer/groupByCategory.ts tests/dev/achievement-designer/groupByCategory.test.ts
git commit -m "$(cat <<'EOF'
feat(dev): add @dnd-kit deps and groupByCategory helper for designer grouping

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add `moveAchievement` action to the hook

**Files:**
- Modify: `src/dev/achievement-designer/useAchievementDesignerState.ts`
- Test: `tests/dev/achievement-designer/useAchievementDesignerState.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/dev/achievement-designer/useAchievementDesignerState.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAchievementDesignerState } from "@/dev/achievement-designer/useAchievementDesignerState";
import type { DesignAchievement, DesignFile } from "@/dev/achievement-designer/types";

function ach(id: string, category: DesignAchievement["category"] = "canvas"): DesignAchievement {
  return {
    id,
    name: id,
    description: "",
    icon: "",
    category,
    condition: { stat: "x", op: ">=", value: 0 },
    effects: [],
  };
}

describe("useAchievementDesignerState — moveAchievement", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function setup(design: DesignFile) {
    const hook = renderHook(() => useAchievementDesignerState());
    act(() => hook.result.current.actions.importDesign(design));
    return hook;
  }

  it("moves an achievement to a later index", () => {
    const { result } = setup([ach("a"), ach("b"), ach("c"), ach("d")]);
    act(() => result.current.actions.moveAchievement("a", 2));
    expect(result.current.design.map((a) => a.id)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves an achievement to an earlier index", () => {
    const { result } = setup([ach("a"), ach("b"), ach("c"), ach("d")]);
    act(() => result.current.actions.moveAchievement("d", 1));
    expect(result.current.design.map((a) => a.id)).toEqual(["a", "d", "b", "c"]);
  });

  it("is a no-op when moving to the same index", () => {
    const before: DesignFile = [ach("a"), ach("b"), ach("c")];
    const { result } = setup(before);
    act(() => result.current.actions.moveAchievement("b", 1));
    expect(result.current.design.map((a) => a.id)).toEqual(["a", "b", "c"]);
  });

  it("is a no-op when the id is unknown", () => {
    const { result } = setup([ach("a"), ach("b")]);
    act(() => result.current.actions.moveAchievement("ghost", 0));
    expect(result.current.design.map((a) => a.id)).toEqual(["a", "b"]);
  });

  it("clamps toIndex below 0 to 0", () => {
    const { result } = setup([ach("a"), ach("b"), ach("c")]);
    act(() => result.current.actions.moveAchievement("c", -5));
    expect(result.current.design.map((a) => a.id)).toEqual(["c", "a", "b"]);
  });

  it("clamps toIndex >= length to the last index", () => {
    const { result } = setup([ach("a"), ach("b"), ach("c")]);
    act(() => result.current.actions.moveAchievement("a", 99));
    expect(result.current.design.map((a) => a.id)).toEqual(["b", "c", "a"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npx vitest run tests/dev/achievement-designer/useAchievementDesignerState.test.ts
```

Expected: FAIL — `result.current.actions.moveAchievement` is undefined.

- [ ] **Step 3: Add the action to the hook**

Modify `src/dev/achievement-designer/useAchievementDesignerState.ts`:

a) Extend the `AchievementDesignerActions` interface with:

```ts
  moveAchievement: (id: string, toIndex: number) => void;
```

(Insert it in the interface, before `importDesign`.)

b) Add the implementation inside the hook body, near the other `useCallback` actions (e.g. just before `resetAll`):

```ts
  const moveAchievement = useCallback((id: string, toIndex: number) => {
    setDesign((d) => {
      const currentIndex = d.findIndex((a) => a.id === id);
      if (currentIndex === -1) return d;
      const clamped = Math.max(0, Math.min(toIndex, d.length - 1));
      if (clamped === currentIndex) return d;
      const next = d.slice();
      const [moved] = next.splice(currentIndex, 1);
      next.splice(clamped, 0, moved!);
      return next;
    });
  }, []);
```

c) Include `moveAchievement` in the `actions` object returned by the hook:

```ts
    actions: {
      addAchievement,
      deleteAchievement,
      updateAchievement,
      addEffect,
      updateEffect,
      deleteEffect,
      moveAchievement,
      resetAll,
      importDesign,
    },
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
npx vitest run tests/dev/achievement-designer/useAchievementDesignerState.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: Run the full test suite + typecheck**

Run:
```bash
npx vitest run && npx tsc --noEmit
```

Expected: All tests pass; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add src/dev/achievement-designer/useAchievementDesignerState.ts tests/dev/achievement-designer/useAchievementDesignerState.test.ts
git commit -m "$(cat <<'EOF'
feat(dev): add moveAchievement action to achievement designer hook

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Extract `SortableCard` component (pure refactor, no behavior change)

**Files:**
- Create: `src/dev/achievement-designer/SortableCard.tsx`
- Modify: `src/dev/achievement-designer/AchievementDesignerRoute.tsx`

This task is a pure structural refactor: lift the existing inline card rendering (the JSX inside `design.map((ach, i) => ...)`) into a standalone component. No `useSortable`, no grip cell yet — those go in Task 5. After this task the page still renders one flat list of cards exactly like before.

- [ ] **Step 1: Create `SortableCard.tsx` with the existing card markup**

Create `src/dev/achievement-designer/SortableCard.tsx`:

```tsx
import type { JSX } from "react";
import type { DesignAchievement, DesignCondition, AchievementOp } from "./types";
import styles from "./AchievementDesignerRoute.module.css";

const KNOWN_EFFECT_KINDS = [
  "paint_mastery_flat",
  "canvas_gold_pct",
  "speed_pct",
  "inspi_pct",
];

const CATEGORIES = ["canvas", "workshop", "ascension", "school_office", "secret"] as const;

const CONDITION_RE = /^(.+?)\s*(>=|<=|==|>|<)\s*(-?\d+(?:\.\d+)?)$/;

function formatCondition(c: DesignCondition): string {
  return `${c.stat} ${c.op} ${c.value}`;
}

function parseCondition(text: string): DesignCondition | null {
  const m = text.trim().match(CONDITION_RE);
  if (!m) return null;
  return { stat: m[1]!.trim(), op: m[2]! as AchievementOp, value: Number(m[3]!) };
}

function ConditionInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (text: string, parsed: DesignCondition | null) => void;
}): JSX.Element {
  const valid = parseCondition(value) !== null;
  return (
    <input
      className={`${styles.input} ${styles.inputCondition}${valid ? "" : ` ${styles.inputInvalid}`}`}
      value={value}
      placeholder="stat >= value  (e.g. lifetime.canvasesSold >= 10)"
      onChange={(e) => onChange(e.target.value, parseCondition(e.target.value))}
    />
  );
}

export interface SortableCardProps {
  ach: DesignAchievement;
  effectKindOptions: ReadonlyArray<string>;
  onMarkDirty: () => void;
  onUpdateAchievement: (id: string, patch: Partial<Omit<DesignAchievement, "effects">>) => void;
  onDeleteAchievement: (id: string) => void;
  onAddEffect: (achievementId: string) => void;
  onUpdateEffect: (achievementId: string, effectId: string, patch: Partial<{ kind: string; value: number }>) => void;
  onDeleteEffect: (achievementId: string, effectId: string) => void;
}

export function SortableCard({
  ach,
  effectKindOptions,
  onMarkDirty,
  onUpdateAchievement,
  onDeleteAchievement,
  onAddEffect,
  onUpdateEffect,
  onDeleteEffect,
}: SortableCardProps): JSX.Element {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <input
          className={`${styles.input} ${styles.inputIcon}`}
          value={ach.icon}
          placeholder="icon"
          onChange={(e) => { onMarkDirty(); onUpdateAchievement(ach.id, { icon: e.target.value }); }}
        />
        <input
          className={`${styles.input} ${styles.inputId}`}
          value={ach.id}
          placeholder="id"
          onChange={(e) => { onMarkDirty(); onUpdateAchievement(ach.id, { id: e.target.value }); }}
        />
        <input
          className={`${styles.input} ${styles.inputName}`}
          value={ach.name}
          placeholder="Name"
          onChange={(e) => { onMarkDirty(); onUpdateAchievement(ach.id, { name: e.target.value }); }}
        />
        <select
          className={styles.select}
          value={ach.category}
          onChange={(e) => { onMarkDirty(); onUpdateAchievement(ach.id, { category: e.target.value as typeof ach.category }); }}
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          className={styles.deleteBtn}
          onClick={() => { onMarkDirty(); onDeleteAchievement(ach.id); }}
          type="button"
          title="Delete achievement"
        >
          ✕
        </button>
      </div>

      <div className={styles.descRow}>
        <input
          className={`${styles.input} ${styles.inputDesc}`}
          value={ach.description}
          placeholder="Description"
          onChange={(e) => { onMarkDirty(); onUpdateAchievement(ach.id, { description: e.target.value }); }}
        />
      </div>

      <div className={styles.conditionRow}>
        <span className={styles.conditionLabel}>if</span>
        <ConditionInput
          value={ach.conditionText ?? formatCondition(ach.condition)}
          onChange={(text, parsed) => {
            onMarkDirty();
            onUpdateAchievement(ach.id, {
              conditionText: text,
              ...(parsed ? { condition: parsed } : {}),
            });
          }}
        />
      </div>

      <div className={styles.effects}>
        {ach.effects.map((effect) => {
          const isCustomKind = !KNOWN_EFFECT_KINDS.includes(effect.kind);
          return (
            <div key={effect.id} className={styles.effectRow}>
              <select
                className={styles.effectKindSelect}
                value={isCustomKind ? "__custom__" : effect.kind}
                onChange={(e) => {
                  onMarkDirty();
                  const v = e.target.value;
                  const newKind = v === "__custom__" ? "" : v;
                  onUpdateEffect(ach.id, effect.id, { kind: newKind });
                }}
              >
                {effectKindOptions.map((k) => <option key={k} value={k}>{k}</option>)}
                <option value="__custom__">custom…</option>
              </select>
              {isCustomKind && (
                <input
                  className={`${styles.input} ${styles.effectKindInput}`}
                  type="text"
                  value={effect.kind}
                  placeholder="effect kind"
                  onChange={(e) => { onMarkDirty(); onUpdateEffect(ach.id, effect.id, { kind: e.target.value }); }}
                />
              )}
              <input
                className={`${styles.input} ${styles.effectValueInput}`}
                type="number"
                step="0.01"
                value={effect.value}
                title="Value (0.15 = 15%)"
                onChange={(e) => { onMarkDirty(); onUpdateEffect(ach.id, effect.id, { value: Number(e.target.value) }); }}
              />
              <button
                className={styles.effectDelete}
                type="button"
                onClick={() => { onMarkDirty(); onDeleteEffect(ach.id, effect.id); }}
              >
                ✕
              </button>
            </div>
          );
        })}
        <button
          className={styles.addEffectBtn}
          type="button"
          onClick={() => { onMarkDirty(); onAddEffect(ach.id); }}
        >
          + effect
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Refactor `AchievementDesignerRoute.tsx` to use `SortableCard`**

Replace the file with:

```tsx
import type { JSX } from "react";
import { useState, useCallback } from "react";
import { useAchievementDesignerState } from "./useAchievementDesignerState";
import { DevTabBar } from "../DevTabBar";
import { saveToFile } from "./api";
import { SortableCard } from "./SortableCard";
import styles from "./AchievementDesignerRoute.module.css";

type Status = "saved" | "dirty" | "saving";

const KNOWN_EFFECT_KINDS = [
  "paint_mastery_flat",
  "canvas_gold_pct",
  "speed_pct",
  "inspi_pct",
];

export function AchievementDesignerRoute(): JSX.Element {
  const { design, actions } = useAchievementDesignerState();
  const [status, setStatus] = useState<Status>("saved");

  const usedKinds = new Set(design.flatMap((a) => a.effects.map((e) => e.kind)));
  const effectKindOptions = [...new Set([...KNOWN_EFFECT_KINDS, ...usedKinds])].filter((k) => k !== "");

  const markDirty = useCallback(() => setStatus("dirty"), []);

  const handleSave = useCallback(async () => {
    setStatus("saving");
    const result = await saveToFile(design);
    setStatus(result.ok ? "saved" : "dirty");
  }, [design]);

  return (
    <div className={styles.layout}>
      <div className={styles.topBar}>
        <span className={styles.title}>Achievement Designer</span>
        <span className={
          status === "saved" ? styles.statusSaved :
          status === "saving" ? styles.statusSaving :
          styles.statusDirty
        }>
          {status === "saved" ? "Saved" : status === "saving" ? "Saving…" : "Unsaved changes"}
        </span>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={handleSave}
          type="button"
        >
          Save to file
        </button>
        <button
          className={styles.btn}
          onClick={() => { actions.resetAll(); setStatus("saved"); }}
          type="button"
        >
          Reset
        </button>
      </div>
      <DevTabBar />

      <div className={styles.content}>
        {design.map((ach) => (
          <SortableCard
            key={ach.id}
            ach={ach}
            effectKindOptions={effectKindOptions}
            onMarkDirty={markDirty}
            onUpdateAchievement={actions.updateAchievement}
            onDeleteAchievement={actions.deleteAchievement}
            onAddEffect={actions.addEffect}
            onUpdateEffect={actions.updateEffect}
            onDeleteEffect={actions.deleteEffect}
          />
        ))}

        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          type="button"
          onClick={() => { markDirty(); actions.addAchievement(); }}
        >
          + Achievement
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and run full test suite**

Run:
```bash
npx tsc --noEmit && npx vitest run
```

Expected: typecheck clean; all 858+ tests pass.

- [ ] **Step 4: Manual smoke test**

Open http://localhost:5173/dev/achievement-designer. Confirm: page renders the existing five achievements as a flat list exactly as before, all inputs editable, save button still works.

- [ ] **Step 5: Commit**

```bash
git add src/dev/achievement-designer/SortableCard.tsx src/dev/achievement-designer/AchievementDesignerRoute.tsx
git commit -m "$(cat <<'EOF'
refactor(dev): extract per-card markup into SortableCard component

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add `CategoryGroup` and integrate grouping + collapse into the route

**Files:**
- Create: `src/dev/achievement-designer/CategoryGroup.tsx`
- Modify: `src/dev/achievement-designer/AchievementDesignerRoute.tsx`
- Modify: `src/dev/achievement-designer/AchievementDesignerRoute.module.css`
- Test: `tests/dev/achievement-designer/AchievementDesignerRoute.test.tsx`

After this task the route renders grouped, all-collapsed-by-default headers with chevron + name + count. Clicking a header expands it. DnD is added in Task 5.

- [ ] **Step 1: Add CSS for the group header and expanded/collapsed body**

Append the following rules to `src/dev/achievement-designer/AchievementDesignerRoute.module.css`. (If you're unsure where the file lives or what's in it, read `styles.layout` and `styles.content` first to match indentation/casing.)

```css
.group {
  display: flex;
  flex-direction: column;
  margin-bottom: 0.75rem;
}

.groupHeader {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  cursor: pointer;
  color: inherit;
  font: inherit;
  text-align: left;
  width: 100%;
}

.groupHeader:hover {
  background: rgba(255, 255, 255, 0.07);
}

.groupChevron {
  display: inline-block;
  width: 1rem;
  text-align: center;
  font-size: 0.75rem;
  opacity: 0.7;
}

.groupName {
  font-weight: 600;
  text-transform: capitalize;
}

.groupCount {
  margin-left: auto;
  opacity: 0.6;
  font-size: 0.85em;
}

.groupBody {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0 0.5rem 0.75rem;
}
```

- [ ] **Step 2: Create `CategoryGroup.tsx`**

Create `src/dev/achievement-designer/CategoryGroup.tsx`:

```tsx
import type { JSX, ReactNode } from "react";
import type { AchievementCategory } from "./types";
import styles from "./AchievementDesignerRoute.module.css";

export interface CategoryGroupProps {
  category: AchievementCategory;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function CategoryGroup({
  category,
  count,
  expanded,
  onToggle,
  children,
}: CategoryGroupProps): JSX.Element {
  return (
    <section className={styles.group}>
      <button
        type="button"
        className={styles.groupHeader}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className={styles.groupChevron} aria-hidden="true">{expanded ? "▾" : "▸"}</span>
        <span className={styles.groupName}>{category}</span>
        <span className={styles.groupCount}>({count})</span>
      </button>
      {expanded && <div className={styles.groupBody}>{children}</div>}
    </section>
  );
}
```

- [ ] **Step 3: Update `AchievementDesignerRoute.tsx` to render groups**

Replace the `content` block in `src/dev/achievement-designer/AchievementDesignerRoute.tsx`. Add an import:

```tsx
import { groupByCategory } from "./groupByCategory";
import { CategoryGroup } from "./CategoryGroup";
```

Add the collapse state inside `AchievementDesignerRoute`, before the `handleSave` declaration:

```tsx
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggleCategory = useCallback((category: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);
```

Replace the `<div className={styles.content}> ... </div>` body. New body:

```tsx
      <div className={styles.content}>
        {groupByCategory(design).map((group) => (
          <CategoryGroup
            key={group.category}
            category={group.category}
            count={group.achievements.length}
            expanded={expanded.has(group.category)}
            onToggle={() => toggleCategory(group.category)}
          >
            {group.achievements.map((ach) => (
              <SortableCard
                key={ach.id}
                ach={ach}
                effectKindOptions={effectKindOptions}
                onMarkDirty={markDirty}
                onUpdateAchievement={actions.updateAchievement}
                onDeleteAchievement={actions.deleteAchievement}
                onAddEffect={actions.addEffect}
                onUpdateEffect={actions.updateEffect}
                onDeleteEffect={actions.deleteEffect}
              />
            ))}
          </CategoryGroup>
        ))}

        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          type="button"
          onClick={() => { markDirty(); actions.addAchievement(); }}
        >
          + Achievement
        </button>
      </div>
```

- [ ] **Step 4: Write the route render test**

The hook reads the JSON at module init via `loadFileBaseline()` and **ignores the localStorage draft on load** (by design — see the existing comment in `useAchievementDesignerState.ts`). To get deterministic test fixtures, mock the JSON module with `vi.mock`. This mirrors the pattern used by `tests/store/achievementSlice.test.ts`.

Create `tests/dev/achievement-designer/AchievementDesignerRoute.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock the JSON the designer reads as its baseline. Must be declared BEFORE
// importing the route. Three achievements across two categories:
// 2× canvas, 1× secret. Categories `workshop`, `ascension`, `school_office`
// have no entries and must not render headers.
vi.mock("@/config/achievementsDesign.json", () => ({
  default: [
    { id: "a", name: "A", description: "", icon: "", category: "canvas",
      condition: { stat: "x", op: ">=", value: 0 }, effects: [] },
    { id: "b", name: "B", description: "", icon: "", category: "secret",
      condition: { stat: "x", op: ">=", value: 0 }, effects: [] },
    { id: "c", name: "C", description: "", icon: "", category: "canvas",
      condition: { stat: "x", op: ">=", value: 0 }, effects: [] },
  ],
}));

import { AchievementDesignerRoute } from "@/dev/achievement-designer/AchievementDesignerRoute";

function renderRoute() {
  return render(
    <MemoryRouter>
      <AchievementDesignerRoute />
    </MemoryRouter>,
  );
}

describe("AchievementDesignerRoute — groups", () => {
  it("renders one header per non-empty category", () => {
    renderRoute();
    expect(screen.getByRole("button", { name: /canvas \(2\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /secret \(1\)/i })).toBeInTheDocument();
  });

  it("does not render a header for empty categories", () => {
    renderRoute();
    expect(screen.queryByRole("button", { name: /workshop \(/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ascension \(/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /school_office \(/i })).not.toBeInTheDocument();
  });

  it("starts with all groups collapsed (aria-expanded=false)", () => {
    renderRoute();
    const canvas = screen.getByRole("button", { name: /canvas \(2\)/i });
    const secret = screen.getByRole("button", { name: /secret \(1\)/i });
    expect(canvas.getAttribute("aria-expanded")).toBe("false");
    expect(secret.getAttribute("aria-expanded")).toBe("false");
  });

  it("clicking a header toggles aria-expanded", () => {
    renderRoute();
    const canvas = screen.getByRole("button", { name: /canvas \(2\)/i });
    fireEvent.click(canvas);
    expect(canvas.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(canvas);
    expect(canvas.getAttribute("aria-expanded")).toBe("false");
  });
});
```

- [ ] **Step 5: Run the test**

Run:
```bash
npx vitest run tests/dev/achievement-designer/AchievementDesignerRoute.test.tsx
```

Expected: PASS (4 tests).

- [ ] **Step 6: Run full test suite + typecheck**

Run:
```bash
npx tsc --noEmit && npx vitest run
```

Expected: typecheck clean; all tests pass.

- [ ] **Step 7: Manual smoke test**

Open http://localhost:5173/dev/achievement-designer. Confirm:
- Two collapsed headers visible: `canvas (4)` and `secret (1)` (or whatever current `achievementsDesign.json` contains).
- No cards visible (everything collapsed).
- Click a header → its chevron flips and cards appear below.
- Click again → collapses back.
- "+ Achievement" button still works at the bottom; the new card appears in the `canvas` group (and the header shows up if it was empty).

- [ ] **Step 8: Commit**

```bash
git add src/dev/achievement-designer/CategoryGroup.tsx src/dev/achievement-designer/AchievementDesignerRoute.tsx src/dev/achievement-designer/AchievementDesignerRoute.module.css tests/dev/achievement-designer/AchievementDesignerRoute.test.tsx
git commit -m "$(cat <<'EOF'
feat(dev): group achievement designer by category with collapsible headers

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire `<DndContext>` + `<SortableContext>` + grip cell + onDragEnd

**Files:**
- Modify: `src/dev/achievement-designer/SortableCard.tsx`
- Modify: `src/dev/achievement-designer/CategoryGroup.tsx`
- Modify: `src/dev/achievement-designer/AchievementDesignerRoute.tsx`
- Modify: `src/dev/achievement-designer/AchievementDesignerRoute.module.css`

This is the largest task — it wires DnD end-to-end. After this task, dragging the grip on a card and releasing it elsewhere in the same group reorders the underlying `design` array (visible on save). Cross-group drops are silent no-ops.

- [ ] **Step 1: Add CSS for the grip cell and dragging state**

Append to `src/dev/achievement-designer/AchievementDesignerRoute.module.css`:

```css
.cardWithGrip {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem;
  align-items: stretch;
}

.grip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  cursor: grab;
  user-select: none;
  color: rgba(255, 255, 255, 0.35);
  font-size: 1.1rem;
}

.grip:hover {
  color: rgba(255, 255, 255, 0.7);
}

.grip:active {
  cursor: grabbing;
}

.cardDragging {
  opacity: 0.6;
}
```

- [ ] **Step 2: Add `useSortable` wiring to `SortableCard`**

Modify `src/dev/achievement-designer/SortableCard.tsx`. Add imports at the top (alongside the existing `import type { JSX } from "react";`):

```tsx
import type { CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
```

Inside the `SortableCard` function, just after the props are destructured, add:

```tsx
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ach.id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
```

Then replace the existing outer `<div className={styles.card}>` with a wrapping `<div>` that uses the grip layout. The new top-level JSX:

```tsx
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.cardWithGrip}${isDragging ? ` ${styles.cardDragging}` : ""}`}
    >
      <div className={styles.grip} {...attributes} {...listeners} aria-label="Drag to reorder">
        ⠿
      </div>
      <div className={styles.card}>
        {/* keep the existing card content here — header, descRow, conditionRow, effects */}
      </div>
    </div>
  );
```

Move the existing `<div className={styles.cardHeader}>…</div>` and the three sibling sections (descRow, conditionRow, effects) inside the inner `<div className={styles.card}>`.

- [ ] **Step 3: Wrap each group body in a `<SortableContext>`**

Modify `src/dev/achievement-designer/CategoryGroup.tsx`. Add imports:

```tsx
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
```

Add a new prop to `CategoryGroupProps`:

```tsx
  itemIds: ReadonlyArray<string>;
```

Replace the `{expanded && <div className={styles.groupBody}>{children}</div>}` block with:

```tsx
      {expanded && (
        <div className={styles.groupBody}>
          <SortableContext items={[...itemIds]} strategy={verticalListSortingStrategy}>
            {children}
          </SortableContext>
        </div>
      )}
```

- [ ] **Step 4: Wrap the route content in `<DndContext>` and implement `onDragEnd`**

Modify `src/dev/achievement-designer/AchievementDesignerRoute.tsx`. Add imports:

```tsx
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
```

Inside `AchievementDesignerRoute`, just before the `return`, add:

```tsx
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeAch = design.find((a) => a.id === activeId);
    const overAch = design.find((a) => a.id === overId);
    if (!activeAch || !overAch) return;
    if (activeAch.category !== overAch.category) return;  // within-category only
    const toIndex = design.findIndex((a) => a.id === overId);
    markDirty();
    actions.moveAchievement(activeId, toIndex);
  }, [design, actions, markDirty]);
```

Wrap the existing `<div className={styles.content}>...</div>` block with a `<DndContext>`:

```tsx
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className={styles.content}>
            {/* existing grouped content here */}
          </div>
        </DndContext>
```

Pass the new `itemIds` prop when rendering each `<CategoryGroup>`:

```tsx
        {groupByCategory(design).map((group) => (
          <CategoryGroup
            key={group.category}
            category={group.category}
            count={group.achievements.length}
            expanded={expanded.has(group.category)}
            onToggle={() => toggleCategory(group.category)}
            itemIds={group.achievements.map((a) => a.id)}
          >
            {/* …SortableCards as before… */}
          </CategoryGroup>
        ))}
```

- [ ] **Step 5: Typecheck**

Run:
```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 6: Run the full test suite**

Run:
```bash
npx vitest run
```

Expected: all tests pass. The existing `AchievementDesignerRoute.test.tsx` route tests still work because `aria-expanded` and header text are untouched. There is no JSDOM coverage of actual drag mechanics — that's covered by the manual smoke test next.

- [ ] **Step 7: Manual smoke test**

Open http://localhost:5173/dev/achievement-designer. Confirm:
- Expand the `canvas` group. Each card has a `⠿` grip on the left.
- Hover over the grip → cursor becomes `grab`.
- Press-and-hold the grip and drag a card up/down inside the `canvas` group. Other cards animate to make room. Release → card lands at the new position, the rest settle.
- Try dragging a `canvas` card down past the `secret` header. Cards in `secret` should not move; release → dragged card snaps back to its origin in `canvas`.
- Click `Save to file`. Open `src/config/achievementsDesign.json` in a separate tab — the array should now reflect the new in-group order. (Other-category cards untouched.)
- Try dragging on an input field (icon, name, etc.) — drag should NOT activate; clicking/selecting text in the input works normally.

If anything is wrong: re-check `activationConstraint`, `setNodeRef` placement, and that `listeners` are on the grip cell ONLY (not the whole card).

- [ ] **Step 8: Final full-suite check + typecheck**

Run:
```bash
npx tsc --noEmit && npx vitest run
```

Expected: typecheck clean; all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/dev/achievement-designer/SortableCard.tsx src/dev/achievement-designer/CategoryGroup.tsx src/dev/achievement-designer/AchievementDesignerRoute.tsx src/dev/achievement-designer/AchievementDesignerRoute.module.css
git commit -m "$(cat <<'EOF'
feat(dev): wire @dnd-kit sortable for within-category reorder in achievement designer

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Verification checklist (post-implementation)

After all five tasks land, verify the feature end-to-end:

1. `/dev/achievement-designer` loads with both `canvas` and `secret` headers visible, both collapsed, no cards rendered.
2. Clicking either header expands it; clicking again collapses.
3. Within an expanded group, dragging a card by its grip reorders other cards smoothly; release commits the move.
4. Cross-group drag attempts silently snap back.
5. `Save to file` writes the new order to `achievementsDesign.json` (verify with `git diff src/config/achievementsDesign.json`).
6. Game state at `/painting` is untouched throughout (per the JSON-decoupled architecture from the previous session — saving a designer file should NOT cause the game to reload or revert).
7. `npx vitest run` shows 0 failures.
8. `npx tsc --noEmit` is clean.
