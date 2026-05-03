# v2.0 Visual Redesign — Design Spec

**Date:** 2026-05-04
**Status:** Draft for review
**Wave:** v2.0 (visual redesign — pure adaptation, no new game features)
**Source of truth:** `design_handoff_artdle/` (README.md, Hi-Fi mockup HTML, tokens.css/json, claude-code-prompt.md)
**Supersedes:** the v1.2 in-flight brainstorm (`memory/project_v12_scope.md`); v1.2 content (Quality axis, canvas update system, subjects) deferred until after v2.0 ships.

---

## 1. Context

v1.1 shipped the integer-PM redesign + canvas tiers (`v1.1` tag at `44dcb85`, pushed). After playtest, the user ran a separate UI design pass and produced a comprehensive handoff bundle: a hi-fi HTML mock of all four screens, a wireframe doc, design tokens (CSS + JSON), an implementation prompt template.

The handoff is **visual + structural** — it specifies the look and feel, the IA, the layouts, the typography, the animations. It does **not** specify game mechanics — those stay as v1.1.

**Scope intent (locked with the user):** v2.0 is **pure adaptation**. Take everything v1.1 has — currencies, formulas, slices, persistence, tests — and re-render it through the handoff's visual language. **No new features. No new content. No new upgrades. No new currencies. No new screens beyond the four already in v1.1.**

The v1.2 brainstorm (Size + Quality canvas axes, PM-gated workshop, etc.) is paused and resumes after v2.0 ships. The redesign establishes the visual home for those features so each subsequent wave drops content into known design slots.

---

## 2. Scope (strict)

In:

- New visual language across all 4 routes — fonts (Cinzel / JetBrains Mono / Inter), colors (tokens.css), layouts (per handoff hi-fi)
- React Router for `/tree`, `/painting`, `/ascension`, `/constellation`
- Drop Tailwind 4; replace with CSS Modules + `tokens.css`
- Add `react-router-dom`, `lucide-react`
- Persistent `<TopBar>` + `<BottomBar>` shell with currency dim-when-irrelevant logic
- 4 currency chips (gold / inspi / fame / **PM**) — PM uses new teal token
- Pixel-art SVGs: tree scene with motes/fireflies, easel + canvas frame, cavern + portal + crystals, constellation with twinkling stars
- One small data addition: `pastRuns: PastRun[]` on `metaSlice` (Ascension screen's ledger panel needs it; per-run history is genuinely useful and missing). Migration v6 → v7.
- Save migration v5 → v6: drop legacy `currentView` field (router replaces viewSlice)
- v1.1's existing 362 tests preserved minus viewSlice's; ~30 new component tests added

Explicitly out:

- New game features, new upgrades, new content (per user's explicit "no new feature just visual adaptation")
- Quality axis (v1.2 brainstorm) — deferred
- Subjects + per-subject mastery (canvas-design.md §7) — deferred
- Office, School, Lab room content — tabs visible-but-disabled, "coming soon" hover
- Expanded constellation node graph — only the 5 v1.1 nodes plot to the star map
- Past tier-specific landscape sprites for canvas (placeholder single landscape used)
- Fake locked-future content for visual richness (no placeholder upgrade tiles, no dim future nodes filling the constellation)
- Anti-cheat, accounts, multi-art-form (permanently out per CLAUDE.md)

---

## 3. Stack

### 3.1 Keep

- React 19, TypeScript strict
- Vite, Vitest
- Zustand 5 (slice pattern + `persist` middleware)
- `idb-keyval` (IndexedDB persistence — explicitly NOT downgrading to localStorage despite handoff's default)
- `break_eternity.js` (Big numbers)
- Motion (animation library) — used sparingly per handoff §Animations

### 3.2 Drop

- **Tailwind 4** (handoff hard rule: "no Tailwind unless I ask"). Per-component CSS Modules + global `tokens.css` replace utility classes.

### 3.3 Add

- `react-router-dom` (4 routes per handoff IA)
- `lucide-react` (icons; replaces emoji placeholders ⚒ 👤 📜 ⚗ 🖼)
- Web fonts: Cinzel, JetBrains Mono, Inter, Press Start 2P, VT323 (loaded via Google Fonts `<link>`)

---

## 4. Documented deviations from handoff

| # | Handoff says | v2.0 ships | Reason |
|---|---|---|---|
| 1 | Persist to localStorage | IndexedDB via `idb-keyval` | localStorage would be a downgrade from v1.1's tech; same persistence guarantees, more capacity, async-safe |
| 2 | "Three currencies, three colors, no exceptions" | 4 currencies (PM stays) | PM is v1.1's signature feature with 25 dedicated tests + integer-redesign; user reinterprets the rule as "those 3 specific currencies use those 3 specific colors" — PM is a 4th with its own teal token |
| 3 | Tree: 4 stages (Seed → Sapling → Young → Grand), 5 fixed upgrades (Roots/Trunk/Foliage/Branch/Bloom) | Tree: 3 stages + per-stage parts (existing v1.1 structure) | Pure-adaptation rule; restructuring tree counts as adding content |
| 4 | Canvas upgrades strip: 5 cells (Tier card + Strokes/Pigments/Auto-Sell/2nd Easel small cards) | 1 tile only (Tier card) | Pure-adaptation rule; small cards aren't existing v1.1 content. The strip layout is a future home for added upgrades |
| 5 | Constellation: ~18 nodes, locked future nodes drawn for visual scale | Constellation: only the 5 existing v1.1 nodes (Goldsmith / Patient Eye / Second Slot / Faster Strokes / Better Brush) | Pure-adaptation rule; fake locked nodes are fake content. Empty canvas filled with star twinkles |
| 6 | React 18 default | React 19 (existing) | "Match what's here" clause |
| 7 | Mock has emoji placeholders (⚒ 👤 📜 ⚗ 🖼) | lucide-react / custom pixel set | Handoff hard rule: no emoji in production |

---

## 5. PM (4th currency) tokens

Added to `tokens.css`:

```css
--pm:        #7adcd6;  /* paint-mastery currency, teal/cyan */
--pm-d:      #4ca8a3;
--pm-glow:   0 0 14px rgba(122,220,214,0.55);
```

Rationale: distinct from gold/inspi/fame trio (no hue collision); evokes "patina/water/painted-metal mastery" which fits a long-term meta-progression currency; desaturates cleanly for the dim-when-irrelevant state.

---

## 6. Information architecture

Per handoff §IA — single-page app with persistent top nav, persistent bottom currency bar, four routes:

| Route | Existing v1.1 view | Notes |
|---|---|---|
| `/tree` | `HomeView` | Tree with 5 upgrades, inspi tick |
| `/painting` | `PaintingView` | Canvas + room rail (Workshop active) |
| `/ascension` | `AscensionView` | Threshold + portal + ledger |
| `/constellation` | `SkillTreeView` | Star map of 5 nodes |

`viewSlice` is retired; `react-router-dom` takes over. Migration v5→v6 strips the persisted `currentView` field.

### 6.1 TopBar (persistent)

- Brand wordmark "ARTDLE" left (Cinzel 700, 22px, leading "A" tinted fame-gold)
- Nav (Cinzel uppercase, 13px, 0.18em letter-spacing)
- Active item: tinted fame-gold + ✦ flourishes left/right + thin gold border
- Far right: tiny mono microcopy (autosave status — derived from existing throttled persist; "Saved · 5s ago" pattern) + settings link (placeholder click for now)

### 6.2 BottomBar (persistent)

`grid-template-columns: [currencies] [info panel] [meta chip]`.

- **Currency chips** — 4 chips: gold / inspiration / fame / PM. Each holds an icon + number + per-second rate (gold/sec, inspi/sec; fame and PM have no rate). Irrelevant chips dim to 28% opacity + saturate(0.4).
  - Tree route: gold + inspi prominent; fame + PM dim
  - Painting route: gold + PM prominent; inspi dim; fame dim
  - Ascension route: inspi + fame prominent; gold + PM dim
  - Constellation route: fame prominent; gold + inspi + PM dim
- **InfoPanel** — context-sensitive: shows the title + tooltip body for whatever the user just hovered. Title in Cinzel; body in mono. Updated via `hoverInfoSlice` (existing).
- **Meta chip** — version label (`v2.0`) + autosave timestamp.

### 6.3 Currency icon style

Per handoff §"Currency icons (pixel-art, drawn in CSS)":
- `.icon-gold` — circle with radial highlight + dark inset
- `.icon-inspi` — 8-point pixel sparkle, clip-path star
- `.icon-fame` — 5-point pixel star, clip-path
- `.icon-pm` — new — pixel paintbrush (chunky 16-pixel design) or a stylized teal palette dot

I'll commit a placeholder PM icon (simple teal dot with paintbrush silhouette in CSS) and refine in polish round.

---

## 7. Folder structure

```
src/
├── main.tsx                     ← <BrowserRouter>
├── App.tsx                      ← shell layout + <Outlet />
├── routes/
│   ├── TreeRoute.tsx
│   ├── PaintingRoute.tsx
│   ├── AscensionRoute.tsx
│   └── ConstellationRoute.tsx
├── components/
│   ├── shell/
│   │   ├── TopBar.tsx, TopBar.module.css
│   │   ├── BottomBar.tsx, BottomBar.module.css
│   │   ├── CurrencyChip.tsx, CurrencyChip.module.css
│   │   ├── InfoPanel.tsx, InfoPanel.module.css
│   │   └── MetaChip.tsx, MetaChip.module.css
│   ├── tree/
│   │   ├── TreeScene.tsx           (pixel-art SVG of landscape + tree)
│   │   ├── StagePanel.tsx
│   │   └── UpgradeRow.tsx
│   ├── painting/
│   │   ├── CanvasStage.tsx         (easel + frame + paint-fill anim)
│   │   ├── CanvasUpgradesStrip.tsx (1 tile in v2.0)
│   │   ├── TierCard.tsx
│   │   ├── RoomRail.tsx
│   │   └── WorkshopRoom.tsx
│   ├── ascension/
│   │   ├── Cavern.tsx              (bg + crystals)
│   │   ├── Portal.tsx              (animated SVG)
│   │   ├── ThresholdPanel.tsx
│   │   ├── FamePreviewCard.tsx
│   │   └── PastRunsLedger.tsx
│   ├── constellation/
│   │   ├── StarCanvas.tsx          (pannable/zoomable)
│   │   ├── NodeCard.tsx            (selected-node detail)
│   │   ├── MiniMap.tsx
│   │   └── ClusterList.tsx
│   └── icons/
│       ├── PixelIcon.tsx           (small custom set)
│       └── (lucide-react re-exports)
├── styles/
│   ├── tokens.css                  (copied from design_handoff_artdle/)
│   ├── globals.css                 (font loading + base reset)
│   └── *.module.css                (per-component, colocated)
├── store/                          ← unchanged
├── core/                           ← unchanged
├── systems/                        ← unchanged
└── config/                         ← unchanged
```

`viewSlice.ts` deleted (router replaces it). `tests/store/viewSlice.test.ts` deleted.

---

## 8. Round-by-round build

### Round 0 — Foundation

**Goal:** branch ready, fonts loaded, tokens wired, router shell up, Tailwind gone, all existing routes compile under placeholder routes. No game UI yet.

1. Branch `feat/v2-redesign` off `main` at `44dcb85`.
2. Copy `design_handoff_artdle/tokens.css` to `src/styles/tokens.css`. Add `--pm` tokens.
3. Add font `<link>` to `index.html` (Cinzel + JetBrains Mono + Inter + Press Start 2P + VT323).
4. Remove Tailwind: `npm uninstall tailwindcss`, drop `@import "tailwindcss"` from `src/index.css`, remove tailwind config files. Update `src/styles/globals.css` to import `tokens.css` and provide a base reset.
5. Convert existing v1.1 components from Tailwind utility classes to CSS Modules. Mechanical pass — one component file at a time.
6. Add `react-router-dom`, `lucide-react`. Set up `<BrowserRouter>` in `main.tsx`. Replace `App.tsx`'s view switcher with `<Outlet>` + 4 `<Route>` placeholders pointing to stub components.
7. Build new shell: `<TopBar>` (brand + nav + meta), `<BottomBar>` (4 currency chips + InfoPanel + meta chip).
8. `viewSlice` retired. Migration v5→v6 in `migrate(persisted, fromVersion)`.
9. Verify: 362 tests minus viewSlice (~5) = ~357 passing. Routes navigable. Existing slices intact.

### Round 1 — Tree route (`/tree`)

**Goal:** TreeRoute fully working with the new visual language. Existing tree mechanic unchanged.

1. `<TreeScene>` SVG: pixel landscape (sky gradient → mountains → hills → pond → tree → motes → fireflies). Tree visual responds to existing 3-stage state (Seed = small / Sapling = mid / Tree = full canopy).
2. Top-left overlay: large inspi-purple `+X.X inspi/s` (Cinzel 28px, glow) + mono "Stage · {N}".
3. `<StagePanel>` (right rail): stage-chip row + progress bar to next stage + "Grow into…" CTA wired to existing `growSapling`.
4. `<UpgradeRow>` list (right rail bottom): existing tree parts (whatever names — `spark`, `bud`, etc.) styled per handoff: 28×28 monogram tile + serif name uppercase + mono `Lv N · +X.X inspi/s` + gold cost pill.
5. Verify: tree gameplay matches v1.1 exactly; new visuals match handoff. Tests: existing tree tests pass + ~5 new component tests.

### Round 2 — Painting route (`/painting`)

**Goal:** PaintingRoute with new visual + canvas auto-paint loop intact.

1. `<CanvasStage>`: vignetted dark room + gilded picture frame + pixel landscape inside (placeholder single image — tier-specific landscapes are polish/v2.x). `.canvas-fill` overlay animates `height` between 30%↔65% via RAF (driven by existing `canvasProgress`).
2. Title row top-center: "— Tier {N} · {Stage Name} —". Bottom row over frame: "Painting · X.Xs / Y.Ys" (left), "+Ng on next sale" (gold-glowing center, derived from existing `canvasGold(tier, mult)`), "▲ Upgrade Tier · X g" (right).
3. `<CanvasUpgradesStrip>`: 1 tile — `<TierCard>` wired to existing `canvasTier` + `upgradeTier`. **No placeholder Strokes/Pigments/Auto-Sell/2nd Easel cells.** The strip layout exists; it just has 1 cell populated.
4. `<RoomRail>` (far right, 64px): 4 vertical tabs (Workshop / Office / School / Lab). Workshop active. Office/School/Lab visible-but-disabled with hover hint "Coming soon."
5. `<WorkshopRoom>` (340px right panel when Workshop active): existing craft + inventory + equip + discard + recent-affix-card, restyled per handoff.
6. `<FloatingGoldText>` preserved for sale animation (existing).
7. Verify: painting gameplay matches v1.1 exactly. Tier upgrade button moved into strip layout. Workshop popup is now a side panel (not a modal). Tests: existing canvas/workshop tests pass + ~6 new.

### Round 3 — Ascension route (`/ascension`)

**Goal:** AscensionRoute with cavern + portal + ledger.

1. `<Cavern>`: violet→black radial bg + stone-block grid pattern (repeating linears at 14px/28px) + 5 floating crystals (purple diamond clip-path, drop-shadow glow, animated opacity pulse, scattered).
2. Top-left overlay: "— Threshold —" (Cinzel) + mono "{currentInspi} / {palier} inspi".
3. `<Portal>`: 380px wide stone arch SVG. Outer arch bricked stone gradient + thin dark joints. Inside: glowing radial gradient (lavender → violet → black). Keystone with gold ✦. Six purple runes flank L/R. Animated `float` (translateY ±6px, 6s ease) + `shimmer` (brightness/drop-shadow pulse, 4s).
4. Bottom CTA: gold serif "— Step Through —" + "✦ Ascend · +N fame ✦" button. Confirmation modal (irreversible). Wired to existing `performAscend`.
5. Right rail (3 stacked panels):
   - `<ThresholdPanel>`: large mono number for current inspi + progress bar to threshold + caption "X% to threshold · ~Ym at +Z/s".
   - `<FamePreviewCard>`: fame-bordered card, big serif "+N" with glow (derived from existing `fameOnAscend`).
   - `<PastRunsLedger>`: NEW small data — 4 most-recent past runs in mono table format + total fame footer.
6. Migration v6→v7: add `pastRuns: PastRun[]` to `metaSlice`. `performAscend` orchestrator appends one entry per ascend.
7. Verify: ascend works as before; ledger populates after each ascend; survives reload. Tests: existing ascend tests pass + ~5 new (ledger persistence, panel rendering).

### Round 4 — Constellation route (`/constellation`)

**Goal:** ConstellationRoute as a star map of the 5 v1.1 nodes.

1. `<StarCanvas>`: bg-0 + warm radial bottom + 32px grid pattern at low alpha + 7 twinkling stars (animated opacity 2.5-4s). Pointer-drag pans; wheel zooms (clamp zoom 0.5–2.0).
2. **5 existing nodes** plotted in a layout:
   - Root **FAME** at bottom-center (big gold disc r=20 + halo + "FAME" Cinzel label below).
   - Tier-1 fans out: `goldsmith` and `patient_eye`.
   - Tier-2 below: `second_slot`.
   - Tier-3: `faster_strokes`.
   - Tier-4: `better_brush`.
   - Connection lines: solid gold for owned-side edges, dashed `#3a2e5a` for unowned (only between existing 5 nodes).
3. Node states: owned (gold disc + halo), available-selected (hollow + purple inner dot + halo), available-unselected (hollow + gold ring), locked (small dark circle, dashed-line entry).
4. `<NodeCard>` floating top-right of canvas: title + meta + description + "✦ Acquire · N fame" button. Wired to existing `buyNode`.
5. Right rail:
   - **Fame to spend**: big 42px serif over uppercase label.
   - `<MiniMap>`: small SVG showing tree shape from above + dashed gold rect for current viewport. Caption "5/5 owned" or progressive.
   - `<ClusterList>`: 1 cluster only — "Starters · X/5". No fake clusters for visual richness.
6. Verify: all 5 nodes purchasable in chain; UI reacts to fame spend; pan/zoom doesn't break selection state. Tests: existing skill tree tests pass + ~6 new.

### Round 5 — Polish + ship

1. Animation final pass per handoff §Animations:
   - Currency chip dim/restore: 200ms ease.
   - Row hover lift: 140ms.
   - Button hover lift: 120ms.
   - Portal float: 6s ease-in-out infinite.
   - Portal shimmer: 4s ease-in-out infinite.
   - Crystal pulse: 3s ease-in-out infinite, staggered.
   - Inspiration motes opacity: 2.2s–3.7s, staggered.
   - Fireflies: cy + opacity over 6–8s.
   - Star twinkle: 2.5s–4s opacity.
2. Save/load verification across all 4 routes (especially with router state — refresh on `/painting` should restore route + scroll/zoom positions where applicable).
3. Update `docs/HANDOVER.md` with v2.0 section.
4. Bundle check: target still <250 KB gzipped. CSS Modules may trim (no Tailwind utility runtime); react-router adds ~10 KB; lucide-react tree-shakes per-icon.
5. Final test pass: ~390 expected (357 carry-forward minus viewSlice + ~30 new).
6. Tag `v2.0`, push.

---

## 9. State model — one small addition

Existing slices unchanged. Only `metaSlice` grows by one field for the past-runs ledger:

```ts
interface PastRun {
  fame: number;       // fame gained on this ascend (Big.toNumber-safe at v1.x scale)
  ascendedAt: number; // Date.now() at ascend
}

interface MetaSlice {
  // ... existing fields (playerId, ascendCount, performAscend, _setPlayerId, incrementAscendCount)
  pastRuns: ReadonlyArray<PastRun>;
  // appended internally by performAscend orchestrator; no new public action needed
}
```

`performAscendOrchestrator` (in `src/systems/ascend.ts`) appends one entry on each successful ascend, capturing `fameGain` + `Date.now()`.

Migration v6 → v7: `if (fromVersion < 7) { state.pastRuns = []; }`.

`partialize` includes `pastRuns` (no transient marker).

---

## 10. Definition of done — v2.0

1. All 4 routes navigable via React Router; back-button + URL refresh work on each.
2. Tailwind fully removed; styling driven by `tokens.css` + per-component CSS Modules.
3. TopBar + BottomBar persistent across routes; currency chips dim per-route per IA.
4. Tree route: handoff aesthetic + existing 3-stage tree mechanic intact.
5. Painting route: handoff aesthetic + existing tier upgrade + workshop room intact.
6. Ascension route: handoff aesthetic + existing palier/fame mechanic + new past-runs ledger.
7. Constellation route: handoff aesthetic + existing 5-node skill chain + pan/zoom.
8. Save/load survives refresh + works across all routes.
9. ~390 tests passing; tsc clean; lint clean.
10. Bundle <250 KB gzipped.
11. README updated; HANDOVER updated.
12. `v2.0` tag annotated and pushed.

---

## 11. Risks

### 11.1 Round 0's Tailwind→CSS-Modules conversion

Touches every existing component file (~15 components). Mechanical but error-prone — easy to miss a utility class and end up with unstyled elements. **Mitigation:** convert one route's components at a time, screenshot-diff against running v1.1 between batches. Keep the conversion separable from new visual work — Round 0 produces a v1.1-equivalent UI in CSS Modules; Round 1 then layers the new visual on top.

### 11.2 React Router migration

`viewSlice.currentView` is persisted; routing replaces it with URL state. Edge case: a v1.1 save's `currentView: "painting"` value must not break v2.0 rehydration. **Mitigation:** the v5→v6 migration drops the field; user lands at `/tree` (default route) on first v2.0 load.

### 11.3 IndexedDB vs handoff's localStorage

Documented deviation. The save adapter is unchanged (existing `idbAdapter`). No risk.

### 11.4 PM as a 4th currency

Documented deviation. BottomBar hosts 4 chips; the handoff's mockup CSS is for 3 chips in a row. Visual concern: 4 chips may crowd the BottomBar. **Mitigation:** verify in Round 0 that 4 chips fit on a 1280px-wide layout; if not, reduce per-chip horizontal padding.

### 11.5 Round count

5 rounds + polish is ~5-7 dev days at the SADD pace. The user is on a personal timeline; this is the rough estimate, not a deadline.

---

## 12. Hooks for future waves

- **v2.1 / v1.2 redux:** Quality axis, subjects, Office/School/Lab content land into the slots already designed in v2.0. Each new feature gets a clear visual home.
- **v2.x:** PM icon polish (custom pixel paintbrush sprite); tier-specific canvas landscapes (5 sprites); skill-node custom icons; full sound design (handoff doesn't address audio).
- **v3.x:** server-authoritative state, accounts, public hosting (CLAUDE.md long-term).

---

## 13. Out of scope (firmly)

- Mobile-first design (permanently out per CLAUDE.md).
- Multiplayer / trading / leaderboards.
- French language.
- New game features in v2.0.
- Quality axis / subjects (v1.2 brainstorm content).
- Office / School / Lab room content (tabs only; no panels).
- Expanded constellation node graph (only the 5 v1.1 nodes plot).
- Tier-specific canvas landscape sprites (placeholder used).
- Audio.

---

## 14. Migration & rollout

v2.0 is a single-cut release on `feat/v2-redesign` → merged to `main` + tagged `v2.0`. The v5→v6 migration drops `currentView`; v6→v7 adds `pastRuns: []`. Both run idempotently per the existing chain pattern.

Roll-back path: `git checkout v1.1` restores v1.1 binary state. v7 saves cannot be loaded by v1.1 (one-way migration, same policy as prior cuts). Acceptable for a solo-dev game.

---

**End of spec.**
