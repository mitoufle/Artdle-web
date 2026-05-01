# Artdle Web — Handover (Fresh Project)

**Date:** 2026-05-01
**Status:** Pre-scaffold. The repo does not exist yet — this handover folder is staged content for the new repo.

---

## The story so far

The project started as a Godot 4 idle painting game (`~/Documents/artdle/`). After three months of MVP rebuild + Canvas + Workshop backend implementation in Godot, the decision was made on 2026-05-01 to **port to the web** — fresh repo, fresh stack, no Godot inheritance beyond the design specs and assets.

A 2026-05-01 brainstorming session produced two specs:

1. The original `web-port-plan.md` (full-design v1) — superseded.
2. The active **`PORT_PLAN.md`** (v1 stripped + wave roadmap) — what we're actually building.

V1 = minimum playable loop with 5 stripped systems (Tree, Canvas, Workshop, Skill Tree, Ascend). Each system in its lightest playable form. Feature richness deferred to waves v1.1 → v1.8 (which port the Canvas and Workshop design specs incrementally), then v2.x (Painter's Office, Painting School, Expositions, audio, offline progress), then v3.x (multi-art-form, backend, public hosting).

The first implementation plan covers **Phase 0 + Phase 1** (scaffold + foundations). It's at `docs/superpowers/plans/2026-05-01-artdle-web-phase0-1.md`.

---

## What's in this handover folder

```
artdle-web-handover/
├── CLAUDE.md                              # auto-loaded by Claude Code; project intro + conventions
└── docs/
    ├── HANDOVER.md                        # this file
    ├── PORT_PLAN.md                       # the v1 spec (authoritative)
    ├── specs/                             # 4 source Godot design specs (reference for waves)
    │   ├── 2026-04-24-artdle-rescope-design.md
    │   ├── 2026-04-25-canvas-design.md
    │   ├── 2026-04-25-info-panel-design.md
    │   └── 2026-04-26-workshop-design.md
    ├── superpowers/plans/
    │   └── 2026-05-01-artdle-web-phase0-1.md   # Phase 0 + 1 plan (31 tasks, ~2400 lines)
    └── agent_docs/
        ├── architecture.md                # Zustand pattern, persistence, tick loop, big numbers
        ├── conventions.md                 # TS strict, file structure, slice anatomy, TDD discipline
        └── workflow.md                    # subagent-driven dev, plan execution, when stuck
```

---

## How to start the new project

**Run these in a regular shell (not Claude Code) — this is one-time bootstrap before the first Claude session.**

```bash
# 1. Create the new repo directory (clean, empty)
mkdir -p /c/Users/mitoufle/Documents/artdle-web
cd /c/Users/mitoufle/Documents/artdle-web

# 2. Verify it's empty
ls -A
# Expected: nothing (or only .git if you ran git init somehow)

# 3. Copy this handover bundle into it
cp -r /c/Users/mitoufle/Documents/artdle-web-handover/* .
cp /c/Users/mitoufle/Documents/artdle-web-handover/CLAUDE.md .

# 4. Verify
ls
# Expected: CLAUDE.md, docs/

# 5. Start a fresh Claude Code session in this directory
# (open a new terminal here, run: claude)
```

**Then in the fresh Claude session, your first message can be:**

> Read CLAUDE.md and docs/HANDOVER.md. We're starting Phase 0 of the plan at docs/superpowers/plans/2026-05-01-artdle-web-phase0-1.md. Use the subagent-driven-development skill to execute it task-by-task. Start with Task 1.

Claude will then:
1. Read CLAUDE.md (auto) and HANDOVER.md.
2. Load the plan.
3. Invoke subagent-driven-development.
4. Dispatch a subagent for Task 1 (the Vite scaffold), which will run `npm create vite@latest . --template react-ts` in the now-empty parent directory.

Wait — Task 1's `npm create vite` in a non-empty directory will prompt. Two options:

- **Option A (recommended):** Don't pre-populate. Run Task 1 first (Vite scaffold in empty dir), then commit, then copy the handover bundle in, then commit again. Adjust the bootstrap above to: skip step 3 until after Vite scaffold completes; then copy + commit.
- **Option B:** Pre-populate, then choose "Ignore files and continue" when Vite prompts.

Updated bootstrap (Option A — cleaner):

```bash
# 1. Create empty directory
mkdir -p /c/Users/mitoufle/Documents/artdle-web
cd /c/Users/mitoufle/Documents/artdle-web

# 2. Vite scaffold in empty dir (no prompt)
npm create vite@latest . -- --template react-ts
npm install
git init && git add -A && git commit -m "scaffold: vite react-ts template"

# 3. NOW copy the handover bundle (won't conflict with scaffold)
cp -r /c/Users/mitoufle/Documents/artdle-web-handover/docs .
cp /c/Users/mitoufle/Documents/artdle-web-handover/CLAUDE.md .
git add docs CLAUDE.md
git commit -m "docs: add handover bundle (CLAUDE.md, port plan, specs, plans, agent docs)"

# 4. Start Claude Code session
claude
```

**Note:** the plan's Task 1 also does `mkdir + npm create vite + git init + initial commit`. If you've done it manually as above, the plan execution skips Task 1 (or treats it as already done). Tell Claude in your first message which tasks are already complete.

---

## Active plan execution state

- **Plan:** `docs/superpowers/plans/2026-05-01-artdle-web-phase0-1.md`
- **Tasks:** 31 (Phase 0: Tasks 1-13 scaffold; Phase 1: Tasks 14-31 core primitives + persistence)
- **State:** none executed yet (or, if you followed Option A bootstrap above, Task 1 is done — Tasks 2 onward to run via subagent).
- **End state:** ~80 tests passing, project compiles, save persists across refresh, playerId stable.

---

## What comes after Phase 0+1

The current plan covers only the scaffold and foundations. **No game logic yet.** Subsequent plans (one per phase, written after each completes):

- **Phase 2:** Tree + Canvas slices, tick wired, end-to-end inspiration accrual + canvas auto-sale (no UI).
- **Phase 3:** Workshop click-to-craft, Ascend, Skill Tree (5 nodes).
- **Phase 4:** UI shell + 4 view stubs.
- **Phase 5:** Hover-info wiring + Workshop popup.
- **Phase 6:** Polish (Motion) + balance pass + ship v1.0.

After v1.0 ships, the wave roadmap (`PORT_PLAN.md` §2.1) takes over — each wave is its own brainstorming → spec → plan → execution cycle.

---

## Key decisions to remember

| | |
|---|---|
| Trajectory | local browser → self-hosted backend → public hosted (long-term arc) |
| V1 scope | 5 stripped systems only; Workshop is click-to-craft, no conveyor/sets/tiers |
| Stack | React 19, Tailwind 4 CSS-first, Vite latest, Zustand 5, Vitest, idb-keyval, break_eternity.js |
| Persistence | IndexedDB via `idb-keyval`, async rehydration gated by `<LoadingScreen>` |
| `playerId` | UUID v4 inside the save object; generated by meta slice initializer |
| Offline progress | NONE in v1; tab pause = no ticking. v2.0 adds 24h hybrid catch-up |
| Language | English only (forever) |
| Workflow | Subagent-driven development (one subagent per plan task, review between) |

---

## Where the Godot reference lives

The Godot project remains at `~/Documents/artdle/` on branch `feat/workshop` at HEAD `e72a850` (2026-04-27). The four design specs in `docs/specs/` were copied from there. The `artdleAsset/` directory contains art assets — Plan Task 12 copies them into `public/assets/artdle/` during execution. Phase 0 should NOT touch the Godot repo.

---

## When this HANDOVER.md becomes stale

Replace its contents at every major milestone. Keep it as the single document that future-you (or a new Claude session) reads first to know "where are we, what's next." Don't let it accrete history — overwrite the snapshot, don't append.
