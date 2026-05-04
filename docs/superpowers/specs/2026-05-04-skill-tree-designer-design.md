# Skill Tree Designer — Design Spec

**Date:** 2026-05-04
**Goal:** an in-app dev tool for authoring the new skill tree (replacing the v1.1 5-node tree). Captures node intent — names, costs, free-text effects, parent links, positions — and emits a JSON file the implementer reads to translate into game code.

**Why:** the current 5-node linear chain (`goldsmith → patient_eye → second_slot → faster_strokes → better_brush`) is a v1 stub. The user wants a richer, more interesting tree with multi-level nodes, branching paths, and new effects. Designing 30+ nodes through chat ping-pong is slow; a visual editor is faster. The game is unreleased, so save migration is not a concern: the new tree replaces v1.1 entirely.

---

## Decisions locked during brainstorm

1. **Where it lives:** in-game dev route at `/dev/skill-designer`. Hidden from top-bar nav (URL-only access). Lives in a new `src/dev/skill-designer/` subtree.
2. **Visual layout:** hybrid auto-layout + drag-to-position override. Manual drag persists; nodes without explicit positions get auto-layout.
3. **Effects:** free-form text. Designer captures intent ("+10% gold per level"); implementer translates to code post-hoc.
4. **Multi-level nodes:** explicit per-level cost array + free-text description. No formulas. `costs.length === maxLevel`.
5. **Persistence:** localStorage draft (debounced 500ms) + Save-to-file via Vite dev middleware → `src/config/skillTreeDesign.json`. JSON file is committed.
6. **Replacement semantics:** the new tree replaces the v1.1 5-node tree entirely. No migration. Saves get reset.

---

## Architecture

- **New route** `/dev/skill-designer`, registered in `App.tsx`. Full viewport — no top bar / no game chrome.
- **New folder** `src/dev/skill-designer/` — route, components, types, auto-layout function, localStorage helpers.
- **New file** `src/config/skillTreeDesign.json` — the live design file. Committed to git.
- **Vite middleware** in `vite.config.ts`: `POST /api/skill-design` writes the request body to `src/config/skillTreeDesign.json`. Dev-only (registered conditionally in `configureServer`). ~20 lines.
- **No new dependencies**. Reuses existing `<StarCanvas>` for the canvas, with extensions for drag and selection.

The designer does NOT modify `src/config/skillTreeNodes.ts` or `src/components/constellation/nodeLayout.ts`. Translation from `skillTreeDesign.json` to those game-code artifacts happens during implementation, not at design time.

---

## UI structure

Three-pane layout, full viewport:

```
┌──────────────────────────────────────────────────────────────────┐
│ Top action bar:                                                  │
│   [Save to file] [Export JSON] [Reset]   ● Unsaved changes       │
├──────────────┬───────────────────────────┬───────────────────────┤
│              │                           │                       │
│  Left rail   │   Center: canvas          │  Right rail (320 px)  │
│  (240 px)    │   (drag-to-position)      │                       │
│              │                           │  Selected node form:  │
│  + Add Node  │   FAME hub fixed at       │   - Name              │
│  [Search…]   │   bottom-center.          │   - ID (slug)         │
│              │                           │   - Parent (dropdown) │
│  Goldsmith   │   Nodes draggable.        │   - Max level (1-10)  │
│  · 3 lvls    │   Edges auto-drawn from   │   - Costs (N inputs)  │
│              │   parentId.               │   - Numeric effect    │
│  Patient Eye │                           │   - Description       │
│  · 1 lvl     │   Click node → select.    │   - Position X/Y      │
│              │   Drag node → reposition. │   - [Reset position]  │
│  ...         │                           │   - [Delete node]     │
│              │                           │                       │
└──────────────┴───────────────────────────┴───────────────────────┘
```

### Left rail

- "+ Add Node" button at top — creates a new node with default values, auto-positions, opens it in the right rail.
- Search box filters the list by name (case-insensitive substring).
- Each row shows the node's name + a small pill with `· N lvls`.
- Click a row → that node becomes the selected node (right rail and canvas update).
- Selected row highlighted.

### Center canvas

Reuses `<StarCanvas>` with extensions:
- Nodes draggable: mousedown on a node + mousemove → updates `position.x` / `position.y` for that node. Mouseup commits the position.
- Click on a node (without dragging) → selects it (same as clicking the left-rail row).
- Selected node gets a halo (purple, matching the existing v2 style).
- Orphan nodes (those with no parent and no children) display a warning marker.
- FAME hub remains fixed at `(300, 510)`. Cannot be moved.
- Nodes without `position` get auto-layout positions (computed at render-time).

### Right rail (selected-node form)

All fields apply to the currently selected node. If no node is selected, the rail shows a "Select a node or click + Add" placeholder.

