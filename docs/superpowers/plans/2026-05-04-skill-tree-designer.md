# Skill Tree Designer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an in-app dev tool at `/dev/skill-designer` for authoring the new skill tree (replacing the v1.1 5-node tree). Captures node intent — name, costs, free-text effects, parent links, positions — and saves to `src/config/skillTreeDesign.json` via a Vite dev middleware. Implementation of the resulting design (translating to game code) is a separate later cycle.

**Architecture:** Three-pane editor (left list / center drag-canvas / right form) with localStorage drafts (debounced 500ms) + Save-to-file via a 20-line Vite `configureServer` middleware. The route bypasses the game's shell (no TopBar / BottomBar / InfoPanel) via a top-level conditional in `App.tsx`. Pure-logic modules (types, autoLayout, validation, storage) are unit-tested with Vitest; UI components with React Testing Library.

**Tech Stack:** React 19 + TypeScript strict + Vite + Vitest + RTL + CSS Modules + tokens.css. No new dependencies.

---

## File structure

### New files (`src/dev/skill-designer/`)

| File | Responsibility |
|---|---|
| `types.ts` | `DesignNode`, `DesignFile` interfaces; `EMPTY_DESIGN` constant. |
| `validation.ts` | `validateDesign(nodes)` returns `ValidationIssue[]` (duplicate IDs, missing parents, cycles, orphans, costs/maxLevel mismatch). |
| `autoLayout.ts` | `computeAutoLayout(nodes)` returns positions for nodes with `position === null`; honors manually-set positions. |
| `storage.ts` | `loadDraft()`, `saveDraft(design)`, `clearDraft()` over localStorage key `artdle:skill-design:draft`. |
| `api.ts` | `saveToFile(design)` POSTs to `/api/skill-design`. |
| `useDesignerState.ts` | React hook owning design state + selection + actions (addNode, updateNode, deleteNode, selectNode, resetAll, importDesign); debounces localStorage save. |
| `NodeForm.tsx` + `.module.css` | Right-rail form for the selected node. |
| `NodeListRail.tsx` + `.module.css` | Left-rail searchable node list + Add button. |
| `DesignerCanvas.tsx` + `.module.css` | Center pane: minimal SVG with drag-to-position, FAME hub fixed, edges, click-to-select. |
| `ActionBar.tsx` + `.module.css` | Top action bar (Save / Export / Reset / status). |
| `ExportModal.tsx` + `.module.css` | Modal showing pretty-printed JSON for copy-paste handoff. |
| `SkillDesignerRoute.tsx` + `.module.css` | Composition root: pulls hook, lays out 3 panes + action bar. |

### New file (`src/config/`)

| File | Responsibility |
|---|---|
| `skillTreeDesign.json` | Live design file written by the dev middleware. Initial state: `{ "version": 1, "title": "Empty draft", "designedAt": "", "nodes": [] }`. |

### Modified files

| File | Change |
|---|---|
| `vite.config.ts` | Add `configureServer` plugin registering `POST /api/skill-design`. |
| `src/App.tsx` | Top-level conditional: when `pathname.startsWith("/dev/")`, render only the dev route (no shell). |

### Test files (mirror under `tests/dev/skill-designer/`)

- `validation.test.ts`
- `autoLayout.test.ts`
- `storage.test.ts`
- `useDesignerState.test.ts`
- `NodeForm.test.tsx`
- `NodeListRail.test.tsx`
- `DesignerCanvas.test.tsx`
- `ActionBar.test.tsx`
- `ExportModal.test.tsx`
- `SkillDesignerRoute.test.tsx`

---

## Phasing overview

| Phase | Theme | Tasks |
|---|---|---|
| **A** | Pure-logic foundation (no React) | 1, 2, 3, 4 |
| **B** | Vite middleware + client helper | 5 |
| **C** | UI components (tested in isolation) | 6, 7, 8, 9 |
| **D** | Route assembly + state hook | 10 |
| **E** | Verify + commit | 11 |

Each task: TDD cycle (test → fail → impl → pass → commit).

---

## Pre-flight checks (do once before Task 1)

- [ ] Working tree clean. On `main`. HEAD at `d16334d` (designer spec just committed).
- [ ] Baseline tests pass: `npm test` reports 470/470.
- [ ] `npx tsc -b --noEmit` clean. `npm run lint` clean (only the pre-existing `main.tsx` fast-refresh warning).

---

# Phase A — Pure-logic foundation

---

### Task 1: Types + initial design JSON

**Files:**
- Create: `src/dev/skill-designer/types.ts`
- Create: `src/config/skillTreeDesign.json`

No tests — types alone don't have runtime behavior. The validation in T2 is what we test.

- [ ] **Step 1: Create `src/dev/skill-designer/types.ts`**

```ts
export interface DesignNode {
  id: string;
  name: string;
  description: string;
  numericEffect: string;
  parentId: string | null;
  maxLevel: number;
  costs: ReadonlyArray<number>;
  position: { x: number; y: number } | null;
}

export interface DesignFile {
  version: 1;
  title: string;
  designedAt: string;
  nodes: ReadonlyArray<DesignNode>;
}

export const EMPTY_DESIGN: DesignFile = {
  version: 1,
  title: "Untitled draft",
  designedAt: "",
  nodes: [],
};
```

- [ ] **Step 2: Create `src/config/skillTreeDesign.json`**

```json
{
  "version": 1,
  "title": "Empty draft",
  "designedAt": "",
  "nodes": []
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/dev/skill-designer/types.ts src/config/skillTreeDesign.json
git commit -m "designer(types): add DesignNode/DesignFile types + empty seed JSON"
```

---

### Task 2: Validation

**Files:**
- Create: `src/dev/skill-designer/validation.ts`
- Create: `tests/dev/skill-designer/validation.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/dev/skill-designer/validation.test.ts
import { describe, it, expect } from "vitest";
import { validateDesign } from "@/dev/skill-designer/validation";
import type { DesignNode } from "@/dev/skill-designer/types";

function n(id: string, parentId: string | null = null, maxLevel = 1, costs: number[] = [1]): DesignNode {
  return {
    id,
    name: id,
    description: "",
    numericEffect: "",
    parentId,
    maxLevel,
    costs,
    position: null,
  };
}

describe("validateDesign", () => {
  it("returns no issues for an empty design", () => {
    expect(validateDesign([])).toEqual([]);
  });

  it("returns no issues for a valid linear chain", () => {
    const issues = validateDesign([n("a"), n("b", "a"), n("c", "b")]);
    // Note: leaf nodes are not orphans (orphan = no parent AND no children)
    expect(issues).toEqual([]);
  });

  it("flags duplicate ids", () => {
    const issues = validateDesign([n("a"), n("a")]);
    expect(issues.some((i) => i.type === "duplicate_id" && i.nodeId === "a")).toBe(true);
  });

  it("flags missing parents", () => {
    const issues = validateDesign([n("a", "ghost")]);
    expect(issues.some((i) => i.type === "missing_parent" && i.nodeId === "a")).toBe(true);
  });

  it("flags simple cycles (a->b->a)", () => {
    const issues = validateDesign([n("a", "b"), n("b", "a")]);
    expect(issues.some((i) => i.type === "cycle")).toBe(true);
  });

  it("flags self-cycles (a->a)", () => {
    const issues = validateDesign([n("a", "a")]);
    expect(issues.some((i) => i.type === "cycle" && i.nodeId === "a")).toBe(true);
  });

  it("flags orphans (root with no children)", () => {
    const issues = validateDesign([n("a"), n("b", "a")]);
    // 'a' has child 'b', so not an orphan. 'b' is a leaf with parent 'a', also not an orphan.
    expect(issues.some((i) => i.type === "orphan")).toBe(false);

    const issues2 = validateDesign([n("solo")]);
    expect(issues2.some((i) => i.type === "orphan" && i.nodeId === "solo")).toBe(true);
  });

  it("flags costs.length != maxLevel", () => {
    const issues = validateDesign([n("a", null, 3, [1, 2])]);
    expect(issues.some((i) => i.type === "costs_length_mismatch" && i.nodeId === "a")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "dev/skill-designer/validation"`
Expected: FAIL ("Cannot find module ... validation").

- [ ] **Step 3: Create `src/dev/skill-designer/validation.ts`**

