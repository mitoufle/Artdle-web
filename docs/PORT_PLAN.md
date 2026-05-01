# Artdle — Web Port Plan v2 (Stripped V1 + Wave Roadmap)

**Date:** 2026-05-01
**Status:** Active. Supersedes `2026-05-01-web-port-plan.md` (the v1 port plan, written earlier the same day, before the scope-reconciliation brainstorm).
**Why a v2:** the original port plan assumed v1 would ship the full Canvas + Workshop specs end-to-end. The 2026-05-01 brainstorm reduced v1 scope to a minimum playable loop (5 stripped systems) with feature-richness deferred to a wave roadmap. This doc captures the revised plan; the v1 port plan is preserved for reasoning history.

---

## 0. Provenance — decisions made in this brainstorm

| # | Decision |
|---|---|
| **D1 — Trajectory** | Local-only browser → self-hosted with backend → publicly hosted website. Long-term arc, not v1 obligation. |
| **D2 — V1 scope** | 5 stripped systems: Tree, Canvas, Workshop, Skill Tree, Ascend. Each system in its **lightest playable form**. Feature richness deferred to a wave roadmap (v1.1+). |
| **D3 — Stack** | Latest stable lines: React 19, Tailwind 4 (CSS-first config), Vite latest, Zustand 5, Vitest latest, idb-keyval, break_eternity.js, Motion. (`@dnd-kit` is on the wave roadmap for v1.5+ workshop drag-drop; not installed in v1 — click-to-equip suffices for the single equip slot.) |
| **D4 — Repo** | `C:\Users\mitoufle\Documents\artdle-web\`, sibling to the Godot repo, fresh `git init`. |
| **D5 — Persistence** | IndexedDB from Day 1 via `idb-keyval` wrapped in a `SaveAdapter` interface. No localStorage involvement. |
| **D6 — Language** | English-only. The Godot design specs use mixed French/English for set/concept names — those are reference material only. The web codebase uses English from Day 1; future feature waves choose English names at the time of implementation. |
| **D7 — Workflow** | Subagent-driven development (the implementation plan, when written, decomposes phases into per-task dispatches). |
| **D8 — Permanently out** | Mobile, multiplayer, French. |
| **D9 — Deferred to v2+** | Painter's Office, Painting School, Expositions, audio (8-bit per-mechanic), achievements, hidden mechanics, multi-art-form architecture, offline progress, PWA. |
| **D10 — Balance target** | 3 years of player time to fully unlock the complete game (across all art forms and features). v1 itself plays in 1-3 hours. Formulas in `balance.ts` use shapes (logarithmic fame, exponential paliers) that scale to the long-term target without per-wave retuning. |
| **D11 — Architectural hooks** | Five Day-1 additions to make the local→backend→public migrations mechanical: `SaveAdapter` interface, `playerId` UUID inside the save object, versioned `migrate` chain, asset imports through Vite (no hard-coded URLs), anti-cheat noted-not-built. |

---

## 1. What V1 is (the minimum playable loop)

V1 ships **five systems**, each in its **stripped form**. The stripped form is *not* what the design specs (`canvas-design.md`, `workshop-design.md`) describe end-to-end — those specs are the **wave-roadmap targets**, not the v1 deliverable.

| System | V1 (stripped) | Wave that adds richness |
|---|---|---|
| **Tree** | 3 stages, 2-3 parts/stage, gold-priced part upgrades, inspiration accrual | Future waves expand stage count and part variety |
| **Canvas** | Single slot, fixed paint-time, auto-sell, simple gold formula | v1.1 (tiers + paint mastery), v1.2 (subjects), v1.3 (quality + gamble + masterpiece RNG bonus), v1.4 (multi-canvas + canvas-branch skill tree) |
| **Workshop** | Click-to-craft button, 1 implicit affix per item, 1 equipment slot, no rarity/tier | v1.5 (tiers + sets + slot implicits), v1.6 (conveyor + workshop-branch skill tree), v1.7 (paid actions + persistence vault), v1.8 (3-column UI rebuild) |
| **Skill tree** | 3-5 nodes purchasable with fame | Each canvas/workshop wave brings its branch (17 + 31 nodes total at v1.8) |
| **Ascend** | Palier triggers, fame conversion, run reset, preserves fame + skill tree + ascend count | Paint-mastery preservation lands with v1.1 |

### 1.1 Currencies in v1

Three currencies: **gold**, **inspiration**, **fame**.

**Paint mastery is NOT in v1.** It depends on canvas complexity (tiers, mastery, quality), none of which exist in v1. PM ships with v1.1 (canvas tiers + per-canvas-sale log-curve gain).

### 1.2 Core loop in v1

```
Tree    →  inspiration             (passive)
Canvas  →  gold                    (timer + auto-sell)
Gold    →  tree growth + workshop  (continuous sink)
Workshop (click) → 1 item with 1 affix → equip → boosts canvas/tree
Inspiration → ascend palier
Ascend  →  fame                    (resets gold/inspi/canvas/tree/equipped item)
Fame    →  skill tree              (3-5 nodes)
```

Every system feeds the canvas. Canvas is the gold faucet. Workshop is a click-driven gold sink that lets the player concretize "I'm spending gold for an upgrade."

### 1.3 Stripped Workshop — exact behavior

A button labelled **Craft** in the Workshop popup. Click it: spend `X` gold (initial: 100, scales with workshop level later — v1 has no level), receive 1 item.

**Item shape:**
- 1 implicit affix from a small pool: `+canvas_gold%`, `-paint_time%`, `+inspiration_rate%`. Magnitude rolls in a fixed range (e.g., 5% to 15%).
- 1 equipment slot total. Equipping replaces any currently-equipped item; the unequipped one is discarded (no stash in v1).

**Tuning note (flagged for v1 balance pass):** the 3-affix pool may feel thin in playtest — the same shape with different numbers can register as "the workshop just rolls a random %." If so, expand to 4-5 affixes (e.g., `+ascend_palier_reduction%`, `+tree_part_cost_reduction%`) before declaring v1 balanced. This is a tuning question, not a redesign.

### 1.4 Stripped skill tree — exact node list (proposed; tunable)

5 nodes, each costs ascending fame amounts (1, 3, 10, 30, 100 fame indicatively):

| Node | Effect |
|---|---|
| **Goldsmith** | +10% gold from canvas |
| **Patient Eye** | +15% inspiration rate |
| **Second Slot** | Workshop equip slots: 1 → 2 |
| **Faster Strokes** | Ascend palier reduced 10% |
| **Better Brush** | +1 magnitude on workshop item affixes |

Node prerequisite graph: linear chain (1 → 2 → 3 → 4 → 5) for v1 simplicity. Branching nodes arrive with the canvas/workshop wave skill trees.

### 1.5 Stripped Ascend — exact formulas

```ts
palierAscend(count: number): Big   = big(1000).mul(big(2).pow(count))
fameOnAscend(inspi: Big): number   = Math.floor(Math.log10(Math.max(1, inspi.toNumber())) * 10)
```

Ascend conditions: `inspiration ≥ palierAscend(ascend_count)`.
Reset on ascend: gold → 0, inspiration → 0, tree state, canvas state, equipped item.
Preserved: fame, ascend_count, purchased_skill_nodes, playerId, save schema version.

---

## 2. What V1 is NOT

### 2.1 Wave roadmap (post-v1.0)

Each wave is **independently shippable** — the build is always green, the game is always playable, each wave brings a slice of the original four design specs into the game.

| Wave | Scope | Source of truth |
|---|---|---|
| **v1.1** | Canvas tiers (10 tiers, gold/PM curves) + paint mastery accumulator + log-curve PM multiplier on production | `canvas-design.md` §3, §6 |
| **v1.2** | Subjects (5 starters + 15 derived + prereq graph) + per-subject 10-tier mastery | `canvas-design.md` §7 |
| **v1.3** | Quality formula + style/palette sliders + gamble (5 levels) + rare masterpiece RNG bonus | `canvas-design.md` §§5, 6, 8, 10 |
| **v1.4** | Multi-canvas (up to 8 slots) + Canvas-branch skill tree (17 nodes) + 9 canvas-derived affix types | `canvas-design.md` §9, §12 |
| **v1.5** | Workshop tier rolls (6 tiers) + set rolls (6 sets) + full affix pool + slot implicits (8 slots) | `workshop-design.md` §3, §4, §7 |
| **v1.6** | Workshop conveyor (rate formula 1-8.75 items/min, gold drain 200g/item, auto-pause) + 31-node Workshop skill-tree branch | `workshop-design.md` §9, §11 |
| **v1.7** | Workshop paid actions (reroll, upgrade, set-target, persistence-craft) + persistence vault (4 pin slots + unlimited vault) | `workshop-design.md` §10 |
| **v1.8** | Workshop 3-column UI rebuild (drag-drop equip, stash filter/sort/search, conveyor strip) | `workshop-design.md` §13 |
| **v2.0** | Offline progress (F-style hybrid, 24h cap) + Painter's Office RPG redesign (hire/level/evolve/specialize, additional canvases) | new spec(s) |
| **v2.1+** | Painting School (research mechanic), Expositions (quest-like gold bonuses), audio (8-bit, per-mechanic), achievements, hidden mechanics, secrets | new specs each |
| **v3.x** | Multi-art-form architecture (sculpture, music, etc.), self-hosted backend deployment with `playerId`-keyed remote save, public hosting + auth | major redesign |

The four current design specs (canvas, workshop, info-panel, rescope) are **wave-roadmap source-of-truth**, not v1 deliverables.

### 2.2 Permanently out of scope

- Mobile-first design.
- Multiplayer / trading / leaderboards.
- French language. The game ships in English only from Day 1.

### 2.3 Deferred (possible later, not v1)

- **Offline progress.** v1 pauses on tab-hide, no catch-up on tab-show. Save still happens on visibility change and on interval.
- **Painter's Office, Painting School, Expositions.**
- **Audio (Howler or similar).**
- **Achievements, events, quests, hidden mechanics, secrets.**
- **Multi-art-form architecture.** v1 is painting-flat; refactor when the second art form arrives (YAGNI).
- **PWA / install-as-app.**

---

## 3. Tech stack

### 3.1 Core runtime

| Package | Version | Why |
|---|---|---|
| `react`, `react-dom` | 19.x (latest stable) | React 19 is the current stable line as of 2026-05-01 (~17 months stable). No project-relevant breaking changes from 18. |
| `typescript` | latest 5.x | strict mode (`"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`). |
| `vite` | latest | Dev server + build. |
| `tailwindcss` | 4.x | **CSS-first config (no `tailwind.config.ts` — design tokens live in CSS variables).** This is a meaningful difference from the v1 port plan. |
| `zustand` | 5.x | Slice pattern + `persist` middleware with custom storage adapter. |
| `idb-keyval` | latest | IndexedDB primitive backing the `SaveAdapter`. |
| `break_eternity.js` | latest | Big-number library for fame curves and late-game formulas. |
| `motion` | latest | Animation library (formerly framer-motion). Use `motion/react` import path for tree-shaking. |
| `uuid` | latest | UUID v4 generation for `playerId`. |

