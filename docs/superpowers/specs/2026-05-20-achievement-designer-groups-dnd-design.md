# Achievement Designer — Collapsible Groups & Drag-to-Reorder

Date: 2026-05-20
Scope: `src/dev/achievement-designer/` only (dev tool, not player-facing).

## Goal

The achievement designer currently renders one flat list of cards. As the catalog grows, this becomes hard to scan. Two affordances to add:

1. **Group by category** with a collapsible header per group (5 categories total: `canvas`, `workshop`, `ascension`, `school_office`, `secret`).
2. **Drag-and-drop reorder** of achievements within a category.

Goals reuse the existing data model (`DesignFile` is a flat array; array order = display order) and the existing save flow (POST to `/api/achievement-design` writes the array to `achievementsDesign.json`). No schema change.

## Decisions

| Question                                | Choice                                                                                       |
|-----------------------------------------|----------------------------------------------------------------------------------------------|
| Drag scope                              | **Within a category only.** Cross-group drag is a no-op.                                     |
| Collapse default                        | **All categories collapsed on every page load.** No persistence.                             |
| Empty categories                        | **Not rendered.** A category header appears only when ≥ 1 card has that category.            |
| DnD library                             | **`@dnd-kit/core` + `@dnd-kit/sortable`** (~12KB gz, one transitive).                        |
| Drag handle                             | **Dedicated grip cell on the left edge of each card.** Rest of card remains interactive.    |

## Data model

No new fields. `DesignFile` is a flat ordered array of `DesignAchievement` and stays that way. The display grouping is derived at render time:

```ts
function groupByCategory(design: DesignFile): ReadonlyArray<{
  category: DesignAchievement["category"];
  achievements: ReadonlyArray<DesignAchievement>;
}> {
  // Preserve first-occurrence order of categories; within each group preserve flat-array order.
}
```

Within-category reorder is a **flat-array operation**: dragging card B above card A in category X means "in the flat array, move B to the position just before A." Cards in other categories are not touched. A card whose category changes via the existing dropdown stays at its flat-array index — it just visually migrates to the other group because `groupByCategory` now sees it differently.

## Components

```
AchievementDesignerRoute
├── <DndContext> (one, top-level)
│   └── for each group:
│       └── CategoryGroup
│           ├── header (chevron + name + count, whole row is the toggle button)
│           └── body (when expanded):
│               └── <SortableContext items={ids in group}>
│                   └── SortableCard (one per achievement)
│                       ├── grip cell (left, drag listeners attached)
│                       └── existing card body (unchanged)
└── "+ Achievement" button (existing, unchanged behavior)
```

### CategoryGroup (new)

- Props: `category`, `achievements`, `expanded`, `onToggle`, plus the existing per-card callbacks.
- Header: a `<button>` row showing `▸ canvas (4)` when collapsed and `▾ canvas (4)` when expanded. Whole row is the toggle target.
- Body: rendered only when `expanded === true`. Wraps a `<SortableContext>` over the group's achievement IDs.

### SortableCard (new)

- Props: the existing card props.
- Wraps the existing card markup with `useSortable(id)`. Returned `setNodeRef`, `transform`, `transition` are applied to the card root via the `CSS.Transform.toString(transform)` / `transition` style props — this is what gives the smooth follow-the-pointer + shift-others behavior. `attributes` and `listeners` are attached **only** to the grip cell, so clicks on inputs / dropdowns / delete buttons remain normal.
- The dragged card follows the pointer (default @dnd-kit `useSortable` behavior); other cards in the same group animate to make room. While `isDragging`, the dragged card gets `opacity: 0.6` as a visual cue.

### DndContext + sensors

- One `<DndContext>` wraps all groups.
- `sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))` — the 4-px move threshold prevents a click on the grip from immediately starting a drag.
- `onDragEnd(event)`:
  1. If `event.over === null` or `event.active.id === event.over.id` → no-op.
  2. Look up the category of both `active` and `over` in `design`.
  3. If they differ → no-op (enforces within-category-only).
  4. If they match → compute the target's index in the flat `design` array and call `actions.moveAchievement(activeId, toFlatIndex)`.

## New hook action

`useAchievementDesignerState` gains one method:

```ts
moveAchievement(id: string, toIndex: number): void
```

Implementation: find the current index of `id` in `design`. If not found → no-op. Otherwise splice it out and splice it back in at `clamp(toIndex, 0, design.length - 1)`. Pure array reorder; no other fields touched.

The save flow is unchanged — `design` is what gets written. After a reorder, the next save persists the new order.

## Collapse state