```ts
import type { DesignNode } from "./types";

export type ValidationIssueType =
  | "duplicate_id"
  | "missing_parent"
  | "cycle"
  | "orphan"
  | "costs_length_mismatch";

export interface ValidationIssue {
  type: ValidationIssueType;
  nodeId: string;
  message: string;
}

export function validateDesign(
  nodes: ReadonlyArray<DesignNode>,
): ReadonlyArray<ValidationIssue> {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  const idSet = new Set(nodes.map((n) => n.id));

  for (const node of nodes) {
    if (seen.has(node.id)) {
      issues.push({
        type: "duplicate_id",
        nodeId: node.id,
        message: `Duplicate node id "${node.id}"`,
      });
    }
    seen.add(node.id);

    if (node.parentId !== null && !idSet.has(node.parentId)) {
      issues.push({
        type: "missing_parent",
        nodeId: node.id,
        message: `Parent "${node.parentId}" does not exist`,
      });
    }

    if (node.costs.length !== node.maxLevel) {
      issues.push({
        type: "costs_length_mismatch",
        nodeId: node.id,
        message: `Costs length (${node.costs.length}) != maxLevel (${node.maxLevel})`,
      });
    }
  }

  // Cycle detection: walk parent chain from each node; if we revisit start id or any visited id, it's a cycle.
  const cycleReported = new Set<string>();
  for (const start of nodes) {
    let current: string | null = start.parentId;
    const visited = new Set<string>([start.id]);
    while (current !== null) {
      if (visited.has(current)) {
        if (!cycleReported.has(start.id)) {
          issues.push({
            type: "cycle",
            nodeId: start.id,
            message: `Cycle detected involving "${start.id}"`,
          });
          cycleReported.add(start.id);
        }
        break;
      }
      visited.add(current);
      const parent = nodes.find((n) => n.id === current);
      current = parent ? parent.parentId : null;
    }
  }

  // Orphan: parentId === null AND no children.
  const hasChildren = new Set<string>();
  for (const node of nodes) {
    if (node.parentId !== null) hasChildren.add(node.parentId);
  }
  for (const node of nodes) {
    if (node.parentId === null && !hasChildren.has(node.id)) {
      issues.push({
        type: "orphan",
        nodeId: node.id,
        message: `Node "${node.id}" has no parent and no children`,
      });
    }
  }

  return issues;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- "dev/skill-designer/validation"`
Expected: 8 passing.

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: 470 + 8 = 478 passing.

- [ ] **Step 6: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/dev/skill-designer/validation.ts tests/dev/skill-designer/validation.test.ts
git commit -m "designer(validation): detect duplicates, missing parents, cycles, orphans, cost mismatches"
```

---

### Task 3: Auto-layout

**Files:**
- Create: `src/dev/skill-designer/autoLayout.ts`
- Create: `tests/dev/skill-designer/autoLayout.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/dev/skill-designer/autoLayout.test.ts
import { describe, it, expect } from "vitest";
import { computeAutoLayout, FAME_HUB_X, FAME_HUB_Y, ROOT_Y, LEVEL_HEIGHT } from "@/dev/skill-designer/autoLayout";
import type { DesignNode } from "@/dev/skill-designer/types";

function n(id: string, parentId: string | null = null, position: { x: number; y: number } | null = null): DesignNode {
  return {
    id,
    name: id,
    description: "",
    numericEffect: "",
    parentId,
    maxLevel: 1,
    costs: [1],
    position,
  };
}