| Field | Input type | Notes |
|---|---|---|
| Name | text | Required. |
| ID | text (slug) | Auto-derived from name on first edit, but freely editable. Validated for uniqueness; duplicates auto-suffix `_2`, `_3`, etc. |
| Parent | dropdown | Lists all other nodes by name + a "(FAME root)" option for `parentId: null`. |
| Max level | number (1-10) | Changing this resizes the costs array. |
| Costs | array of N number inputs | Length == max level. Inline label "Lvl 1: ___, Lvl 2: ___, …". |
| Numeric effect | text | Free-form. e.g., "+10% gold per level." |
| Description | textarea | Free-form. Player-facing flavor. |
| Position X / Y | read-only number readouts | Shown if position is manually set. |
| Reset position | button | Sets position to null → auto-layout takes over. |
| Delete node | button (with confirm) | Removes the node. Children of this node have their parentId nulled (becoming roots). |

### Top action bar

- **Save to file** — POSTs the current design state as JSON to `/api/skill-design`. On success, shows a "✓ Saved" toast for 2s. On failure, shows error.
- **Export JSON** — opens an inline modal with the design as pretty-printed JSON in a textarea, for copy-paste handoff (fallback for when the file write isn't desired or isn't available).
- **Reset** — with confirm: clears localStorage draft. Designer reloads with empty state.
- **Status indicator** — one of:
  - `● Unsaved changes` (orange dot) — draft has changes since last "Save to file."
  - `✓ Saved` (green check) — draft matches the on-disk file.
  - `⚠ N validation issues` — orphans, missing parents, etc.

---

## Data model

### Per-node TypeScript shape

```ts
// src/dev/skill-designer/types.ts
export interface DesignNode {
  id: string;                   // slug, lowercase + underscores; unique
  name: string;
  description: string;
  numericEffect: string;        // free-form, e.g., "+10% gold per level"
  parentId: string | null;      // null = child of FAME hub root
  maxLevel: number;             // 1+ ; 1 = single-purchase
  costs: number[];              // costs.length === maxLevel
  position: { x: number; y: number } | null;  // null = auto-layout
}

export interface DesignFile {
  version: 1;
  title: string;                // optional human label, e.g., "v3.0 draft"
  designedAt: string;           // ISO timestamp, set on save-to-file
  nodes: DesignNode[];
}
```

### Example file

```json
{
  "version": 1,
  "title": "v3.0 skill tree draft",
  "designedAt": "2026-05-04T20:00:00.000Z",
  "nodes": [
    {
      "id": "trunk_gold",
      "name": "Goldsmith",
      "description": "The foundation of every painter's craft.",
      "numericEffect": "+10% gold from canvas sales per level",
      "parentId": null,
      "maxLevel": 3,
      "costs": [1, 5, 25],
      "position": { "x": 200, "y": 400 }
    },
    {
      "id": "trunk_focus",
      "name": "Patient Eye",
      "description": "Time spent observing pays off.",
      "numericEffect": "+15% inspiration generation per level",
      "parentId": "trunk_gold",
      "maxLevel": 1,
      "costs": [3],
      "position": null
    }
  ]
}
```

### Validation rules

Surfaced as warnings in the UI; never block save. The user can save invalid drafts.

- IDs must be unique. Auto-suffixed `_2` on collision when ID is auto-derived; manual edits to a colliding ID show a warning.
- `parentId` references must exist (or be null). Dangling references show a warning.
- No cycles (A → B → A). Detected on parent-edit; show a warning.
- `costs.length` must equal `maxLevel`. Auto-resized when max-level changes (extends with zeros, truncates from the end).
- Orphan nodes (no parent and no children) shown with a warning marker.

---

## Auto-layout

A simple recursive tree layout function in `src/dev/skill-designer/autoLayout.ts`:

1. Build a children-of-parent map from `nodes`.
2. Walk roots (parentId === null) in deterministic order (sorted by ID).
3. Assign each root an X position spaced evenly across the canvas width above the FAME hub.
4. For each subtree, recursively place children below the parent in a row, fanning width by subtree size.
5. Y positions: each tree level shifts up by 100 px from the FAME hub Y (`510`). Roots at Y=400, level 2 at Y=300, level 3 at Y=200, etc.

Triggered:
- On node creation: new node's position is computed via auto-layout.
- On "Reset position" button: that node's position is set to null and auto-layout fills it in at render-time.

Manually-positioned nodes (position !== null) are honored as-is, regardless of where the auto-layout would otherwise place them.

This is a fallback layout, not a graph-drawing algorithm. For complex topologies it will look basic; the user is expected to manually drag for non-trivial trees.

---

## Persistence & save-to-file

### Working draft

