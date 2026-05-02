# UI Patterns

How React + Zustand views in this codebase interact with the store.

## Subscription rule

**Views must subscribe to every store field they read, even when the read is via a helper or `getState()`. Use `getState()` only in event handlers (post-click), never during render.**

### Why

Zustand re-renders a component when one of its subscribed selectors returns a new value. If a view reads field X via a helper `foo(state)` but doesn't subscribe to X, the view's UI will go stale when X changes — the helper sees the new value on the next render, but no re-render is scheduled, so the next render never happens.

In Phase 4 this footgun was latent: each view is the only one mounted at a time, and other store updates (currency tick) re-render the view anyway, masking the bug. Once Phase 5 introduces the Workshop popup (a second mounted component above PaintingView), and once future phases add multi-pane layouts, missing subscriptions WILL cause visible staleness — e.g., crafting an item updates `inventory` in the popup, but if PaintingView's `equipped` list doesn't subscribe to `equippedItems`, the equip click won't update the visible list under the popup.

### Pattern

Subscribe to every field individually, then call helpers with a constructed object containing those fields:

```tsx
import { useGameStore } from "@/store";
import type { GameStore } from "@/store";

export function AscensionView(): JSX.Element {
  const inspiration = useGameStore((s) => s.inspiration);
  const ascendCount = useGameStore((s) => s.ascendCount);
  const purchasedNodes = useGameStore((s) => s.purchasedNodes);

  // Helpers expect GameStore; pass fields they actually read.
  // Cast is intentional and safe — the helper only accesses the fields
  // present on the constructed object.
  const helperState = {
    inspiration,
    ascendCount,
    purchasedNodes,
  } as unknown as GameStore;
  const palier = getEffectivePalier(helperState, ascendCount);
  const canDo = canAscend(helperState);
  // …
}
```

The cast (`as unknown as GameStore`) acknowledges the type narrowing: TypeScript can't prove `{ inspiration, ascendCount, purchasedNodes }` is assignable to the wider `GameStore`. The cast is safe because the helper only accesses the listed fields. To know which fields a helper reads, look at the helper body — they're a few lines each.

When adding or modifying a view, audit every helper call: list the fields the helper reads, then ensure each is subscribed at the top of the component.

### Don't

```tsx
// BAD: getState() in render. Subscriptions opaque, future readers will miss them,
// and additions to the helper's reads silently break the view.
const fullState = useGameStore.getState();
const palier = getEffectivePalier(fullState, ascendCount);
```

```tsx
// BAD: subscribing to whole store, re-renders on every change to anything.
const state = useGameStore();
```

### Event handlers are different

Inside `onClick` / `onChange` / etc., `getState()` is the right tool: the handler runs at user-action time, reads the current state, dispatches an action. No subscription is needed because the handler doesn't drive rendering.

```tsx
const buyPartLevel = useGameStore((s) => s.buyPartLevel);
return <button onClick={() => buyPartLevel("seed_root")}>Buy</button>;
```

If the handler also needs to read state (e.g., to compute a value before dispatching), use `useGameStore.getState()` inside the handler body — that's idiomatic.

### Helper-signature refactor (deferred)

Helpers in `src/core/multipliers.ts`, `src/store/treeSlice.ts`, `src/store/workshopSlice.ts`, and `src/systems/ascend.ts` currently take `GameStore`. They could be narrowed to `Pick<GameStore, K>` of the fields they actually read, eliminating the `as unknown as GameStore` cast at view call sites. This is a backwards-compatible refactor (slices passing `GameStore` continue to work via structural typing). Deferred until a phase makes it natural to touch each helper file.

## Canonical example

`src/ui/views/SkillTreeView.tsx` — subscribes to `fame`, `purchasedNodes`, `buyNode` and inlines the per-node gating logic without any helper-state cast. Use as the reference pattern when a view's logic is simple enough to inline; use the cast pattern (above) when the view needs to call a helper that takes `GameStore`.