describe("computeAutoLayout", () => {
  it("returns empty record for empty design", () => {
    expect(computeAutoLayout([])).toEqual({});
  });

  it("places a single root at center, on ROOT_Y", () => {
    const positions = computeAutoLayout([n("a")]);
    expect(positions.a).toBeDefined();
    expect(positions.a.x).toBe(300); // center of 600-wide canvas
    expect(positions.a.y).toBe(ROOT_Y);
  });

  it("places multiple roots evenly across the canvas", () => {
    const positions = computeAutoLayout([n("a"), n("b"), n("c")]);
    expect(positions.a.y).toBe(ROOT_Y);
    expect(positions.b.y).toBe(ROOT_Y);
    expect(positions.c.y).toBe(ROOT_Y);
    // Sorted by id: a, b, c. They should have distinct, monotonically increasing x.
    expect(positions.a.x).toBeLessThan(positions.b.x);
    expect(positions.b.x).toBeLessThan(positions.c.x);
  });

  it("places a child above its parent (lower Y)", () => {
    const positions = computeAutoLayout([n("a"), n("b", "a")]);
    expect(positions.b.y).toBe(ROOT_Y - LEVEL_HEIGHT);
  });

  it("places multi-level chain with each level above the previous", () => {
    const positions = computeAutoLayout([n("a"), n("b", "a"), n("c", "b")]);
    expect(positions.a.y).toBe(ROOT_Y);
    expect(positions.b.y).toBe(ROOT_Y - LEVEL_HEIGHT);
    expect(positions.c.y).toBe(ROOT_Y - 2 * LEVEL_HEIGHT);
  });

  it("honors manually-set positions; does NOT overwrite them", () => {
    const positions = computeAutoLayout([n("a", null, { x: 50, y: 50 })]);
    expect(positions.a).toEqual({ x: 50, y: 50 });
  });

  it("places auto-laid-out children relative to a manually-positioned parent", () => {
    const positions = computeAutoLayout([n("a", null, { x: 100, y: 200 }), n("b", "a")]);
    expect(positions.a).toEqual({ x: 100, y: 200 });
    expect(positions.b.y).toBe(200 - LEVEL_HEIGHT);
  });

  it("exports FAME_HUB_X = 300 and FAME_HUB_Y = 510 (constants for canvas use)", () => {
    expect(FAME_HUB_X).toBe(300);
    expect(FAME_HUB_Y).toBe(510);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "dev/skill-designer/autoLayout"`
Expected: FAIL.

- [ ] **Step 3: Create `src/dev/skill-designer/autoLayout.ts`**

```ts
import type { DesignNode } from "./types";

export const FAME_HUB_X = 300;
export const FAME_HUB_Y = 510;
export const ROOT_Y = 400;
export const LEVEL_HEIGHT = 100;
export const CANVAS_WIDTH = 600;
export const CANVAS_PADDING_X = 80;

export interface Position {
  readonly x: number;
  readonly y: number;
}

/**
 * Compute positions for any node whose `position === null`.
 * Manually-positioned nodes are returned as-is.
 *
 * Strategy: simple BFS from root nodes. Roots laid out evenly across the
 * canvas above the FAME hub. Each child placed `LEVEL_HEIGHT` above its
 * parent, fanning horizontally based on sibling index.
 */
export function computeAutoLayout(
  nodes: ReadonlyArray<DesignNode>,
): Record<string, Position> {
  const positions: Record<string, Position> = {};

  // 1. Honor manually-set positions.
  for (const node of nodes) {
    if (node.position !== null) {
      positions[node.id] = node.position;
    }
  }

  // 2. Build child-of-parent map. Sort children by id for determinism.
  const ROOT_KEY = "__root__";
  const childrenOf: Record<string, string[]> = {};
  for (const node of nodes) {
    const key = node.parentId ?? ROOT_KEY;
    if (!childrenOf[key]) childrenOf[key] = [];
    childrenOf[key].push(node.id);
  }
  for (const key of Object.keys(childrenOf)) {
    childrenOf[key].sort();
  }

  // 3. Place roots evenly across the canvas.
  const roots = childrenOf[ROOT_KEY] ?? [];
  if (roots.length === 1) {
    if (!positions[roots[0]]) {
      positions[roots[0]] = { x: CANVAS_WIDTH / 2, y: ROOT_Y };
    }
  } else if (roots.length > 1) {
    const span = CANVAS_WIDTH - 2 * CANVAS_PADDING_X;
    const step = span / (roots.length - 1);
    roots.forEach((id, i) => {
      if (!positions[id]) {
        positions[id] = { x: CANVAS_PADDING_X + i * step, y: ROOT_Y };
      }
    });
  }

  // 4. BFS through tree, placing children above each parent.
  const queue: string[] = [...roots];
  const visited = new Set<string>(roots);

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const parentPos = positions[parentId];
    const children = childrenOf[parentId] ?? [];
    if (!parentPos || children.length === 0) continue;

    const childY = parentPos.y - LEVEL_HEIGHT;
    children.forEach((childId, i) => {
      if (!positions[childId]) {
        const offset = (i - (children.length - 1) / 2) * 80;
        positions[childId] = { x: parentPos.x + offset, y: childY };
      }
      if (!visited.has(childId)) {
        visited.add(childId);
        queue.push(childId);
      }
    });
  }

  return positions;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- "dev/skill-designer/autoLayout"`
Expected: 8 passing.

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: 478 + 8 = 486 passing.

- [ ] **Step 6: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/dev/skill-designer/autoLayout.ts tests/dev/skill-designer/autoLayout.test.ts
git commit -m "designer(autoLayout): BFS tree layout with manual-position override"
```

---

### Task 4: localStorage drafts

**Files:**
- Create: `src/dev/skill-designer/storage.ts`
- Create: `tests/dev/skill-designer/storage.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/dev/skill-designer/storage.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { loadDraft, saveDraft, clearDraft, STORAGE_KEY } from "@/dev/skill-designer/storage";
import type { DesignFile } from "@/dev/skill-designer/types";

const sample: DesignFile = {
  version: 1,
  title: "Test draft",
  designedAt: "2026-01-01T00:00:00.000Z",
  nodes: [
    {
      id: "a",
      name: "A",
      description: "desc",
      numericEffect: "+10%",
      parentId: null,
      maxLevel: 1,
      costs: [1],
      position: null,
    },
  ],
};

describe("skill-designer storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loadDraft returns null when no draft exists", () => {
    expect(loadDraft()).toBeNull();
  });

  it("saveDraft + loadDraft round-trip", () => {
    saveDraft(sample);
    expect(loadDraft()).toEqual(sample);
  });

  it("loadDraft returns null when stored JSON is invalid", () => {
    localStorage.setItem(STORAGE_KEY, "not-json");
    expect(loadDraft()).toBeNull();
  });

  it("loadDraft returns null when version is wrong", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, nodes: [] }));
    expect(loadDraft()).toBeNull();
  });

  it("clearDraft removes the stored value", () => {
    saveDraft(sample);
    clearDraft();
    expect(loadDraft()).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "dev/skill-designer/storage"`
Expected: FAIL.

- [ ] **Step 3: Create `src/dev/skill-designer/storage.ts`**

```ts
import type { DesignFile } from "./types";

export const STORAGE_KEY = "artdle:skill-design:draft";

export function loadDraft(): DesignFile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 1 && Array.isArray(parsed.nodes)) {
      return parsed as DesignFile;
    }
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

- [ ] **Step 4: Run tests**

Run: `npm test -- "dev/skill-designer/storage"`
Expected: 5 passing.

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: 486 + 5 = 491 passing.

- [ ] **Step 6: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/dev/skill-designer/storage.ts tests/dev/skill-designer/storage.test.ts
git commit -m "designer(storage): localStorage round-trip for design drafts"
```

---

# Phase B — Vite middleware + client helper

---

### Task 5: Save-to-file middleware + client API

**Files:**
- Modify: `vite.config.ts`
- Create: `src/dev/skill-designer/api.ts`
- Create: `tests/dev/skill-designer/api.test.ts`

The Vite middleware itself is not unit-tested (it requires a running Vite server). The client helper is tested with a mocked `fetch`.

- [ ] **Step 1: Modify `vite.config.ts`**

Replace contents with:

```ts
/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs/promises";

const skillDesignWriterPlugin = {
  name: "artdle-skill-design-writer",
  configureServer(server: any) {
    server.middlewares.use(
      "/api/skill-design",
      async (req: any, res: any, next: any) => {
        if (req.method !== "POST") return next();
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk);
          const body = Buffer.concat(chunks).toString("utf-8");
          const parsed = JSON.parse(body);
          if (parsed.version !== 1) {
            res.statusCode = 400;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ ok: false, error: "Bad version" }));
            return;
          }
          const target = path.resolve(
            __dirname,
            "src/config/skillTreeDesign.json",
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

export default defineConfig({
  plugins: [react(), skillDesignWriterPlugin],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
```

- [ ] **Step 2: Write failing tests for the client helper**

```ts
// tests/dev/skill-designer/api.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { saveToFile } from "@/dev/skill-designer/api";
import type { DesignFile } from "@/dev/skill-designer/types";

const sample: DesignFile = {
  version: 1,
  title: "x",
  designedAt: "",
  nodes: [],
};

describe("saveToFile", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("POSTs the design to /api/skill-design and returns the parsed body on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true }),
    }) as unknown as typeof fetch;
    const result = await saveToFile(sample);
    expect(result).toEqual({ ok: true });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/skill-design",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns ok=false with error on network failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    const result = await saveToFile(sample);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("network down");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- "dev/skill-designer/api"`
Expected: FAIL.

- [ ] **Step 4: Create `src/dev/skill-designer/api.ts`**

```ts
import type { DesignFile } from "./types";

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export async function saveToFile(design: DesignFile): Promise<SaveResult> {
  try {
    const response = await fetch("/api/skill-design", {
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

- [ ] **Step 5: Run tests**

Run: `npm test -- "dev/skill-designer/api"`
Expected: 2 passing.

- [ ] **Step 6: Run full suite**

Run: `npm test`
Expected: 491 + 2 = 493 passing.

- [ ] **Step 7: Smoke-test the middleware via curl**

```bash
npm run dev &
DEV_PID=$!
sleep 3
echo '{"version":1,"title":"smoke","designedAt":"","nodes":[]}' \
  | curl -s -X POST -H "content-type: application/json" --data-binary @- http://localhost:5173/api/skill-design
echo ""
cat src/config/skillTreeDesign.json
kill $DEV_PID 2>/dev/null || true
```

Expected: response `{"ok":true}` and the file content shows `"title": "smoke"`. Then revert the file:

```bash
git checkout src/config/skillTreeDesign.json
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add vite.config.ts src/dev/skill-designer/api.ts tests/dev/skill-designer/api.test.ts
git commit -m "designer(api): Vite middleware + client helper for save-to-file"
```

---

# Phase C — UI components

---

### Task 6: NodeForm — selected-node form

**Files:**
- Create: `src/dev/skill-designer/NodeForm.tsx`
- Create: `src/dev/skill-designer/NodeForm.module.css`
- Create: `tests/dev/skill-designer/NodeForm.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// tests/dev/skill-designer/NodeForm.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NodeForm } from "@/dev/skill-designer/NodeForm";
import type { DesignNode } from "@/dev/skill-designer/types";

const baseNode: DesignNode = {
  id: "test_node",
  name: "Test Node",
  description: "Test description",
  numericEffect: "+10%",
  parentId: null,
  maxLevel: 2,
  costs: [10, 25],
  position: null,
};

const otherNode: DesignNode = {
  id: "other",
  name: "Other",
  description: "",
  numericEffect: "",
  parentId: null,
  maxLevel: 1,
  costs: [1],
  position: null,
};

describe("<NodeForm />", () => {
  it("shows placeholder when no node is selected", () => {
    render(<NodeForm node={null} allNodes={[]} onChange={() => {}} onDelete={() => {}} />);
    expect(screen.getByText(/select a node/i)).toBeInTheDocument();
  });

  it("renders the selected node's name in a text input", () => {
    render(<NodeForm node={baseNode} allNodes={[baseNode]} onChange={() => {}} onDelete={() => {}} />);
    const input = screen.getByLabelText(/name/i) as HTMLInputElement;
    expect(input.value).toBe("Test Node");
  });

  it("renders one cost input per level", () => {
    render(<NodeForm node={baseNode} allNodes={[baseNode]} onChange={() => {}} onDelete={() => {}} />);
    expect(screen.getByLabelText(/Lvl 1 cost/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Lvl 2 cost/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Lvl 3 cost/i)).not.toBeInTheDocument();
  });

  it("changing the name calls onChange with the patch", () => {
    const onChange = vi.fn();
    render(<NodeForm node={baseNode} allNodes={[baseNode]} onChange={onChange} onDelete={() => {}} />);
    const input = screen.getByLabelText(/name/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Renamed" } });
    expect(onChange).toHaveBeenCalledWith("test_node", { name: "Renamed" });
  });

  it("changing maxLevel calls onChange with new costs array (zero-padded if extending)", () => {
    const onChange = vi.fn();
    render(<NodeForm node={baseNode} allNodes={[baseNode]} onChange={onChange} onDelete={() => {}} />);
    const input = screen.getByLabelText(/max level/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "3" } });
    expect(onChange).toHaveBeenCalledWith("test_node", { maxLevel: 3, costs: [10, 25, 0] });
  });

  it("changing parent dropdown calls onChange with the new parentId", () => {
    const onChange = vi.fn();
    render(<NodeForm node={baseNode} allNodes={[baseNode, otherNode]} onChange={onChange} onDelete={() => {}} />);
    const select = screen.getByLabelText(/parent/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "other" } });
    expect(onChange).toHaveBeenCalledWith("test_node", { parentId: "other" });
  });

  it("clicking Delete calls onDelete with the node id", () => {
    const onDelete = vi.fn();
    render(<NodeForm node={baseNode} allNodes={[baseNode]} onChange={() => {}} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith("test_node");
  });

  it("clicking 'Reset position' calls onChange with position: null", () => {
    const onChange = vi.fn();
    const positioned: DesignNode = { ...baseNode, position: { x: 100, y: 100 } };
    render(<NodeForm node={positioned} allNodes={[positioned]} onChange={onChange} onDelete={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /reset position/i }));
    expect(onChange).toHaveBeenCalledWith("test_node", { position: null });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "dev/skill-designer/NodeForm"`
Expected: FAIL.

- [ ] **Step 3: Create `src/dev/skill-designer/NodeForm.tsx`**

```tsx
import type { JSX } from "react";
import type { DesignNode } from "./types";
import styles from "./NodeForm.module.css";

interface Props {
  node: DesignNode | null;
  allNodes: ReadonlyArray<DesignNode>;
  onChange: (id: string, patch: Partial<DesignNode>) => void;
  onDelete: (id: string) => void;
}

export function NodeForm({ node, allNodes, onChange, onDelete }: Props): JSX.Element {
  if (node === null) {
    return (
      <aside className={styles.form} aria-label="Node form">
        <p className={styles.placeholder}>Select a node or click + Add Node</p>
      </aside>
    );
  }

  function patch(p: Partial<DesignNode>) {
    onChange(node!.id, p);
  }

  function changeMaxLevel(newMax: number) {
    if (newMax < 1 || newMax > 10) return;
    const oldCosts = node!.costs;
    let newCosts: number[];
    if (newMax > oldCosts.length) {
      newCosts = [...oldCosts, ...Array(newMax - oldCosts.length).fill(0)];
    } else {
      newCosts = oldCosts.slice(0, newMax);
    }
    patch({ maxLevel: newMax, costs: newCosts });
  }

  function changeCost(level: number, value: number) {
    const newCosts = [...node!.costs];
    newCosts[level] = value;
    patch({ costs: newCosts });
  }

  return (
    <aside className={styles.form} aria-label="Node form">
      <label className={styles.field}>
        <span className={styles.label}>Name</span>
        <input
          className={styles.input}
          type="text"
          value={node.name}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>ID (slug)</span>
        <input
          className={styles.input}
          type="text"
          value={node.id}
          onChange={(e) => patch({ id: e.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Parent</span>
        <select
          className={styles.input}
          value={node.parentId ?? ""}
          onChange={(e) => patch({ parentId: e.target.value === "" ? null : e.target.value })}
        >
          <option value="">(FAME root)</option>
          {allNodes
            .filter((n) => n.id !== node.id)
            .map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} ({n.id})
              </option>
            ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Max level</span>
        <input
          className={styles.input}
          type="number"
          min={1}
          max={10}
          value={node.maxLevel}
          onChange={(e) => changeMaxLevel(parseInt(e.target.value, 10) || 1)}
        />
      </label>

      <div className={styles.field}>
        <span className={styles.label}>Costs (per level)</span>
        {node.costs.map((cost, i) => (
          <label key={i} className={styles.subField}>
            <span className={styles.subLabel}>Lvl {i + 1} cost</span>
            <input
              className={styles.input}
              type="number"
              value={cost}
              onChange={(e) => changeCost(i, parseInt(e.target.value, 10) || 0)}
            />
          </label>
        ))}
      </div>

      <label className={styles.field}>
        <span className={styles.label}>Numeric effect</span>
        <input
          className={styles.input}
          type="text"
          value={node.numericEffect}
          onChange={(e) => patch({ numericEffect: e.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Description</span>
        <textarea
          className={styles.textarea}
          rows={4}
          value={node.description}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </label>

      <div className={styles.field}>
        <span className={styles.label}>Position</span>
        {node.position !== null ? (
          <>
            <span className={styles.posReadout}>
              x: {Math.round(node.position.x)} · y: {Math.round(node.position.y)}
            </span>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => patch({ position: null })}
            >
              Reset position
            </button>
          </>
        ) : (
          <span className={styles.posReadout}>auto</span>
        )}
      </div>

      <button
        type="button"
        className={styles.dangerBtn}
        onClick={() => {
          if (window.confirm(`Delete "${node.name}"? Children become roots.`)) {
            onDelete(node.id);
          }
        }}
      >
        Delete node
      </button>
    </aside>
  );
}
```

- [ ] **Step 4: Create `src/dev/skill-designer/NodeForm.module.css`**

```css
.form {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  padding: var(--s-4);
  border-left: var(--border-subtle);
  background: var(--bg-1);
  overflow-y: auto;
}

.placeholder {
  color: var(--ink-3);
  font-family: var(--mono);
  font-size: 12px;
  text-align: center;
  margin: var(--s-6) 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--s-1);
}

.subField {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: var(--s-1);
}

.label {
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-3);
}

.subLabel {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--ink-3);
}

.input,
.textarea {
  font-family: var(--mono);
  font-size: 13px;
  padding: var(--s-1) var(--s-2);
  border: 1px solid var(--ink-line);
  border-radius: var(--r-sm);
  background: var(--bg-2);
  color: var(--ink-1);
}

.textarea {
  resize: vertical;
  font-family: var(--sans);
}

.posReadout {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--ink-2);
}

.secondaryBtn {
  align-self: flex-start;
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  padding: var(--s-1) var(--s-2);
  border: 1px solid var(--ink-line);
  border-radius: var(--r-sm);
  background: var(--bg-2);
  color: var(--ink-2);
  cursor: pointer;
}

.dangerBtn {
  margin-top: var(--s-3);
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  padding: var(--s-2) var(--s-3);
  border: 1px solid #c44;
  border-radius: var(--r-sm);
  background: transparent;
  color: #c44;
  cursor: pointer;
}

.dangerBtn:hover {
  background: rgba(204, 68, 68, 0.1);
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- "dev/skill-designer/NodeForm"`
Expected: 8 passing.

- [ ] **Step 6: Run full suite + typecheck**

Run: `npm test && npx tsc -b --noEmit`
Expected: 493 + 8 = 501 passing; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add src/dev/skill-designer/NodeForm.tsx src/dev/skill-designer/NodeForm.module.css tests/dev/skill-designer/NodeForm.test.tsx
git commit -m "designer(form): add <NodeForm> right-rail field editor"
```

---

### Task 7: NodeListRail — left-rail list

**Files:**
- Create: `src/dev/skill-designer/NodeListRail.tsx`
- Create: `src/dev/skill-designer/NodeListRail.module.css`
- Create: `tests/dev/skill-designer/NodeListRail.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// tests/dev/skill-designer/NodeListRail.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NodeListRail } from "@/dev/skill-designer/NodeListRail";
import type { DesignNode } from "@/dev/skill-designer/types";

function n(id: string, name = id, maxLevel = 1): DesignNode {
  return {
    id,
    name,
    description: "",
    numericEffect: "",
    parentId: null,
    maxLevel,
    costs: Array(maxLevel).fill(1),
    position: null,
  };
}

describe("<NodeListRail />", () => {
  it("renders the Add Node button", () => {
    render(<NodeListRail nodes={[]} selectedId={null} onSelect={() => {}} onAdd={() => {}} />);
    expect(screen.getByRole("button", { name: /add node/i })).toBeInTheDocument();
  });

  it("clicking Add Node calls onAdd", () => {
    const onAdd = vi.fn();
    render(<NodeListRail nodes={[]} selectedId={null} onSelect={() => {}} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: /add node/i }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("renders one row per node, showing name + level pill", () => {
    render(<NodeListRail nodes={[n("a", "Alpha", 1), n("b", "Beta", 3)]} selectedId={null} onSelect={() => {}} onAdd={() => {}} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText(/1 lvl/i)).toBeInTheDocument();
    expect(screen.getByText(/3 lvls/i)).toBeInTheDocument();
  });

  it("clicking a row calls onSelect with that node's id", () => {
    const onSelect = vi.fn();
    render(<NodeListRail nodes={[n("a", "Alpha")]} selectedId={null} onSelect={onSelect} onAdd={() => {}} />);
    fireEvent.click(screen.getByText("Alpha"));
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("the selected row has data-selected='true'", () => {
    render(<NodeListRail nodes={[n("a", "Alpha")]} selectedId="a" onSelect={() => {}} onAdd={() => {}} />);
    const row = screen.getByText("Alpha").closest("[data-testid^='node-row-']");
    expect(row).toHaveAttribute("data-selected", "true");
  });

  it("typing in search filters the list (case-insensitive substring)", () => {
    render(<NodeListRail nodes={[n("a", "Alpha"), n("b", "Beta")]} selectedId={null} onSelect={() => {}} onAdd={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "be" } });
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "dev/skill-designer/NodeListRail"`
Expected: FAIL.

- [ ] **Step 3: Create `src/dev/skill-designer/NodeListRail.tsx`**

```tsx
import type { JSX } from "react";
import { useState } from "react";
import type { DesignNode } from "./types";
import styles from "./NodeListRail.module.css";

interface Props {
  nodes: ReadonlyArray<DesignNode>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function NodeListRail({ nodes, selectedId, onSelect, onAdd }: Props): JSX.Element {
  const [filter, setFilter] = useState("");
  const filtered = nodes.filter((n) =>
    n.name.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <aside className={styles.rail} aria-label="Node list">
      <button type="button" className={styles.addBtn} onClick={onAdd}>
        + Add Node
      </button>
      <input
        className={styles.search}
        type="text"
        placeholder="Search…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <ul className={styles.list}>
        {filtered.map((node) => (
          <li
            key={node.id}
            className={styles.row}
            data-testid={`node-row-${node.id}`}
            data-selected={selectedId === node.id ? "true" : undefined}
            onClick={() => onSelect(node.id)}
          >
            <span className={styles.name}>{node.name}</span>
            <span className={styles.pill}>
              {node.maxLevel} {node.maxLevel === 1 ? "lvl" : "lvls"}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
```

- [ ] **Step 4: Create `src/dev/skill-designer/NodeListRail.module.css`**

```css
.rail {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  padding: var(--s-3);
  border-right: var(--border-subtle);
  background: var(--bg-1);
  overflow-y: auto;
}

.addBtn {
  font-family: var(--mono);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: var(--s-2);
  border: 1px solid var(--gold);
  border-radius: var(--r-sm);
  background: var(--bg-2);
  color: var(--gold);
  cursor: pointer;
}

.search {
  font-family: var(--mono);
  font-size: 12px;
  padding: var(--s-1) var(--s-2);
  border: 1px solid var(--ink-line);
  border-radius: var(--r-sm);
  background: var(--bg-2);
  color: var(--ink-1);
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--s-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--s-2);
  border: 1px solid var(--ink-line);
  border-radius: var(--r-sm);
  background: var(--bg-2);
  cursor: pointer;
}

.row[data-selected="true"] {
  border-color: var(--gold);
  background: rgba(255, 216, 106, 0.08);
}

.name {
  font-family: var(--sans);
  font-size: 13px;
  color: var(--ink-1);
}

.pill {
  font-family: var(--mono);
  font-size: 10px;
  text-transform: uppercase;
  color: var(--ink-3);
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- "dev/skill-designer/NodeListRail"`
Expected: 6 passing.

- [ ] **Step 6: Run full suite + typecheck**

Run: `npm test && npx tsc -b --noEmit`
Expected: 501 + 6 = 507 passing; clean.

- [ ] **Step 7: Commit**

```bash
git add src/dev/skill-designer/NodeListRail.tsx src/dev/skill-designer/NodeListRail.module.css tests/dev/skill-designer/NodeListRail.test.tsx
git commit -m "designer(list): add <NodeListRail> searchable left rail with Add button"
```

---

### Task 8: DesignerCanvas — center pane with drag

**Files:**
- Create: `src/dev/skill-designer/DesignerCanvas.tsx`
- Create: `src/dev/skill-designer/DesignerCanvas.module.css`
- Create: `tests/dev/skill-designer/DesignerCanvas.test.tsx`

The canvas is its own minimal SVG (NOT reusing `<StarCanvas>` because the interaction model differs — drag, no node states). It renders the FAME hub, edges, and draggable node circles.

- [ ] **Step 1: Write failing tests**

```tsx
// tests/dev/skill-designer/DesignerCanvas.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DesignerCanvas } from "@/dev/skill-designer/DesignerCanvas";
import type { DesignNode } from "@/dev/skill-designer/types";

function n(id: string, parentId: string | null = null, position: { x: number; y: number } | null = null): DesignNode {
  return {
    id,
    name: id,
    description: "",
    numericEffect: "",
    parentId,
    maxLevel: 1,
    costs: [1],
    position,
  };
}

describe("<DesignerCanvas />", () => {
  it("renders an SVG", () => {
    const { container } = render(
      <DesignerCanvas nodes={[]} selectedId={null} onSelect={() => {}} onMove={() => {}} />,
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders the FAME hub", () => {
    render(<DesignerCanvas nodes={[]} selectedId={null} onSelect={() => {}} onMove={() => {}} />);
    expect(screen.getByTestId("fame-hub")).toBeInTheDocument();
  });

  it("renders one node circle per design node", () => {
    render(<DesignerCanvas nodes={[n("a"), n("b")]} selectedId={null} onSelect={() => {}} onMove={() => {}} />);
    expect(screen.getByTestId("designer-node-a")).toBeInTheDocument();
    expect(screen.getByTestId("designer-node-b")).toBeInTheDocument();
  });

  it("renders edges from parent to child (and from FAME to roots)", () => {
    render(<DesignerCanvas nodes={[n("a"), n("b", "a")]} selectedId={null} onSelect={() => {}} onMove={() => {}} />);
    expect(screen.getByTestId("designer-edge-fame-a")).toBeInTheDocument();
    expect(screen.getByTestId("designer-edge-a-b")).toBeInTheDocument();
  });

  it("clicking a node calls onSelect with its id", () => {
    const onSelect = vi.fn();
    render(<DesignerCanvas nodes={[n("a")]} selectedId={null} onSelect={onSelect} onMove={() => {}} />);
    fireEvent.click(screen.getByTestId("designer-node-a"));
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("selected node has data-selected='true'", () => {
    render(<DesignerCanvas nodes={[n("a")]} selectedId="a" onSelect={() => {}} onMove={() => {}} />);
    expect(screen.getByTestId("designer-node-a")).toHaveAttribute("data-selected", "true");
  });

  it("renders node label (name) near each node", () => {
    render(<DesignerCanvas nodes={[n("a")]} selectedId={null} onSelect={() => {}} onMove={() => {}} />);
    // label is rendered as <text> child near the circle
    expect(screen.getByText("a")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "dev/skill-designer/DesignerCanvas"`
Expected: FAIL.

- [ ] **Step 3: Create `src/dev/skill-designer/DesignerCanvas.tsx`**

```tsx
import type { JSX } from "react";
import { useState, useRef } from "react";
import type { DesignNode } from "./types";
import { computeAutoLayout, FAME_HUB_X, FAME_HUB_Y, CANVAS_WIDTH } from "./autoLayout";
import styles from "./DesignerCanvas.module.css";

const VIEWBOX_HEIGHT = 600;
const DRAG_THRESHOLD_PX = 5;
const NODE_R = 12;

interface Props {
  nodes: ReadonlyArray<DesignNode>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, position: { x: number; y: number }) => void;
}

interface DragState {
  nodeId: string;
  startClientX: number;
  startClientY: number;
  startNodeX: number;
  startNodeY: number;
  moved: boolean;
}

/**
 * Minimal SVG canvas for designing skill trees. Drag interaction:
 *   pointerdown on a node → record start position
 *   pointermove → update node position via onMove (only after threshold)
 *   pointerup with no drag → onSelect (treated as click)
 *
 * Reuses computeAutoLayout to fill in positions for nodes with position=null.
 */
export function DesignerCanvas({ nodes, selectedId, onSelect, onMove }: Props): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const positions = computeAutoLayout(nodes);

  function pointFor(id: string | "fame"): { x: number; y: number } {
    if (id === "fame") return { x: FAME_HUB_X, y: FAME_HUB_Y };
    return positions[id] ?? { x: FAME_HUB_X, y: FAME_HUB_Y };
  }

  function clientToSvg(clientX: number, clientY: number): { x: number; y: number } {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = VIEWBOX_HEIGHT / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function handlePointerDown(e: React.PointerEvent, node: DesignNode) {
    const pos = positions[node.id] ?? { x: 0, y: 0 };
    setDrag({
      nodeId: node.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startNodeX: pos.x,
      startNodeY: pos.y,
      moved: false,
    });
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (drag === null) return;
    const dx = Math.abs(e.clientX - drag.startClientX);
    const dy = Math.abs(e.clientY - drag.startClientY);
    if (!drag.moved && dx < DRAG_THRESHOLD_PX && dy < DRAG_THRESHOLD_PX) return;
    const svgPoint = clientToSvg(e.clientX, e.clientY);
    onMove(drag.nodeId, svgPoint);
    if (!drag.moved) setDrag({ ...drag, moved: true });
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (drag === null) return;
    if (!drag.moved) {
      onSelect(drag.nodeId);
    }
    (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    setDrag(null);
  }

  return (
    <div className={styles.canvas}>
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={`0 0 ${CANVAS_WIDTH} ${VIEWBOX_HEIGHT}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width={CANVAS_WIDTH} height={VIEWBOX_HEIGHT} fill="var(--bg-0)" />

        {/* Edges */}
        <g>
          {nodes.map((node) => {
            const a = node.parentId === null ? pointFor("fame") : pointFor(node.parentId);
            const b = pointFor(node.id);
            const fromKey = node.parentId === null ? "fame" : node.parentId;
            return (
              <line
                key={`${fromKey}-${node.id}`}
                data-testid={`designer-edge-${fromKey}-${node.id}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="var(--ink-line)"
                strokeWidth={1.5}
                opacity={0.6}
              />
            );
          })}
        </g>

        {/* FAME hub */}
        <g data-testid="fame-hub">
          <circle cx={FAME_HUB_X} cy={FAME_HUB_Y} r={20} fill="var(--fame)" />
          <text
            x={FAME_HUB_X}
            y={FAME_HUB_Y + 40}
            textAnchor="middle"
            fontFamily="serif"
            fontSize="12"
            fontWeight="700"
            fill="var(--fame)"
          >
            FAME
          </text>
        </g>

        {/* Nodes */}
        <g onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
          {nodes.map((node) => {
            const pos = pointFor(node.id);
            const isSelected = selectedId === node.id;
            return (
              <g
                key={node.id}
                data-testid={`designer-node-${node.id}`}
                data-selected={isSelected ? "true" : undefined}
                style={{ cursor: "grab" }}
                onPointerDown={(e) => handlePointerDown(e, node)}
              >
                {isSelected && (
                  <circle cx={pos.x} cy={pos.y} r={NODE_R + 6} fill="rgba(155,108,214,0.3)" />
                )}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={NODE_R}
                  fill="var(--bg-1)"
                  stroke="var(--gold)"
                  strokeWidth={2}
                />
                <text
                  x={pos.x}
                  y={pos.y + NODE_R + 14}
                  textAnchor="middle"
                  fontFamily="var(--mono)"
                  fontSize="10"
                  fill="var(--ink-2)"
                >
                  {node.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/dev/skill-designer/DesignerCanvas.module.css`**

```css
.canvas {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--bg-0);
  overflow: hidden;
}

.svg {
  display: block;
  width: 100%;
  height: 100%;
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- "dev/skill-designer/DesignerCanvas"`
Expected: 7 passing.

- [ ] **Step 6: Run full suite + typecheck**

Run: `npm test && npx tsc -b --noEmit`
Expected: 507 + 7 = 514 passing; clean.

- [ ] **Step 7: Commit**

```bash
git add src/dev/skill-designer/DesignerCanvas.tsx src/dev/skill-designer/DesignerCanvas.module.css tests/dev/skill-designer/DesignerCanvas.test.tsx
git commit -m "designer(canvas): add <DesignerCanvas> SVG with click-select + drag-to-move"
```

---

### Task 9: ActionBar + ExportModal

**Files:**
- Create: `src/dev/skill-designer/ActionBar.tsx`
- Create: `src/dev/skill-designer/ActionBar.module.css`
- Create: `src/dev/skill-designer/ExportModal.tsx`
- Create: `src/dev/skill-designer/ExportModal.module.css`
- Create: `tests/dev/skill-designer/ActionBar.test.tsx`
- Create: `tests/dev/skill-designer/ExportModal.test.tsx`

- [ ] **Step 1: Write failing tests**

`tests/dev/skill-designer/ActionBar.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActionBar } from "@/dev/skill-designer/ActionBar";

describe("<ActionBar />", () => {
  it("renders three primary actions: Save / Export / Reset", () => {
    render(
      <ActionBar
        status="saved"
        issueCount={0}
        onSave={() => {}}
        onExport={() => {}}
        onReset={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /save to file/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  it("clicking Save calls onSave", () => {
    const onSave = vi.fn();
    render(<ActionBar status="saved" issueCount={0} onSave={onSave} onExport={() => {}} onReset={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /save to file/i }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("clicking Reset shows a confirm; only calls onReset if confirmed", () => {
    const onReset = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    render(<ActionBar status="saved" issueCount={0} onSave={() => {}} onExport={() => {}} onReset={onReset} />);
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(onReset).not.toHaveBeenCalled();
    confirmSpy.mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(onReset).toHaveBeenCalledOnce();
    confirmSpy.mockRestore();
  });

  it("shows 'Unsaved changes' indicator when status='dirty'", () => {
    render(<ActionBar status="dirty" issueCount={0} onSave={() => {}} onExport={() => {}} onReset={() => {}} />);
    expect(screen.getByText(/unsaved/i)).toBeInTheDocument();
  });

  it("shows '✓ Saved' indicator when status='saved'", () => {
    render(<ActionBar status="saved" issueCount={0} onSave={() => {}} onExport={() => {}} onReset={() => {}} />);
    expect(screen.getByText(/saved/i)).toBeInTheDocument();
  });

  it("shows N validation issues when issueCount > 0", () => {
    render(<ActionBar status="saved" issueCount={3} onSave={() => {}} onExport={() => {}} onReset={() => {}} />);
    expect(screen.getByText(/3.*issue/i)).toBeInTheDocument();
  });
});
```

`tests/dev/skill-designer/ExportModal.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExportModal } from "@/dev/skill-designer/ExportModal";
import type { DesignFile } from "@/dev/skill-designer/types";

const sample: DesignFile = {
  version: 1,
  title: "x",
  designedAt: "",
  nodes: [],
};

describe("<ExportModal />", () => {
  it("does not render when not open", () => {
    const { container } = render(<ExportModal open={false} design={sample} onClose={() => {}} />);
    expect(container.querySelector("[role='dialog']")).toBeNull();
  });

  it("renders the JSON in a textarea when open", () => {
    render(<ExportModal open={true} design={sample} onClose={() => {}} />);
    const textarea = screen.getByLabelText(/json/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain('"version": 1');
  });

  it("clicking Close calls onClose", () => {
    const onClose = vi.fn();
    render(<ExportModal open={true} design={sample} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "dev/skill-designer/(ActionBar|ExportModal)"`
Expected: FAIL.

- [ ] **Step 3: Create `src/dev/skill-designer/ActionBar.tsx`**

```tsx
import type { JSX } from "react";
import styles from "./ActionBar.module.css";

export type ActionBarStatus = "saved" | "dirty" | "saving";

interface Props {
  status: ActionBarStatus;
  issueCount: number;
  onSave: () => void;
  onExport: () => void;
  onReset: () => void;
}

export function ActionBar({ status, issueCount, onSave, onExport, onReset }: Props): JSX.Element {
  function handleReset() {
    if (window.confirm("Reset the entire design? This cannot be undone.")) {
      onReset();
    }
  }

  let statusEl: JSX.Element;
  if (status === "saving") {
    statusEl = <span className={styles.statusSaving}>Saving…</span>;
  } else if (status === "dirty") {
    statusEl = <span className={styles.statusDirty}>● Unsaved changes</span>;
  } else {
    statusEl = <span className={styles.statusSaved}>✓ Saved</span>;
  }

  return (
    <header className={styles.bar}>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={onSave}>
          Save to file
        </button>
        <button type="button" className={styles.secondary} onClick={onExport}>
          Export JSON
        </button>
        <button type="button" className={styles.danger} onClick={handleReset}>
          Reset
        </button>
      </div>
      <div className={styles.status}>
        {statusEl}
        {issueCount > 0 && (
          <span className={styles.issues}>⚠ {issueCount} issue{issueCount === 1 ? "" : "s"}</span>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Create `src/dev/skill-designer/ActionBar.module.css`**

```css
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--s-2) var(--s-4);
  border-bottom: var(--border-subtle);
  background: var(--bg-1);
}

.actions {
  display: flex;
  gap: var(--s-2);
}

.primary,
.secondary,
.danger {
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: var(--s-1) var(--s-3);
  border-radius: var(--r-sm);
  cursor: pointer;
}

.primary {
  border: 1px solid var(--gold);
  background: var(--gold);
  color: var(--bg-0);
}

.secondary {
  border: 1px solid var(--ink-line);
  background: var(--bg-2);
  color: var(--ink-2);
}

.danger {
  border: 1px solid #c44;
  background: transparent;
  color: #c44;
}

.status {
  display: flex;
  gap: var(--s-3);
  align-items: center;
  font-family: var(--mono);
  font-size: 11px;
}

.statusSaved {
  color: #6c6;
}

.statusDirty {
  color: #f80;
}

.statusSaving {
  color: var(--ink-2);
}

.issues {
  color: #f80;
}
```

- [ ] **Step 5: Create `src/dev/skill-designer/ExportModal.tsx`**

```tsx
import type { JSX } from "react";
import type { DesignFile } from "./types";
import styles from "./ExportModal.module.css";

interface Props {
  open: boolean;
  design: DesignFile;
  onClose: () => void;
}

export function ExportModal({ open, design, onClose }: Props): JSX.Element | null {
  if (!open) return null;
  const json = JSON.stringify(design, null, 2);
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Export design as JSON">
      <div className={styles.modal}>
        <h3 className={styles.title}>Export design as JSON</h3>
        <label className={styles.label}>
          <span className={styles.labelText}>JSON</span>
          <textarea
            className={styles.textarea}
            readOnly
            value={json}
            rows={20}
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          />
        </label>
        <div className={styles.footer}>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create `src/dev/skill-designer/ExportModal.module.css`**

```css
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  width: 600px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  padding: var(--s-5);
  border: 2px solid var(--gold);
  border-radius: var(--r-md);
  background: var(--bg-1);
  box-shadow: var(--shadow-card);
}

.title {
  margin: 0;
  font-family: var(--serif);
  font-size: 18px;
  color: var(--gold);
}

.label {
  display: flex;
  flex-direction: column;
  gap: var(--s-1);
}

.labelText {
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  color: var(--ink-3);
}

.textarea {
  font-family: var(--mono);
  font-size: 11px;
  width: 100%;
  padding: var(--s-2);
  border: 1px solid var(--ink-line);
  border-radius: var(--r-sm);
  background: var(--bg-2);
  color: var(--ink-1);
}

.footer {
  display: flex;
  justify-content: flex-end;
}

.closeBtn {
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  padding: var(--s-1) var(--s-3);
  border: 1px solid var(--ink-line);
  border-radius: var(--r-sm);
  background: var(--bg-2);
  color: var(--ink-2);
  cursor: pointer;
}
```

- [ ] **Step 7: Run tests**

Run: `npm test -- "dev/skill-designer/(ActionBar|ExportModal)"`
Expected: 6 + 3 = 9 passing.

- [ ] **Step 8: Run full suite + typecheck**

Run: `npm test && npx tsc -b --noEmit`
Expected: 514 + 9 = 523 passing; clean.

- [ ] **Step 9: Commit**

```bash
git add src/dev/skill-designer/ActionBar.tsx src/dev/skill-designer/ActionBar.module.css src/dev/skill-designer/ExportModal.tsx src/dev/skill-designer/ExportModal.module.css tests/dev/skill-designer/ActionBar.test.tsx tests/dev/skill-designer/ExportModal.test.tsx
git commit -m "designer(actions): add <ActionBar> + <ExportModal>"
```

---

# Phase D — Route assembly

---

### Task 10: useDesignerState hook + SkillDesignerRoute + App wiring

**Files:**
- Create: `src/dev/skill-designer/useDesignerState.ts`
- Create: `src/dev/skill-designer/SkillDesignerRoute.tsx`
- Create: `src/dev/skill-designer/SkillDesignerRoute.module.css`
- Create: `tests/dev/skill-designer/useDesignerState.test.ts`
- Create: `tests/dev/skill-designer/SkillDesignerRoute.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing tests for the hook**

```ts
// tests/dev/skill-designer/useDesignerState.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDesignerState } from "@/dev/skill-designer/useDesignerState";

describe("useDesignerState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts with the empty design", () => {
    const { result } = renderHook(() => useDesignerState());
    expect(result.current.design.nodes).toEqual([]);
    expect(result.current.selectedId).toBeNull();
  });

  it("addNode appends a new node and gives it a unique id", () => {
    const { result } = renderHook(() => useDesignerState());
    act(() => result.current.actions.addNode());
    expect(result.current.design.nodes).toHaveLength(1);
    act(() => result.current.actions.addNode());
    expect(result.current.design.nodes).toHaveLength(2);
    expect(result.current.design.nodes[0].id).not.toBe(result.current.design.nodes[1].id);
  });

  it("updateNode applies the patch to the matching node", () => {
    const { result } = renderHook(() => useDesignerState());
    act(() => result.current.actions.addNode());
    const id = result.current.design.nodes[0].id;
    act(() => result.current.actions.updateNode(id, { name: "Renamed" }));
    expect(result.current.design.nodes[0].name).toBe("Renamed");
  });

  it("deleteNode removes the node and nulls children's parentId", () => {
    const { result } = renderHook(() => useDesignerState());
    act(() => result.current.actions.addNode());
    const aId = result.current.design.nodes[0].id;
    act(() => result.current.actions.addNode());
    const bId = result.current.design.nodes[1].id;
    act(() => result.current.actions.updateNode(bId, { parentId: aId }));
    act(() => result.current.actions.deleteNode(aId));
    expect(result.current.design.nodes).toHaveLength(1);
    expect(result.current.design.nodes[0].id).toBe(bId);
    expect(result.current.design.nodes[0].parentId).toBeNull();
  });

  it("selectNode sets selectedId", () => {
    const { result } = renderHook(() => useDesignerState());
    act(() => result.current.actions.selectNode("anything"));
    expect(result.current.selectedId).toBe("anything");
  });

  it("resetAll clears the design and selectedId", () => {
    const { result } = renderHook(() => useDesignerState());
    act(() => result.current.actions.addNode());
    act(() => result.current.actions.selectNode("x"));
    act(() => result.current.actions.resetAll());
    expect(result.current.design.nodes).toEqual([]);
    expect(result.current.selectedId).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- "dev/skill-designer/useDesignerState"`
Expected: FAIL.

- [ ] **Step 3: Create `src/dev/skill-designer/useDesignerState.ts`**

```ts
import { useState, useEffect, useCallback, useRef } from "react";
import type { DesignFile, DesignNode } from "./types";
import { EMPTY_DESIGN } from "./types";
import { loadDraft, saveDraft, clearDraft } from "./storage";

const SAVE_DEBOUNCE_MS = 500;

export interface DesignerActions {
  addNode: () => void;
  updateNode: (id: string, patch: Partial<DesignNode>) => void;
  deleteNode: (id: string) => void;
  selectNode: (id: string | null) => void;
  resetAll: () => void;
  importDesign: (design: DesignFile) => void;
}

export interface DesignerState {
  design: DesignFile;
  selectedId: string | null;
  actions: DesignerActions;
}

function uniqueId(existing: ReadonlyArray<DesignNode>, base: string): string {
  if (!existing.some((n) => n.id === base)) return base;
  let i = 2;
  while (existing.some((n) => n.id === `${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

export function useDesignerState(): DesignerState {
  const [design, setDesign] = useState<DesignFile>(() => loadDraft() ?? EMPTY_DESIGN);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveDraft(design);
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [design]);

  const addNode = useCallback(() => {
    setDesign((d) => {
      const newId = uniqueId(d.nodes, "new_node");
      const newNode: DesignNode = {
        id: newId,
        name: "New Node",
        description: "",
        numericEffect: "",
        parentId: null,
        maxLevel: 1,
        costs: [0],
        position: null,
      };
      return { ...d, nodes: [...d.nodes, newNode] };
    });
  }, []);

  const updateNode = useCallback((id: string, patch: Partial<DesignNode>) => {
    setDesign((d) => ({
      ...d,
      nodes: d.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    }));
    if (patch.id !== undefined) {
      setSelectedId((cur) => (cur === id ? patch.id! : cur));
    }
  }, []);

  const deleteNode = useCallback((id: string) => {
    setDesign((d) => ({
      ...d,
      nodes: d.nodes
        .filter((n) => n.id !== id)
        .map((n) => (n.parentId === id ? { ...n, parentId: null } : n)),
    }));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const selectNode = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const resetAll = useCallback(() => {
    clearDraft();
    setDesign(EMPTY_DESIGN);
    setSelectedId(null);
  }, []);

  const importDesign = useCallback((d: DesignFile) => {
    setDesign(d);
    setSelectedId(null);
  }, []);

  return {
    design,
    selectedId,
    actions: { addNode, updateNode, deleteNode, selectNode, resetAll, importDesign },
  };
}
```

- [ ] **Step 4: Run hook tests**

Run: `npm test -- "dev/skill-designer/useDesignerState"`
Expected: 6 passing.

- [ ] **Step 5: Write failing tests for the route**

```tsx
// tests/dev/skill-designer/SkillDesignerRoute.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillDesignerRoute } from "@/dev/skill-designer/SkillDesignerRoute";

describe("<SkillDesignerRoute />", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the action bar", () => {
    render(<SkillDesignerRoute />);
    expect(screen.getByRole("button", { name: /save to file/i })).toBeInTheDocument();
  });

  it("renders all 3 panes (list, canvas, form placeholder)", () => {
    render(<SkillDesignerRoute />);
    expect(screen.getByRole("button", { name: /add node/i })).toBeInTheDocument();
    expect(screen.getByTestId("fame-hub")).toBeInTheDocument();
    expect(screen.getByText(/select a node/i)).toBeInTheDocument();
  });

  it("clicking Add Node creates a node and shows it in the list", () => {
    render(<SkillDesignerRoute />);
    fireEvent.click(screen.getByRole("button", { name: /add node/i }));
    expect(screen.getAllByText(/New Node/i).length).toBeGreaterThan(0);
  });

  it("after adding a node, clicking it in the list selects it (form fields appear)", () => {
    render(<SkillDesignerRoute />);
    fireEvent.click(screen.getByRole("button", { name: /add node/i }));
    fireEvent.click(screen.getAllByText(/New Node/i)[0]);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
  });

  it("clicking Export opens the modal showing the JSON", () => {
    render(<SkillDesignerRoute />);
    fireEvent.click(screen.getByRole("button", { name: /export/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run route tests to verify they fail**

Run: `npm test -- "dev/skill-designer/SkillDesignerRoute"`
Expected: FAIL.

- [ ] **Step 7: Create `src/dev/skill-designer/SkillDesignerRoute.tsx`**

```tsx
import type { JSX } from "react";
import { useState, useCallback } from "react";
import { useDesignerState } from "./useDesignerState";
import { saveToFile } from "./api";
import { validateDesign } from "./validation";
import { ActionBar, type ActionBarStatus } from "./ActionBar";
import { NodeListRail } from "./NodeListRail";
import { DesignerCanvas } from "./DesignerCanvas";
import { NodeForm } from "./NodeForm";
import { ExportModal } from "./ExportModal";
import styles from "./SkillDesignerRoute.module.css";

export function SkillDesignerRoute(): JSX.Element {
  const { design, selectedId, actions } = useDesignerState();
  const [status, setStatus] = useState<ActionBarStatus>("saved");
  const [exportOpen, setExportOpen] = useState(false);

  const issues = validateDesign(design.nodes);
  const selectedNode =
    selectedId !== null ? design.nodes.find((n) => n.id === selectedId) ?? null : null;

  const handleSave = useCallback(async () => {
    setStatus("saving");
    const designToSave = {
      ...design,
      designedAt: new Date().toISOString(),
    };
    const result = await saveToFile(designToSave);
    setStatus(result.ok ? "saved" : "dirty");
  }, [design]);

  const handleMove = useCallback(
    (id: string, position: { x: number; y: number }) => {
      actions.updateNode(id, { position });
      setStatus("dirty");
    },
    [actions],
  );

  const wrapAction = useCallback(<T extends (...args: never[]) => unknown>(fn: T): T => {
    return ((...args: Parameters<T>) => {
      setStatus("dirty");
      return fn(...args);
    }) as T;
  }, []);

  return (
    <div className={styles.layout}>
      <ActionBar
        status={status}
        issueCount={issues.length}
        onSave={handleSave}
        onExport={() => setExportOpen(true)}
        onReset={actions.resetAll}
      />
      <div className={styles.panes}>
        <NodeListRail
          nodes={design.nodes}
          selectedId={selectedId}
          onSelect={actions.selectNode}
          onAdd={wrapAction(actions.addNode)}
        />
        <DesignerCanvas
          nodes={design.nodes}
          selectedId={selectedId}
          onSelect={actions.selectNode}
          onMove={handleMove}
        />
        <NodeForm
          node={selectedNode}
          allNodes={design.nodes}
          onChange={wrapAction(actions.updateNode)}
          onDelete={wrapAction(actions.deleteNode)}
        />
      </div>
      <ExportModal open={exportOpen} design={design} onClose={() => setExportOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 8: Create `src/dev/skill-designer/SkillDesignerRoute.module.css`**

```css
.layout {
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100vh;
  background: var(--bg-0);
  color: var(--ink-1);
}

.panes {
  display: grid;
  grid-template-columns: 240px 1fr 320px;
  overflow: hidden;
}
```

- [ ] **Step 9: Modify `src/App.tsx`**

Replace contents with:

```tsx
import type { JSX } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { TopBar } from "@/components/shell/TopBar";
import { BottomBar } from "@/components/shell/BottomBar";
import { InfoPanel } from "@/components/shell/InfoPanel";
import { TreeRoute } from "@/routes/TreeRoute";
import { PaintingRoute } from "@/routes/PaintingRoute";
import { AscensionRoute } from "@/routes/AscensionRoute";
import { ConstellationRoute } from "@/routes/ConstellationRoute";
import { SkillDesignerRoute } from "@/dev/skill-designer/SkillDesignerRoute";
import styles from "./App.module.css";

export function App(): JSX.Element {
  const location = useLocation();
  const isDev = location.pathname.startsWith("/dev/");

  if (isDev) {
    return (
      <Routes>
        <Route path="/dev/skill-designer" element={<SkillDesignerRoute />} />
      </Routes>
    );
  }

  return (
    <div className={styles.app}>
      <TopBar />
      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<Navigate to="/tree" replace />} />
          <Route path="/tree" element={<TreeRoute />} />
          <Route path="/painting" element={<PaintingRoute />} />
          <Route path="/ascension" element={<AscensionRoute />} />
          <Route path="/constellation" element={<ConstellationRoute />} />
          <Route path="*" element={<Navigate to="/tree" replace />} />
        </Routes>
      </main>
      <InfoPanel />
      <BottomBar />
    </div>
  );
}
```

- [ ] **Step 10: Run route tests**

Run: `npm test -- "dev/skill-designer/SkillDesignerRoute"`
Expected: 5 passing.

- [ ] **Step 11: Run full suite**

Run: `npm test`
Expected: 523 + 6 + 5 = 534 passing.

- [ ] **Step 12: Typecheck + lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: clean (or only the pre-existing `main.tsx` warning).

- [ ] **Step 13: Commit**

```bash
git add src/dev/skill-designer/useDesignerState.ts src/dev/skill-designer/SkillDesignerRoute.tsx src/dev/skill-designer/SkillDesignerRoute.module.css tests/dev/skill-designer/useDesignerState.test.ts tests/dev/skill-designer/SkillDesignerRoute.test.tsx src/App.tsx
git commit -m "designer(route): wire SkillDesignerRoute + register /dev/skill-designer"
```

---

# Phase E — Verify

---

### Task 11: Final verify + smoke

This task makes no code changes (other than HANDOVER if you choose). Verification gate before declaring the designer done.

- [ ] **Step 1: Full test suite**

Run: `npm test`
Capture exact pass count. Expected: ~534.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc -b --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Production build (verify the dev plugin doesn't break the build)**

Run: `npm run build`
Expected: success. Capture gzipped sizes.

- [ ] **Step 4: Smoke check the live designer in dev mode**

```bash
npm run dev &
DEV_PID=$!
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/dev/skill-designer
kill $DEV_PID 2>/dev/null || true
```

Expected: HTTP 200.

- [ ] **Step 5: Smoke check the save-to-file endpoint**

```bash
npm run dev &
DEV_PID=$!
sleep 3
echo '{"version":1,"title":"smoke","designedAt":"","nodes":[]}' \
  | curl -s -X POST -H "content-type: application/json" --data-binary @- http://localhost:5173/api/skill-design
echo ""
head -1 src/config/skillTreeDesign.json
kill $DEV_PID 2>/dev/null || true
git checkout src/config/skillTreeDesign.json
```

Expected: response `{"ok":true}` and the file's first line shows it was overwritten with the smoke payload (revert via `git checkout`).

- [ ] **Step 6: Manual UI test** (optional, for confidence)

Open `http://localhost:5173/dev/skill-designer` in a browser. Verify:
- Three panes visible (list left, canvas middle, form right).
- "+ Add Node" creates a node visible in the list and on the canvas.
- Clicking the node selects it (right rail form populates).
- Dragging the node on the canvas moves it.
- Editing the name in the form updates the list immediately.
- Deleting the node removes it from both list and canvas.
- "Save to file" updates `src/config/skillTreeDesign.json` (verify with `git diff`).
- "Export JSON" opens a modal with the design JSON.
- "Reset" clears the design after confirm.

- [ ] **Step 7: Report**

- Status: DONE
- Test count
- Bundle size (no significant impact expected — designer is dev-only-route)
- HEAD SHA

No tag for this — it's a tool, not a release. The user signals "done" when ready to design and you'll start a separate cycle for translating the captured design into game code.

---

## Spec coverage check (self-review of this plan)

| Spec section | Task |
|---|---|
| Architecture (route, folder, files, middleware) | Task 5 (middleware) + Task 10 (App wiring) |
| UI structure: top action bar | Task 9 |
| UI structure: left rail (list + add + search) | Task 7 |
| UI structure: center canvas (drag, FAME hub, edges, click-select) | Task 8 |
| UI structure: right rail form (all fields) | Task 6 |
| Data model: types | Task 1 |
| Validation rules (duplicates, missing parents, cycles, orphans, costs/maxLevel) | Task 2 |
| Auto-layout (BFS, manual override) | Task 3 |
| Persistence: localStorage draft + debounce | Task 4 (storage) + Task 10 (hook debounce) |
| Save-to-file: Vite middleware + client | Task 5 |
| Export JSON modal | Task 9 |
| Reset (with confirm) | Task 9 (ActionBar) + Task 10 (route action wiring) |
| Initial empty `skillTreeDesign.json` committed | Task 1 |
| App.tsx shell-bypass for /dev/* | Task 10 |
| Test coverage (autoLayout, validation, storage, components) | Tasks 2, 3, 4, 6, 7, 8, 9, 10 |

## Plan self-review

- ✅ No "TBD"/"TODO"/"implement later" placeholders.
- ✅ Test code given for every TDD step; impl code given for every implementation step.
- ✅ Type signatures consistent: `DesignNode` (T1) used by all subsequent tasks. `DesignerActions` interface in T10 matches the actions consumed in `SkillDesignerRoute`.
- ✅ Test count math: 470 baseline + 8 (T2) + 8 (T3) + 5 (T4) + 2 (T5) + 8 (T6) + 6 (T7) + 7 (T8) + 6+3 (T9) + 6+5 (T10) = +64 total. End count ~534.
- ✅ Each task is bite-sized.
- ✅ No "Similar to Task N" cross-references — every code block is self-contained.

---

**End of plan.**