- Stored in `localStorage` under key `artdle:skill-design:draft`.
- Written on every change to the design state, debounced 500ms (so rapid edits coalesce into one write).
- On designer mount: load draft from localStorage. If absent, fall back to reading `src/config/skillTreeDesign.json` (via a fetch to `/src/config/skillTreeDesign.json`, served by Vite's static asset handling). If both absent, start with empty design.
- On "Reset" button: confirm dialog → wipes localStorage and reloads the route.

### Save-to-file via Vite middleware

A new dev-only POST endpoint:

```
POST /api/skill-design
Content-Type: application/json
Body: <DesignFile JSON>

Responds 200 OK on success, 4xx on validation, 5xx on filesystem error.
```

Implemented in `vite.config.ts` via `configureServer`:

```ts
server: {
  // ...
},
plugins: [
  // ...
  {
    name: 'artdle-skill-design-writer',
    configureServer(server) {
      server.middlewares.use('/api/skill-design', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk);
          const body = Buffer.concat(chunks).toString('utf-8');
          // Validate JSON shape (parse + check `version === 1`).
          const parsed = JSON.parse(body);
          if (parsed.version !== 1) throw new Error('Bad version');
          // Write file.
          const fs = await import('node:fs/promises');
          const path = await import('node:path');
          const target = path.resolve(__dirname, 'src/config/skillTreeDesign.json');
          await fs.writeFile(target, JSON.stringify(parsed, null, 2), 'utf-8');
          res.statusCode = 200;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: String(e) }));
        }
      });
    },
  },
],
```

The endpoint is only registered while the Vite dev server is running. Production builds do not include it. Calling Save-to-file in a `vite preview` or static build silently fails (the user can fall back to Export JSON).

### Initial file state

`src/config/skillTreeDesign.json` is committed to git with an empty initial design:

```json
{ "version": 1, "title": "Empty draft", "designedAt": "", "nodes": [] }
```

Subsequent saves overwrite this file. The file is reviewable in PRs.

---

## Implementation handoff

Once the user signals "done designing," the implementer (Claude) reads `src/config/skillTreeDesign.json` and translates it into game code in a separate plan-driven implementation cycle. Steps:

1. **Generate `src/config/skillTreeNodes.ts`** — exports `SKILL_NODES: ReadonlyArray<SkillNodeConfig>` from the design's nodes. Each design node maps to one config entry. The existing 5 v1.1 nodes are removed.
2. **Generate `src/components/constellation/nodeLayout.ts`** — exports `NODE_POSITIONS` from each design node's `position` field (running auto-layout for any nulls).
3. **Upgrade `skillTreeSlice`** — change `purchasedNodes: Partial<Record<SkillNodeId, true>>` to `purchasedNodes: Partial<Record<SkillNodeId, number>>` (storing current level, with absence == level 0). Update `hasNode`, `canBuyNode`, `buyNode` accordingly.
4. **Implement each `numericEffect`** — each design node's effect is implemented in the relevant slice or system. New effects may need new fields, new selectors, new tick contributions, etc.
5. **Update `ConstellationRoute` + `<NodeCard>`** — show current level / max level, show next-level cost, "Acquire" button becomes "Upgrade · cost fame" when not yet at max.

This implementation work is its own spec + plan, drafted separately once the design is captured.

---

## Out of scope

- Live game preview from inside the designer (e.g., simulating a fame-spend playthrough). Deferred.
- Undo/redo. Deferred. localStorage debouncing means the worst-case data loss is the last 500ms of edits.
- Multi-effect nodes (one node with multiple distinct effects). Designer treats `numericEffect` as a single string. If a node needs to do 2 things, you write both in one description.
- Effect-type validation. The implementer interprets `numericEffect` text manually; no parser.
- Node templates / clone-from-existing. Add Node always creates a default-shaped blank.
- Bulk operations (multi-select, bulk delete, bulk reposition). One node at a time.
- Production-mode access (via `vite preview`) for Save-to-file. Always falls back to Export JSON.

---

## Test surface

- `src/dev/skill-designer/autoLayout.ts` — unit-tested. Position assignment is deterministic.
- `src/dev/skill-designer/storage.ts` — unit-tested. localStorage round-trip; invalid JSON handled.
- `src/dev/skill-designer/validation.ts` — unit-tested. Cycle detection, orphan detection, ID uniqueness.
- The Vite middleware — smoke-tested via a simple POST in dev (manual or scripted).
- React components (Editor route, list rail, form rail, canvas overlay) — RTL tests for crud flow + drag interaction smoke.

Estimated 25-40 new tests. Existing 470 tests should remain unaffected (no changes to game systems).

---

## Risks

- **Drag interaction edge cases:** click vs drag distinction (using a 5px movement threshold), pointer events vs mouse events, touch on phone. Phone testing is non-goal for this tool.
- **Vite middleware path resolution:** writing to `src/config/...` from a Vite plugin's `__dirname` works in dev because `vite.config.ts` runs from the project root. Verify before assuming.
- **JSON corruption** during Save-to-file (e.g., browser tab closes mid-write). Mitigated by writing a complete file (no partial writes), but a catastrophic crash could land an empty file. localStorage backup mitigates this; user can re-save.
- **Auto-layout aesthetic:** for trees of 20+ nodes, the simple recursive layout will look messy. The user is expected to manually drag for polished layouts. If this becomes painful, switch to a force-directed library in a future iteration.
