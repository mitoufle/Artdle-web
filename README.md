# Artdle

An idle painting game. Grow an inspiration tree, paint canvases for gold, ascend at threshold to convert inspiration into permanent fame, then spend that fame in a skill tree.

This repo is the **web port** of an earlier Godot prototype. v1 ships the minimum playable loop; later waves add the Painter's Office, Painting School, Expositions, and other systems from the source design specs.

---

## How to play

The loop has four screens, accessible from the top bar:

- **Tree** — Grow the inspiration tree. Buy parts (each level costs gold and produces inspiration/sec). When you have enough levels in the current stage, click **Grow next stage** to advance Seed → Sapling → Tree.
- **Painting** — A canvas auto-paints over time and sells for gold. Open the **Workshop** popup to craft items with random affixes (e.g., +12% canvas gold). Equip them to boost your earnings.
- **Ascension** — When inspiration reaches the **palier**, ascend to convert inspiration into permanent **fame**. Run resets; fame and skill tree progress persist.
- **Skill Tree** — Spend fame on permanent unlocks (better starting parts, second equip slot, wider affix magnitude rolls, palier discount, paint-time discount).

Save persists locally (IndexedDB) — close the tab and come back; your tree and fame are still there. v1 has no offline progress: tab hidden = ticking pauses; tab visible = resume from now.

---

## Screenshots

> **Note:** screenshots pending. Run `npm run dev` and capture three views to populate `docs/screenshots/`:
> `home-tree.png` (Tree at the Sapling stage), `painting-canvas.png` (canvas mid-paint with an equipped item), `ascension-ready.png` (Ascend button enabled with inspiration past the palier).

---

## Tech stack

- **React 19** + **TypeScript 6** (strict, `verbatimModuleSyntax`).
- **Vite 8** for dev + production build.
- **Tailwind 4** (CSS-first config via `@theme` in `src/index.css`).
- **Zustand 5** as the single store, organised by slice. Persistence via the `persist` middleware over a custom **IndexedDB** adapter (`idb-keyval`), with throttled writes.
- **`break_eternity.js`** for big-number currencies (gold, inspiration, fame can grow past `Number.MAX_SAFE_INTEGER`).
- **Motion 12** for light animation polish (floating gold-text, stage transitions, fame pulse, popup fade).
- **Vitest 4** + `@testing-library/react` 16 + **jsdom** for ~270+ tests.

---

## Dev setup

Requires Node 20+ and npm.

```bash
# Clone
git clone https://github.com/mitoufle/Artdle-web.git
cd Artdle-web

# Install
npm install

# Run dev server (opens at http://localhost:5173)
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Production build (output: dist/)
npm run build

# Preview the production build locally
npm run preview

# Lint
npm run lint
```

The dev server exposes the Zustand store + `big` constructor on `window` for DevTools console debugging:

```js
useGameStore.getState();           // inspect
useGameStore.setState({ gold: big(1e6) });  // mutate
```

---

## Project map

The most useful documents to read first:

- **[`CLAUDE.md`](./CLAUDE.md)** — agent / contributor onboarding. Conventions, key pitfalls, project layout.
- **[`docs/HANDOVER.md`](./docs/HANDOVER.md)** — current state-of-the-project snapshot.
- **[`docs/PORT_PLAN.md`](./docs/PORT_PLAN.md)** — the v1 spec. Authoritative source for what's in v1 and what's deferred to later waves.
- **[`docs/specs/`](./docs/specs/)** — the four source design specs from the Godot prototype (reference for v1.1+ waves).
- **[`docs/superpowers/plans/`](./docs/superpowers/plans/)** — implementation plans by phase.

Codebase layout (`src/`):

```
src/
├── core/          # Pure utilities: bigNumber, formatter, balance, rng, tickLoop
├── config/        # Static data: tree stages, workshop affixes, skill nodes
├── store/         # Zustand slices + combined index
├── systems/       # Logic awkward inside slices: persistence, ascend, lifecycle, telemetry
└── ui/            # Views, popups, widgets
```

---

## Roadmap

v1.0 ships the minimum playable loop. Subsequent waves (per `docs/PORT_PLAN.md` §2.1) add:

- **v1.1** — Painter's Office + Painting School (the "between runs" meta loop).
- **v1.2** — Expositions (timed challenges).
- **v1.3** — Audio + achievements.
- **v1.5** — Drag-to-reorder equipped items, Workshop affix expansion.
- **v2.0** — Offline progress (24h hybrid catch-up), telemetry backend, possible accounts.

The 3-year long-term player-time target unlocks the full game once all waves are out. v1 itself plays in 1-3 hours.

---

## Status

v1.0-RC — feature-complete, polished, deploy-ready. The `v1.0` tag lands after a balance pass informed by playtest feedback (Phase 6b). End-to-end playable loop, ~270 unit + integration tests, < 100 KB gzipped.

Built primarily with [Claude Code](https://claude.ai/code) using the [superpowers](https://github.com/anthropics/skills) plan-driven workflow. See `docs/superpowers/plans/` for the full phase-by-phase implementation history.