### 3.2 Test + lint

| Package | Why |
|---|---|
| `vitest` | Vite-native test runner. |
| `@testing-library/react` | Sparse component-level UI tests. |
| `eslint`, `@typescript-eslint/*`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` | Standard React+TS lint stack. |
| `prettier` | Format on save. |

### 3.3 Versions to verify at scaffold time

The "latest" pins above will resolve to specific versions when `npm install` runs. The implementation plan's Phase 0 task includes a step to record the resolved versions in the spec for reproducibility. If a major version has shipped between this spec and Phase 0 execution that changes any of the patterns described here, the plan calls out the migration before installing.

### 3.4 Things NOT installed in v1

- `@dnd-kit/*` — v1 has 1 equip slot, click-to-equip is enough.
- `howler` — v1 has no audio.
- `react-router-dom` — v1 is single-window with view-switcher state, no router.
- `msgpack-lite` — IDB doesn't need compression at v1 scale.

---

## 4. Project layout

```
artdle-web/
├── public/
│   ├── icon.svg
│   └── assets/
│       └── artdle/                    # copied from Godot artdleAsset/
│           ├── Currency/coin.png
│           ├── Currency/Inspiration.png
│           ├── Currency/fame.png
│           ├── tree/...
│           └── items/...
│
├── src/
│   ├── main.tsx                       # ReactDOM root; gates app on save rehydration
│   ├── App.tsx                        # layout shell (TopBar / view / InfoPanel / BottomBar)
│   │
│   ├── core/                          # pure, no-React utilities
│   │   ├── bigNumber.ts               # break_eternity.js wrapper
│   │   ├── formatter.ts               # K/M/B/T short-form
│   │   ├── balance.ts                 # ALL formulas + tuning constants
│   │   ├── icons.ts                   # asset-URL registry
│   │   ├── rng.ts                     # seedable RNG (mulberry32)
│   │   ├── tickLoop.ts                # RAF + visibilitychange (no offline progress in v1)
│   │   └── playerId.ts                # UUID v4 generation/lookup
│   │
│   ├── config/                        # data only, no logic
│   │   ├── treeStages.ts              # 3 stages, parts, costs (v1)
│   │   ├── workshopAffixes.ts         # 3-affix pool (v1) + magnitude ranges
│   │   └── skillTreeNodes.ts          # 5 nodes (v1)
│   │
│   ├── store/                         # Zustand store (one store, slices)
│   │   ├── index.ts                   # combined `useGameStore` + persist({ storage: idbAdapter })
│   │   ├── metaSlice.ts                # playerId + ascendCount (run-permanent meta)
│   │   ├── hoverInfoSlice.ts
│   │   ├── currencySlice.ts           # gold + inspiration + fame
│   │   ├── treeSlice.ts
│   │   ├── canvasSlice.ts             # single slot, simple state machine
│   │   ├── workshopSlice.ts           # click-to-craft, 1 equipped item
│   │   ├── ascendSlice.ts
│   │   └── skillTreeSlice.ts
│   │
│   ├── systems/
│   │   ├── persistence.ts             # SaveAdapter interface + IDBKeyvalAdapter
│   │   └── ascend.ts                  # orchestrated reset
│   │
│   ├── ui/
│   │   ├── views/
│   │   │   ├── HomeView.tsx           # tree (main panel)
│   │   │   ├── PaintingView.tsx       # canvas slot + Workshop button
│   │   │   ├── AscensionView.tsx      # palier + fame preview + ascend
│   │   │   └── SkillTreeView.tsx
│   │   ├── popups/
│   │   │   └── WorkshopPopup.tsx      # craft button + equipped-item display
│   │   └── widgets/
│   │       ├── TopBar.tsx
│   │       ├── BottomBar.tsx          # 3 currency displays
│   │       ├── InfoPanel.tsx          # fixed strip, NOT tooltip
│   │       ├── Hoverable.tsx
│   │       └── CurrencyDisplay.tsx
│   │
│   └── tests/                         # Vitest tests (mirror src/ structure)
│       ├── core/
│       ├── store/
│       └── systems/
│
├── docs/
│   ├── PORT_PLAN.md                   # this file (renamed when copied to new repo)
│   └── specs/                         # the 4 Godot design specs, copied verbatim
│       ├── 2026-04-24-artdle-rescope-design.md
│       ├── 2026-04-25-canvas-design.md
│       ├── 2026-04-26-workshop-design.md
│       └── 2026-04-25-info-panel-design.md
│
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── postcss.config.js
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
└── README.md
```

**Notable absences** (compared to v1 port plan layout): no `paintMasterySlice.ts`, no `persistenceVaultSlice.ts`, no `workshopProcsSlice.ts`, no `conveyor.ts`, no `procs.ts`, no full `affixes.ts` / `setBonuses.ts` / `slotImplicits.ts` / `subjects.ts` / `canvasTiers.ts`. Those land in the relevant waves.

---

## 5. Architecture

### 5.1 State management — one Zustand store with slices

Same pattern as the v1 port plan §6.1. The combined `GameStore` interface unions every slice's state and actions; `persist` middleware wraps the store with the IDB adapter.

```ts
// src/store/index.ts (sketch)
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbAdapter } from "@/systems/persistence";
import { createCurrencySlice } from "./currencySlice";
import { createTreeSlice } from "./treeSlice";
// ... other slices

export type GameStore = CurrencySlice & TreeSlice & /* ... */;

