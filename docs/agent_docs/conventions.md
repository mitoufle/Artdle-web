# Conventions

Coding conventions and discipline for this codebase.

## TypeScript

**Strict mode is non-negotiable.** `tsconfig.app.json` enables:
- `strict: true`
- `noUncheckedIndexedAccess: true` — array/dict access returns `T | undefined`. Use `arr[i]!` only when the index is provably in range; otherwise narrow first.
- `exactOptionalPropertyTypes: true` — `{ x?: string }` is NOT assignable from `{ x: undefined }`.
- `noImplicitOverride: true` — explicit `override` keyword on subclass methods.
- `verbatimModuleSyntax: true` — type-only imports MUST use `import type { Foo }`.

**Run `npx tsc -b --noEmit`** before assuming anything compiles. Don't trust ESLint to catch type errors.

## File structure

- `src/` for source, `tests/` for tests, mirroring structure.
- `@/` alias resolves to `src/` (defined in `vite.config.ts` and `tsconfig.app.json`).
- One file per logical concern. Don't dump.
- Filenames: `camelCase.ts` for non-React, `PascalCase.tsx` for React components.
- Type-only files (interfaces, types) co-locate with their primary user; don't create a global `types.ts`.

## Slice anatomy

Every Zustand slice follows this shape:

```ts
import type { StateCreator } from "zustand";

// 1. State interface (data only)
export interface FooState {
  fooValue: number;
}

// 2. Actions interface, extending state
export interface FooSlice extends FooState {
  doFooThing: () => void;
}

// 3. Initial state object
const initialState: FooState = { fooValue: 0 };

// 4. Slice creator
export const createFooSlice: StateCreator<FooSlice, [], [], FooSlice> = (set, get) => ({
  ...initialState,
  doFooThing: () => set({ fooValue: get().fooValue + 1 }),
});
```

**Cross-slice access:** type the `StateCreator` over the full `GameStore` when a slice needs to read other slices.

```ts
import type { StateCreator } from "zustand";
import type { GameStore } from "./index";

export const createFooSlice: StateCreator<GameStore, [], [], FooSlice> = (set, get) => ({
  // get().gold — typed access to currency slice
});
```

## Tests

**TDD by default.** Test first, fail it, implement, pass it, commit.

**Vitest patterns:**

```ts
import { describe, it, expect, beforeEach } from "vitest";

describe("featureName", () => {
  beforeEach(() => {
    // reset state, set RNG seed, etc.
  });

  it("does the thing", () => {
    expect(actual).toBe(expected);
  });
});
```

**Test boundaries:**
- **Unit tests:** pure functions in `src/core/`, slice actions in isolation. Fast (~ms), no IDB, no DOM.
- **Integration tests:** full store with persist, slice interactions. Use `fake-indexeddb` (auto-loaded via `vitest.setup.ts`).
- **Component tests:** sparse — only when a component has non-trivial logic. Use `@testing-library/react`.

**Formula testing rule:** every formula in `src/core/balance.ts` has tests at:
- the base case (count = 0)
- one or more growth points
- an edge case (zero, negative, very large)

**RNG-touching tests:** `setSeed(42)` in `beforeEach` for determinism.

**Don't test framework code.** Trust that Zustand `set` works, React renders, IDB stores. Test *your* logic.

**RTL auto-cleanup:** with `@testing-library/react` 16 + Vitest globals, components rendered via `render()` are unmounted automatically between tests. Don't write `afterEach(cleanup)` blocks — they're redundant.

**`@testing-library/jest-dom` matchers** (`toBeInTheDocument`, `toBeDisabled`, `toHaveTextContent`, etc.) are loaded by `vitest.setup.ts`. Under `verbatimModuleSyntax`, the matcher types must be in `tsconfig.app.json`'s `types` array as `@testing-library/jest-dom/vitest`; without it, type-checking UI tests fails. Already wired since Phase 4.

**UI test pattern:** see `docs/agent_docs/ui-patterns.md` for view subscription rules; tests inherit the same model — `useGameStore.setState(...)` in `beforeEach` to seed, render, assert on DOM.

## Imports

```ts
// 1. external packages
import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";

// 2. internal — absolute via @/ alias
import { big } from "@/core/bigNumber";
import { useGameStore } from "@/store";

// 3. relative — only for sibling files in the same module
import { createFooSlice } from "./fooSlice";

// 4. type-only imports go separately or use `import type`
import type { Big } from "@/core/bigNumber";
```

**Don't import from index barrels for types** (`import type { Big } from "@/core";`) — go to the source file. Verbatim module syntax means the dead path matters.

## Comments

**Default to writing none.** Code that needs explanation usually needs better names.

**When to write a comment:**
- Non-obvious WHY (constraint, invariant, workaround for a specific bug, surprising behavior)
- Tuning constants in `balance.ts` — note units (`// seconds`, `// gold/sec`, `// per-level multiplier`)

**When NOT to write a comment:**
- Restating WHAT the code does
- "Used by" / "called from" pointers (rot fast)
- Task-specific context ("added for issue #42", "fix for the X bug") — that goes in commit messages

## Commits

**Conventional prefixes:**
- `feat:` — new user-facing feature
- `fix:` — user-facing bug fix
- `core:` — change in `src/core/`
- `store:` — change in `src/store/`
- `ui:` — change in `src/ui/`
- `test:` — test-only change
- `docs:` — docs-only change
- `config:` — config files (tsconfig, eslint, vite, tailwind)
- `deps:` — dependency changes
- `refactor:` — restructuring without behavior change

**Scope (optional):** `core(balance):`, `store(currency):`, `ui(workshop):`.

**Body:** explain the WHY. The diff shows the what.

**Frequency:** at the end of every plan task step, often once per logical change. Don't let WIP pile up across multiple concerns.

**Never `--amend`** unless the user explicitly asks. New commit always.

**Never `--no-verify`.** If a hook fails, fix the underlying issue.

## Linting + formatting

```bash
npm run lint          # ESLint
npm run format        # Prettier (writes)
```

Run before committing. The plan's task verification steps catch lint issues; don't skip.

## Don't

- Don't add features beyond what the current task requires.
- Don't preemptively abstract. Three duplicated lines beat a premature interface.
- Don't add error handling for impossible cases. Trust internal code.
- Don't add backwards-compat shims for code that isn't shipped yet.
- Don't write planning documents that the user didn't ask for.
- Don't auto-generate CLAUDE.md or any agent doc.
- Don't replace linters with prose instructions.