```ts
const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
```

- Default: empty set ⇒ every header collapsed.
- Toggle: `setExpanded(s => { const next = new Set(s); next.has(cat) ? next.delete(cat) : next.add(cat); return next; })`.
- No persistence. Tab reload returns to all-collapsed.
- Dead keys (category vanished because all its cards were moved out) are harmless; if the category reappears its key may already be in the set, in which case it loads expanded. Acceptable.

## Edge cases

| Case                                                  | Behavior                                                                                  |
|-------------------------------------------------------|-------------------------------------------------------------------------------------------|
| Drag released over nothing (`over === null`)          | No-op.                                                                                    |
| `active.id === over.id`                               | No-op (no movement).                                                                      |
| Cross-group drag attempt                              | No-op. Dragged card snaps back to its origin. No UI message (silent).                     |
| `moveAchievement` called with unknown id              | No-op.                                                                                    |
| `moveAchievement` called with `toIndex` out of bounds | Clamp to `[0, design.length - 1]`.                                                        |
| Category becomes empty (last card moved out/deleted)  | Group disappears from render. `expanded` Set keeps the dead key (harmless).               |
| Card's category changed via dropdown                  | Migrates to other group on next render; flat-array index unchanged.                       |
| `+ Achievement` button pressed                        | Appends to end of `design`, default category `canvas`. Visible as last card in `canvas` group. |

## Testing

Three new test files under `tests/dev/achievement-designer/`:

1. **`groupByCategory.test.ts`** — pure function:
   - empty input → empty groups
   - single-category input → one group with all members in input order
   - mixed input → groups in first-occurrence order, members in flat-array order
   - all five categories present → all five groups in their first-occurrence order

2. **`moveAchievement.test.ts`** — hook action via the existing harness pattern (mock storage adapter, render hook, exercise actions):
   - move down one position
   - move up one position
   - move to same index → state unchanged
   - unknown id → state unchanged
   - `toIndex < 0` → clamped to 0
   - `toIndex >= length` → clamped to last index

3. **`AchievementDesignerRoute.test.tsx`** — `@testing-library/react` render test:
   - fixture with three cards across two categories → both category headers render
   - both headers start collapsed; no cards visible
   - clicking a header expands it; clicking again collapses
   - count badge matches the number of cards in the group
   - empty category never renders a header

**Not tested in JSDOM**: actual drag mechanics (@dnd-kit needs real pointer events). Covered by manual smoke test post-implementation. The `onDragEnd` logic can be unit-tested in isolation if needed (passing a fake event), but it's small enough that the manual test is sufficient.

## Dependencies

Add to `dependencies` (not `devDependencies` — the designer route ships in the bundle today):

```
@dnd-kit/core      ^6.x
@dnd-kit/sortable  ^8.x
```

Transitive: `@dnd-kit/utilities`. No other new packages.

## Out of scope

- Cross-group DnD that changes category. The dropdown remains the way to change category.
- Persisted collapse state. All collapsed every load.
- Touch / mobile DnD support. Game is desktop-only per `CLAUDE.md`.
- Keyboard reorder (`KeyboardSensor` + `sortableKeyboardCoordinates`). Mouse-only is fine for a dev tool.
- Reordering the runtime `ACHIEVEMENTS` array in `src/config/achievementConfig.ts` based on JSON order. The JSON's order is for the user; wiring order in the TS file is the agent's call. They may drift.
- Visual indication of "you can't drop here" during cross-group drag. Silent snap-back is the chosen UX.
- Skill / school designer DnD. Same pattern would apply but is not part of this scope.

## Files touched

- `src/dev/achievement-designer/useAchievementDesignerState.ts` — add `moveAchievement` action.
- `src/dev/achievement-designer/AchievementDesignerRoute.tsx` — refactor to use `<DndContext>`, render `CategoryGroup`s, manage `expanded` set.
- `src/dev/achievement-designer/CategoryGroup.tsx` — new.
- `src/dev/achievement-designer/SortableCard.tsx` — new (extracts the existing per-card markup from the route).
- `src/dev/achievement-designer/AchievementDesignerRoute.module.css` — new styles for group header, grip cell, drag-state opacity.
- `src/dev/achievement-designer/groupByCategory.ts` — new pure helper.
- `package.json` — add `@dnd-kit/core` and `@dnd-kit/sortable`.
- `tests/dev/achievement-designer/groupByCategory.test.ts` — new.
- `tests/dev/achievement-designer/moveAchievement.test.ts` — new.
- `tests/dev/achievement-designer/AchievementDesignerRoute.test.tsx` — new.