export const useGameStore = create<GameStore>()(
  persist(
    (...a) => ({
      ...createCurrencySlice(...a),
      ...createTreeSlice(...a),
      // ...
    }),
    {
      name: "artdle-save",
      version: 1,
      storage: createJSONStorage(() => idbAdapter),
      migrate: (persisted, fromVersion) => persisted as GameStore,
      partialize: (s) => {
        const { hoverTitle, hoverBody, hoverFooter, ...rest } = s;
        return rest;
      },
    }
  )
);
```

### 5.2 SaveAdapter interface

```ts
// src/systems/persistence.ts
import { get, set, del } from "idb-keyval";

export interface SaveAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export const idbAdapter: SaveAdapter = {
  getItem: async (key) => (await get<string>(key)) ?? null,
  setItem: async (key, value) => set(key, value),
  removeItem: async (key) => del(key),
};
```

The adapter is async (Zustand's `createJSONStorage` accepts async). Future `RemoteSyncAdapter` (v3.x) implements the same shape: read from IDB, push to server, return.

### 5.3 Async rehydration — gate the app, don't flash

**Footgun warning:** IDB is asynchronous. On first render, the store has its in-memory defaults until rehydration finishes. Rendering the game with `gold = 0` for a frame and then snapping to the persisted value is jarring.

**v1 chooses to gate on rehydration completion:**

```tsx
// src/main.tsx (sketch)
import { useEffect, useState } from "react";
import { useGameStore } from "@/store";

function Bootstrap() {
  const [hydrated, setHydrated] = useState(useGameStore.persist.hasHydrated());

  useEffect(() => {
    const unsub = useGameStore.persist.onFinishHydration(() => setHydrated(true));
    return unsub;
  }, []);

  if (!hydrated) return <LoadingScreen />;
  return <App />;
}
```

`<LoadingScreen />` is a one-line "Loading…" stub for v1; later it can show the artdle logo + a 1-2s fade.

### 5.4 playerId — single source of truth

`playerId` lives **inside the in-memory store and is persisted in the IDB save object.** No localStorage involvement.

**Mechanism:** the slice that owns `playerId` initializes it with `uuidv4()` on store creation. On a fresh save (no persisted data), the initializer's UUID stays. On a returning save, `persist` rehydration overwrites the in-memory value with the saved one. Either way, after the rehydration gate (§5.3) clears, `playerId` is set and stable.

```ts
// src/store/metaSlice.ts (sketch — owns playerId + ascend_count + version-related fields)
import { v4 as uuidv4 } from "uuid";

export interface MetaSlice {
  playerId: string;
  ascendCount: number;
}

export const createMetaSlice: StateCreator<GameStore, [], [], MetaSlice> = () => ({
  playerId: uuidv4(),     // overwritten by persist rehydration if a save exists
  ascendCount: 0,
});
```

The ascend reset preserves `playerId` explicitly (don't replace the whole state object — merge).

### 5.5 Versioned save schema with `migrate` chain

`version: 1` from Day 1. The migration is a genuine no-op for v1 because there's no v0 to migrate from; the chain exists so future waves can append migrations:

```ts
migrate: (persisted: unknown, fromVersion: number): GameStore => {
  // v1 has no prior version; this is the seed.
  // Future waves (e.g., v2.0 adds Painter's Office state):
  //   if (fromVersion < 2) state = migrateToV2(state);
  return persisted as GameStore;
},
```

Failure mode: if `migrate` throws or `persisted` is shaped wrong, present a "save corrupted — start new run" modal (v1 stub: a one-line confirm dialog).

### 5.6 No hard-coded asset URLs

All assets imported via Vite:

```ts
import coinUrl from "@/assets/artdle/Currency/coin.png";
```

Vite `base` config defaults to `/`. When deployment phase arrives, base becomes whatever the host requires — no code change needed.

### 5.7 Anti-cheat — noted, not built

Saves are tamper-able by anyone with DevTools. v1 does not defend against this. A public hosted version (v3.x) needs server-authoritative state — at which point gameplay actions go through the server and the client becomes a thin renderer. That's a v3 design problem, mentioned here so future-you sees it on the roadmap.

### 5.8 Tick loop — RAF + visibilitychange, no offline catch-up

```ts
// src/core/tickLoop.ts
import { useGameStore } from "@/store";

let last = performance.now();
let rafId = 0;

function step(now: number) {
  const delta = Math.min((now - last) / 1000, 1.0);
  last = now;
  useGameStore.getState().tick(delta);
  rafId = requestAnimationFrame(step);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    cancelAnimationFrame(rafId);
    // Save on hide; persist middleware writes synchronously through the IDB adapter.
  } else {
    last = performance.now(); // no catch-up; v1 ignores elapsed offline time
    rafId = requestAnimationFrame(step);
  }
});

export function startTickLoop() {
  last = performance.now();
  rafId = requestAnimationFrame(step);
}
```

**v1 explicitly has `MAX_CATCHUP_SECONDS = 0`.** Tab hidden = no ticking. Tab visible = resume from now. The 24h F-style hybrid catch-up arrives in v2.0.

A periodic save fires every ~10 seconds in addition to visibilitychange (Zustand `persist` re-saves on state change, but a wall-clock interval guards against long stretches of unsaved state when no actions happen).

### 5.9 InfoPanel — fixed strip, not tooltip

Same as v1 port plan §6.5. `HoverInfoSlice` push/clear, `<Hoverable>` wrapper, `<InfoPanel>` reader. **Do not use Radix Tooltip / Popover.**

Content authoring rules from `2026-04-25-info-panel-design.md` §6 apply: numbers always, costs always, state always, concept entries explain what the thing IS and what it gives.

### 5.10 Big numbers — break_eternity.js

`fame`, `palierAscend(count)`, late-game inspi values use `Decimal` (`Big`). v1 only formally needs Big for the palier and fame conversion; rest of v1's quantities fit in JS numbers. Wrap everything that crosses a tier-bumpable threshold to be safe.

### 5.11 RNG — seedable

`mulberry32`-based, seeded once on app start with `Date.now()`. Tests call `setSeed(42)` for determinism. v1 rolls RNG only for workshop affix magnitude (one roll per craft).

### 5.12 Formulas — single `balance.ts` module

Every formula lives in `src/core/balance.ts`; every formula has a Vitest test in `src/tests/core/balance.test.ts`. Discipline copied from the Godot rebuild's MVP rescope spec §12.

```ts
// src/core/balance.ts (v1 sketch)
import { big, type Big } from "./bigNumber";

export const palierAscend = (count: number): Big =>
  big(1000).mul(big(2).pow(count));

export const fameOnAscend = (inspi: Big): number =>
  Math.floor(Math.log10(Math.max(1, inspi.toNumber())) * 10);

export const treePartCost = (level: number, baseCost: number): Big =>
  big(baseCost).mul(big(1.15).pow(level));

export const canvasGold = (multiplier: number): Big =>
  big(10).mul(multiplier);

export const inspiPerSec = (parts: ReadonlyArray<{level: number; rate: number}>, multiplier: number): Big =>
  parts.reduce((acc, p) => acc.add(big(p.level).mul(p.rate)), big(0)).mul(multiplier);
```

### 5.13 Animation — Motion (light polish)

v1 uses Motion sparingly:
- Floating gold-text on canvas finish (`<motion.div>` with y/opacity transition).
- Tree stage transition fade (`AnimatePresence`).
- Fame increment pulse on ascend.

Do not animate the canvas progress bar with Motion — drive it from store state with CSS `width: ${pct}%` transition. RAF + CSS is sufficient.

---

## 6. Testing

| Phase | Test count target | Files |
|---|---|---|
| 1 (core) | ~30 | balance, bigNumber, formatter, persistence (round-trip), playerId (uuid + migration) |
| 2 (loop) | ~30 | tree (stage transitions, accrual), canvas (state machine, gold credit) |
| 3 (workshop + ascend + skill tree) | ~40 | workshop (craft cost, affix roll, equip), ascend (palier detection, fame conversion, reset preserves correct slices), skill tree (fame spend, prereq) |
| 4-6 (UI + polish) | ~20 | sparse component tests; hover-info push/clear |

**v1.0 test budget: ~120 tests.** Compared to the Godot project's 433 tests, this is light because v1 has fewer systems. Each post-v1.0 wave adds ~30-100 tests as it brings spec features online; by v1.8 the test count should mirror the Godot project's coverage.

Formula tests come first; UI tests last (component-level, sparse).

---

## 7. Phasing — V1.0

The original port plan had Phase 0–10. Stripped v1 collapses to **Phase 0–6**.

### Phase 0 — Scaffold (1 commit)

- `npm create vite@latest . -- --template react-ts`
- Install: `react@latest react-dom@latest zustand@latest motion@latest break_eternity.js@latest idb-keyval@latest uuid@latest`
- Install dev: `tailwindcss@latest postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom jsdom @types/uuid eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-react-hooks eslint-plugin-react-refresh prettier`
- Tailwind 4 CSS-first init: create `src/index.css` with `@theme` variables for tier colors and base palette (replaces `tailwind.config.ts`).
- `tsconfig.json` strict (per v1 port plan §5.4).
- `vite.config.ts` with alias + Vitest config (per v1 port plan §5.5).
- `package.json` scripts: `dev`, `build`, `preview`, `test`, `test:watch`, `lint`, `format`.
- **Record resolved versions** of every installed package in a `VERSIONS.md` or in this spec's §3.3.
- First commit: `scaffold: vite + react 19 + ts strict + tailwind 4 + zustand 5`.

### Phase 1 — Core primitives + persistence

- `src/core/bigNumber.ts`, `formatter.ts`, `balance.ts` (v1 formulas: palier, fame, tree part cost, canvas gold, inspi-per-sec), `rng.ts` (mulberry32 + setSeed), `tickLoop.ts`, `playerId.ts`.
- `src/systems/persistence.ts`: `SaveAdapter` interface + `IDBKeyvalAdapter`.
- `src/store/index.ts`: combined store skeleton, `persist` middleware with `idbAdapter`, `version: 1`, `migrate` no-op stub, `partialize` for hover-info.
- `src/store/metaSlice.ts` (playerId + ascendCount), `currencySlice.ts`, `hoverInfoSlice.ts`.
- Async-rehydration gate in `src/main.tsx` with `<LoadingScreen />` stub.
- **Tests:** balance (palier at counts 0/1/5/20, fame conversion at thresholds, never-zero on inspi=0), bigNumber (overflow → cap, never zero), formatter (K/M/B/T), currencySlice (spend atomic, reset preserves permanents), persistence round-trip (set → get returns equivalent), playerId (generated when missing, preserved when present).

### Phase 2 — Tree + Canvas (single slot, simple)

- `src/config/treeStages.ts`: 3 stages (Seed / Sapling / Tree), 2-3 parts each, cost progression, base rates.
- `src/store/treeSlice.ts`: passive `inspiPerSec` accrual via tick, part upgrade actions, stage advancement.
- `src/store/canvasSlice.ts`: state machine (`idle → painting → done → autoSale`), single slot, fixed paint-time, auto-sell.
- `src/core/tickLoop.ts` wired to RAF; `tick(delta)` calls `tree.tick(delta)` and `canvas.tick(delta)`.
- No UI yet beyond a tiny REPL component for sanity.
- **Tests:** tree stage transitions on threshold, upgrade cost progression, canvas state machine transitions, gold credit on auto-sale, single-slot pacing.

### Phase 3 — Workshop + Ascend + Skill tree

- `src/store/workshopSlice.ts`: click-to-craft action (validates gold, rolls 1 affix from `workshopAffixes.ts`), equip action, equipped-item state.
- `src/config/workshopAffixes.ts`: 3-affix pool with magnitude ranges (e.g., `+canvas_gold%: 5–15`, `-paint_time%: 5–15`, `+inspiration_rate%: 5–15`).
- `src/systems/ascend.ts`: orchestrated reset (currency → 0 except fame, tree → fresh, canvas → fresh, equipped item → null), preserves fame, ascend_count, skill tree, playerId.
- `src/store/ascendSlice.ts`: `canAscend()` selector, `performAscend()` action.
- `src/store/skillTreeSlice.ts`: 5-node purchase actions, fame spend.
- `src/config/skillTreeNodes.ts`: 5 nodes with linear prereq chain.
- **Tests:** workshop (craft validates gold, affix in range, equip replaces correctly, affixes apply to canvas/tree); ascend (palier detection at exact threshold, fame conversion at edge cases, reset preserves correct slices, preserves playerId); skill tree (fame spend, prereq gate).

### Phase 4 — UI shell + 4 views

- `App.tsx`: TopBar / `<main>` / `<InfoPanel>` / `<BottomBar>` layout (always-visible InfoPanel between content and bottom bar).
- View switcher (zustand `currentView` flag; no router).
- Views: `HomeView` (tree + part upgrades), `PaintingView` (canvas slot + Workshop button), `AscensionView` (palier + fame preview + ascend button), `SkillTreeView`.
- Widgets: `BottomBar` (3 currency displays), `CurrencyDisplay`, `InfoPanel`, `Hoverable`.
- **Tests:** sparse — `BottomBar` renders 3 currencies, `AscensionView` disables ascend button below palier.

### Phase 5 — Hover-info wiring + Workshop popup

- Apply `<Hoverable>` to every interactive element (parts, ascend button, sub-mech buttons in PaintingView, skill nodes, currency displays).
- Bodies use `() =>` callbacks for live values per content authoring rules.
- `WorkshopPopup.tsx`: craft button + cost display + equipped-item card. Click to craft, click to equip the freshly-rolled item (replacing any equipped one).
- **Tests:** hoverInfoSlice push/clear; one integration test that mounts `<Hoverable>` and asserts the slice updates; workshop popup integration (craft → item appears → equip → affix applies).

### Phase 6 — Polish + balance pass + ship

- Motion: floating-text on canvas finish, tree stage transition fade, ascend pulse.
- v1 balance pass: tune base costs, accrual rates, palier scaling, affix magnitudes. Goal: a fresh-save player reaches their first ascend in 5-15 minutes; second ascend is faster; by ascend 5-10 the player feels skill tree investment is meaningful.
- **Tuning question to answer in this phase:** does the 3-affix workshop pool feel thin? If yes, expand to 4-5 affixes here, not later.
- README write-up + first deploy-ready build (`npm run build` produces a working `dist/`).
- Tag v1.0.

**End of v1.0.** Game is end-to-end playable: tree growing, canvas painting, workshop crafting items, equipped item boosts production, ascend works, fame buys skill tree nodes, save persists across sessions.

---

## 8. Definition of done — V1.0

1. All 3 currencies (gold, inspiration, fame) implemented and persisted.
2. 3 tree stages with parts, upgrades, stage transitions all working.
3. Canvas paints, sells, credits gold, single slot.
4. Workshop crafts items (1 implicit affix from 3-pool), equips 1 slot, affixes apply to gameplay.
5. Ascend works: palier detected, fame gained, run resets correctly, fame + skill tree + ascend count preserved.
6. Skill tree: 5 nodes purchasable with fame, applies to gameplay.
7. Save/load works: IDB persistence via `idb-keyval`, async rehydration gated by loading screen, save survives a page refresh and a 30-day idle gap.
8. `playerId` UUID generated on first launch, preserved across saves and ascends.
9. Versioned save schema (`version: 1`), `migrate` chain in place (no-op for v1).
10. Hover info wired on every interactive surface, content follows the info-panel content authoring rules.
11. ~120 Vitest tests passing.
12. Bundle size: < 250 KB gzipped (smaller than v1 port plan's 500 KB target because v1 doesn't ship dnd-kit, full motion library use, or Workshop UI complexity yet).
13. Cold-load FPS: 60 stable on a mid-range 2020 laptop. Warm-load: instant from cache.
14. A complete play-through (start → 3-5 ascends → close tab → reopen → continue → save still works) runs without bug.

---

## 9. Risks / things to watch

- **Async IDB rehydration on first frame.** Mitigated by §5.3 loading-screen gate.
- **`playerId` preservation across migrations.** Easy to drop accidentally if a `migrate` step replaces the whole state. Always merge, never replace.
- **Tick loop drift.** RAF delta capped at 1.0s per §5.8 to prevent stutter-induced fast-forward.
- **Zustand re-render storm.** Components subscribing to whole-store state re-render every tick. Always use selectors.
- **Save migration discipline.** Phase 1 writes the no-op `migrate` stub; future waves add to it. Skipping a migration when changing schema breaks every existing save.
- **Tailwind 4 CSS-first config is unfamiliar territory.** Migration cost from the v1 port plan's `tailwind.config.ts` shape is real; allow time in Phase 0 for the CSS-variable theme structure.
- **The 3-year balance target is a roadmap-level concern, not a Phase-6 deliverable.** v1 balance pass tunes for 1-3 hours of play. The 3-year target only becomes testable once multiple waves are in.
- **Anti-cheat is unaddressed.** v1 explicitly accepts this. Public-hosted v3.x will need server-authoritative state — that's a redesign, not an extension.

---

## 10. First-week milestones

A concrete checklist for the first week of the new repo:

- [ ] Day 1: scaffold (Phase 0) + first commit. Resolved versions recorded.
- [ ] Day 2: `bigNumber.ts`, `formatter.ts`, full Vitest setup, 10+ formula tests passing.
- [ ] Day 3: `balance.ts` (palier, fame, tree-part-cost, canvas-gold, inspi-per-sec). All tests green.
- [ ] Day 4: `currencySlice` + `idbAdapter` + `persist` + async rehydration gate + round-trip test + `playerId` test.
- [ ] Day 5: `treeSlice` + `treeStages.ts` (3 stages) + `tickLoop.ts` + accrual tests.
- [ ] Day 6: `canvasSlice` (single slot) + state-machine tests.
- [ ] Day 7: `workshopSlice` + click-to-craft + equip + affix application tests.

**End of week 1: Phases 0-2 done, Phase 3 underway, no UI yet, ~80 tests passing.**

---

## 11. References (read order if starting fresh)

These are **wave-roadmap source-of-truth** for v1.1+. V1 itself does not implement them.

1. `2026-04-24-artdle-rescope-design.md` — read first. The original MVP frame.
2. `2026-04-25-info-panel-design.md` — cross-cutting infra (already applied in v1).
3. `2026-04-25-canvas-design.md` — gold-faucet system (waves v1.1-v1.4).
4. `2026-04-26-workshop-design.md` — deepest system (waves v1.5-v1.8).
5. `2026-05-01-web-port-plan.md` — original port plan, superseded by this doc but useful for the full-design rationale.

---

## 12. Snapshot of the Godot source you're porting from

`HEAD = e72a850` on the Godot repo's `feat/workshop` branch (2026-04-27). The four design specs and `artdleAsset/` are the only artifacts copied verbatim into the new repo. Everything else is rebuilt.

---

## 13. Out of scope (V1.0 web)

- Painter's Office (deferred to v2.0).
- Painting School (deferred to v2.1+).
- Expositions (deferred to v2.1+).
- Audio (Howler or similar, 8-bit per-mechanic) — deferred.
- Achievements, events, quests, hidden mechanics, secrets — deferred.
- Multi-art-form architecture (sculpture, digital, etc.) — deferred to v3.x.
- Offline progress catch-up — deferred to v2.0 (F-style hybrid, 24h cap).
- PWA / install-as-app — deferred.
- Mobile-first design — **permanently out**.
- Multiplayer / trading / leaderboards — **permanently out**.
- French language — **permanently out**. The game ships in English only.
- Backend / cloud save / accounts — deferred to v3.x.
- Anti-cheat / server-authoritative state — deferred to v3.x.

---

## 14. Architectural decisions worth knowing (carry-forward)

From the Godot rebuild's HANDOVER, two carry to web:

- **Per-canvas state is the source of truth** for any per-instance computation. Don't store per-canvas data on a shared object — store it on the canvas instance itself. (V1 has a single canvas, so this is academic, but it matters from v1.4 multi-canvas onward.)
- **Auto-restart synchronously triggers another finish in the same tick.** A single `tick(delta)` with `delta > paint_time` triggers ONE finish + ONE auto-restart. Tests must account for this. (V1 has auto-sell but no auto-restart; the gotcha matters once auto-restart lands in v1.1.)

---

This document supersedes `2026-05-01-web-port-plan.md`. The original is preserved for the full-design rationale but should not be used as the implementation reference.
