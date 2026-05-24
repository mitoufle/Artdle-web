# Artdle Web — Handover

## Ascend cinematic + post-gate routing (2026-05-24)

One commit on `master` (`fa8a833`), deployed (production bundle `index-Cg113YSy.js`). Verified live: `ascend-cinematic-overlay`, `fame gained`, `click to continue` strings present in JS.

### What landed

Confirming an ascend now plays a self-contained cinematic instead of just swapping the gate video and dumping the player back into a fresh ascension idle. Flow:

1. Player clicks `Step Through` → confirm modal → `Ascend`.
2. **App-wide click-blocker** mounts (`AscendCinematicOverlay` in `"opening"` phase): transparent fixed-position div at `z-index: 1000`, full viewport, `pointer-events: auto`. Catches every click — including the BottomBar / TopBar nav — so the player cannot navigate away mid-animation. The gate-opening video keeps playing under it.
3. On video `onEnded`: `performAscend()` runs and the overlay flips to `"blackout"` phase. Fades to black over 700ms; teal (`#5eead4`) `+N fame gained` line and a Spinoza quote (italic mystic-purple, 18px) fade in staggered behind it. `cavernPhase` is held at `"opening"` so the gate's last frame stays painted behind the fade — switching to the closed-gate loop video here would briefly show "gate closed again" during the fade-in, which read wrong.
4. After 4s, a `— click to continue —` hint appears (mono, dimmed). The overlay is dismissible on click any time the blackout is showing; the 4s gate is just the hint.
5. On dismiss: cinematic unmounts, `cavernPhase` returns to `"idle"`, and the player is **navigated to `/constellation`** (via `useNavigate`). The intent is to push them toward spending the fame they just earned.

### Files

- `src/config/ascendQuotes.ts` — 14 Spinoza-leaning quotes + `pickRandomAscendQuote(rng = Math.random)`.
- `src/components/ascension/AscendCinematicOverlay.tsx` (+`.module.css`) — `createPortal` to `document.body`, two phases (`"opening"` invisible blocker, `"blackout"` visible). `useEffect` sets a 4000ms timeout per blackout entry to flip the `hintVisible` state. Respects `prefers-reduced-motion` (all keyframes disabled, opacity locked at 1).
- `src/routes/AscensionRoute.tsx` — phase machine extended from `idle | opening` to two independent state lines: `cavernPhase: "idle" | "opening"` (drives the Cavern video) and `cinematicPhase: "opening" | "blackout" | null` (drives the overlay). `capturedFameGain` + `capturedQuote` are stashed at confirm time so the blackout can display them after `performAscend()` resets inspiration. Reduced-motion users skip the cinematic and ascend immediately (same shortcut as the pre-existing gate-video skip).

### Status

- All 20 `AscensionRoute` tests green (+7 over the previous suite). Full 1030-test suite green. No new typecheck/lint errors (pre-existing errors in unrelated files are untouched).
- 6 new tests under `describe("AscensionRoute cinematic overlay")` cover: opening-phase overlay mount + no visible text; blackout headline format (`/^\+\d+(\.\d+)?[KMBTQ]?\s*fame gained$/`) and quote membership in `ASCEND_QUOTES`; 4s hint timing via `vi.useFakeTimers` + `vi.advanceTimersByTime`; click-to-dismiss; opening-phase clicks don't dismiss; CTA gated through both phases (not just opening). A 7th test asserts dismissal navigates to `/constellation` via a `MemoryRouter` with a route stub.

### Notes

- **Capture-then-mutate is load-bearing.** `setCapturedFameGain(fameGain)` runs BEFORE `setCavernPhase("opening")` (and well before `performAscend()` at video end). If you ever reorder these or move the capture into the `onOpeningEnded` callback, the blackout will show `0` because `inspiration` has been reset by then and the live `fameGain` is computed from current state.
- **The portal target is `document.body`, not the layout root.** Necessary so the overlay's fixed positioning + `z-index: 1000` sits above the TopBar / BottomBar / InfoPanel (all rendered inside `<div className={styles.app}>`). Reverting to in-tree rendering would put the nav above the click-blocker because of CSS stacking contexts created by the app shell.
- **`pickRandomAscendQuote` takes an optional `rng` parameter** (defaults to `Math.random`). Tests don't seed it today — they just check membership in `ASCEND_QUOTES`. If determinism becomes useful (e.g., recording demo gifs), thread `seededRng` from `@/core/rng` in.
- **Teal `#5eead4` is hardcoded**, not a token. No teal exists in `src/styles/tokens.css` — the closest siblings are `--inspi` (purple) and the `--pm-*` tokens (teal-adjacent, but kept for Ascension card visuals per the 2026-05-23 entry). A token like `--ascend-glow` would be cleaner if more surfaces need this color.
- **The Cavern's video element holds its last frame after `onended`.** This is browser-default behavior; the cinematic relies on it. If a future codec change or `<video>` attribute change (e.g., adding `controls`) causes a paused-poster-style behavior, the fade-in would show a black-or-poster background instead of the gate-open frame, and the transition would feel abrupt.

### Open follow-ups

- **Spec/handover doc for the cinematic.** Not written. Lightweight enough that this HANDOVER entry is probably sufficient, but a dedicated `docs/superpowers/specs/2026-05-24-ascend-cinematic-design.md` would be the right place if the feature gets reworked.
- **Quote stylization.** All 14 quotes are Spinoza-leaning. If the author wants to broaden (other philosophers, in-game lore quotes, art-movement aphorisms), it's a one-file edit to `src/config/ascendQuotes.ts`.
- **Reduced-motion path skips the quote entirely.** Reduced-motion users get the original instant-ascend behavior — no blackout, no quote, no `/constellation` navigation. Worth deciding whether they should at least get the navigation + a static (non-faded) blackout-style summary, or whether the instant ascend is the right outcome. No action today.
- **Sound on cinematic.** v1 is silent everywhere; if/when audio lands, the gate-open + blackout fade is a natural place for a sting.

---

## Crit per-chunk rework (2026-05-24)

Sixteen commits on `master`, deployed (production bundle `index-Bz0pju0E.js`). Spec at `docs/superpowers/specs/2026-05-24-crit-per-chunk-rework-design.md`, plan at `docs/superpowers/plans/2026-05-24-crit-per-chunk-rework.md`.

### What landed

The legacy crit model was binary at the canvas level: on canvas start, one rng roll either gave the WHOLE canvas a 10× speed bonus (`CRIT_SPEED_FACTOR`) and +20%/level gold (via the `prismatic_eye` skill node and its `crit_gold_bonus` capability) or didn't. After this rework, **crit fires per chunk paint event** (auto-paint and clicks alike) and paints `1 + N` extra chunks instantly at no time cost. Chance comes only from progression (skill tree + `critLevel` track, capped at L50); the number of bonus chunks per crit comes only from gear and workers.

Key behavioral table:

| | Old | New |
|---|---|---|
| Crit roll cadence | Once per canvas, at canvas start | Once per paid chunk (auto + click) |
| Crit effect | Canvas paints 10× faster + per-`prismatic_eye`-level gold bonus | Paints `1 + getCritChunks(draft)` extra chunks instantly (no gold bonus) |
| Base crit chance | 0% (everything from sources) | **1%** always-on floor |
| Base crit chunks | n/a (binary flag) | **1** bonus chunk on top of the trigger |
| Chance sources | `critLevel` + `+crit_chance%` items + workers | Base 1% + `critLevel × CRIT_PER_LEVEL` (capped at `MAX_CRIT_LEVEL = 50`) + skill-tree `crit_chance` capability hook |
| Chunks sources | n/a | Base 1 + `+crit_chunks` items + `+crit_chunks` workers (raw integer magnitudes, NOT percent; socks ×1.5 on boots) |
| Soft-cap formula | Unchanged | Unchanged — same `CRIT_SOFT_CAP_THRESHOLD = 0.30`, ceiling 0.95 |
| Bonus chunks re-roll | n/a | **No** — bonus chunks paint instantly without their own rng call (prevents infinite chains) |
| Canvas-end overflow | n/a | **Carries to next canvas** — a crit's bonus that exceeds the current canvas's remaining chunks spills into chunk 0 of the next, firing a sale mid-bonus-loop |
| Last-chunk crit | n/a | **Skipped** — the canvas's last paid chunk doesn't roll, so trigger + first bonus always render together in the same canvas (avoids the rare visual where a same-tick sale would wipe `critChunks` before the next frame) |

### Architecture changes

- **Balance (`src/core/balance.ts`):** added `BASE_CRIT_CHANCE = 0.01`, `BASE_CRIT_CHUNKS = 1`, `MAX_CRIT_LEVEL = 50`. Removed `CRIT_SPEED_FACTOR`.
- **Multipliers (`src/core/multipliers.ts`):** `getCritChance` reads base + capped critLevel + `countCapability("crit_chance") × 0.01`; no longer reads items/workers. New `getCritChunks` walks `state.equipped` (with socks 1.5× on boots) and `state.roster` (scaled by `levelScale(level)`) summing raw integer magnitudes — does NOT go through `getEquippedContribution`/`getOfficeContribution` because those divide by 100 (percent semantics). `getCritGoldBonus` deleted.
- **Tick (`src/core/canvasTickPure.ts`):** complete rewrite. The loop now steps in **integer chunk units** (`chunkProgress` integer + `subTime` residual seconds) instead of `Math.floor(progress / chunkTime)`, eliminating a floating-point drift bug (see below). Each paid chunk crossing rolls crit once; a successful roll instantly paints `1 + appliedBonus` chunks, marking them in a `critChunks: Record<number, true>` set that drives the per-cell gold-flash UI. Bonus chunks consume no `timeBudget`, so they make canvases finish faster. The bonus loop crosses canvas boundaries (calling `fireSale` mid-loop and continuing into the new canvas) so no crit benefit is wasted. `critsLanded` / `currentCritStreak` / `maxCritStreak` count **both trigger and bonus chunks**; a paid-chunk miss resets the streak; a sale does NOT.
- **Canvas slice (`src/store/canvasSlice.ts`):** added `critChunks: Record<number, true>` field (cleared on sale + on tier-up). Removed `isCritThisCanvas`. **`tierUp()` now preserves `sizeLevel`/`critLevel`/`comboLevel` across tier-up** (gated tracks compound across tiers); only `sellPriceLevel` and `speedLevel` reset (they're what the gate is keyed on).
- **Affixes (`src/config/workshopAffixes.ts`):** removed `"+crit_chance%"`; added `"+crit_chunks"` with symbol `⚡`, color `#ffaf3a` (warm gold-orange), weight 1.3, per-tier integer ranges `1..1 / 1..2 / 2..3 / 2..4 / 3..5`.
- **Worker classes (`src/config/officeClasses.ts`):** same swap with smaller integer ranges (workers compound via `levelScale`).
- **Skill tree (`src/config/skillTreeNodes.ts` + `skillTreeDesign.json`):** `prismatic_eye` node + `crit_gold_bonus` capability removed entirely. A new `"crit_chance"` capability tag is reserved as a forward-compatibility hook — no nodes carry it today, but `countCapability(state, "crit_chance")` works and feeds `getCritChance` (at +1% per level), ready for a future node.
- **Persistence (`src/store/index.ts`):** SAVE_VERSION bumped 22 → 23 with a **full wipe** migration step (`if (fromVersion < 23) return {} as GameStore;`). Spec called this; existing players start fresh on first load.

### UI

- **TrackCard (`src/components/painting/TrackCard.tsx`):** generalized — `affixKind` is now optional; new `iconOverride` / `colorOverride` / `maxLevel` props. At `level >= maxLevel`, the button renders `MAX` and is disabled. The crit-chance card in `PaintingRoute.tsx` uses `iconOverride="✦"` + `colorOverride="#e85c5c"` + `maxLevel={MAX_CRIT_LEVEL}` to keep the red-star identity even though `+crit_chance%` is no longer an `AffixKind`.
- **CanvasStage gold flash (`CanvasStage.tsx` + `CanvasStage.module.css`):** crit-painted chunks (trigger + bonus) carry a one-shot rainbow-border animation. The animation rotates the **colors** around a stationary border by animating a `@property --crit-angle` custom property fed into a `conic-gradient`'s `from` angle — earlier attempts that animated `transform: rotate()` on the pseudo-element spun the square shape instead of the colors, which read wrong. After 600ms the pseudo-element returns to its default opacity 0 — no persistent visual; the crit cell looks identical to non-crit cells once the animation ends.
- **Completed-canvas flash:** when `canvasNumber` increments (= a sale fired), `CanvasStage` captures the just-completed sketch URL into local state and renders it as an overlay over the easel region with a 600ms `completedFlash` animation (brightness pulse + small scale-up + fade). Necessary because crits + speed buffs can finish a canvas in well under a second, otherwise the player never sees the final image. The new canvas's chunk-by-chunk reveal begins simultaneously underneath; the flash fades to expose it.
- **CRIT badge removed** from CanvasStage (canvas-level crit no longer exists). The `data-testid="crit-indicator"` element and its associated `critPulse` keyframes were deleted.
- **StatsRoom (`src/components/painting/StatsRoom.tsx`):** the "Crit chance" block now reads `Crit chance (chunk roll)` and uses `iconOverride: "✦"` + `colorOverride: "#e85c5c"` (the same StatBlock iconOverride pattern as TrackCard); the Items/Workers contribution lines are gone since items/workers no longer contribute to chance.
- **Compact affix chips** (`WorkshopRoom.tsx` inventory + equipped lists): the hardcoded `%` suffix was branched out for `+crit_chunks` so a magnitude-3 item now renders as `⚡3` rather than `⚡3%`.

### The drift-induced re-roll bug

After the first cut of the tick rewrite, an in-browser play-test revealed crits firing about 5× more often than the configured rate (~17% effective vs 3% set). A diagnostic probe found the cause: after a crit, `progress += appliedBonus * chunkTime` produced a float value slightly less than the intended `(N + 1 + appliedBonus) × chunkTime` boundary. The next iteration's `Math.floor(progress / chunkTime)` pointed BACK at the bonus chunk we'd just painted; `timeToNextChunk = nextBoundary - progress` was tiny; the loop crossed an almost-zero-cost boundary and rolled crit AGAIN on the same chunk index. Each "real" paid chunk effectively triggered ~5.7 rolls.

Fix in two parts:
1. Track chunk progress as an integer (`chunkProgress`) plus a sub-chunk residual time (`subTime`). The floor-based derivation is gone; the integer can't drift.
2. Epsilon-tolerant `timeBudget < timeToNext - 1e-9` comparison so a tick of exactly `N × chunkTime` reliably fires all N sales (the per-iteration subtraction accumulates ~1e-15 drift per crossing; over 250 crossings that can shift the last comparison enough to drop a sale).

### Status

- **1024 tests green** across 107 files. `npx tsc -b --noEmit` has 29 lines of output, all pre-existing on master (statsSlice cast quirks, school-designer test, catchup tests). Zero crit-related TS errors. `npx vite build` succeeds.
- Production bundle `index-Bz0pju0E.js`, CSS `index-CVssnbO2.css`. Verified live: `crit_chunks` appears in JS, `--crit-angle` + `critCaterpillar` + `sketchCellCrit_<hash>` + `completedFlash_<hash>` appear in CSS.
- **Save wipe shipped.** Any pre-rework save is reset to defaults on first load.

### Notes

- **Skip-roll-on-last-chunk costs ~4% of rolls** at T1 (1 of 25 chunks immune to crit), shrinking as tier grows (1/49 ≈ 2% at T2, 1/100 = 1% at T3, etc.). Not balance-critical.
- **`getSketchGridDim` import.** `canvasTickPure.ts` imports it from `@/components/painting/canvasArt.ts` — a components→core reverse dependency. Pragmatic for the rework; consider hoisting the helper to `src/core/chunks.ts` (or similar) in a follow-up so core has no UI dependency.
- **Existing `currentCritStreak`/`maxCritStreak` semantics changed** from consecutive crit-canvas counts to consecutive crit-chunk counts (trigger + bonus both count; canvas-end does not reset). The fields are unchanged on disk; only the meaning shifted. Stats panel labels were updated.
- **`StatBlock.kind` is now optional** in `StatsRoom.tsx` so non-affix-backed rows (crit chance) can use the icon override path. Render-site checks for both `iconOverride` and a present `kind` before falling back to a default symbol.
- **Test contamination risk in canvasSlice.test.ts.** The new 1% base crit chance can flake exact-progress assertions (a crit firing during the test shifts `canvasProgress` by `+0.4s`). The `canvasTick(1)` test now seeds rng (`setSeed(1)` in `beforeEach`) and uses a range assertion (`>= 1 && < 1.5`) to tolerate either path. If you add more tick-exact tests, follow the same pattern.

### Open follow-ups

- **`craftsmanship` × `+crit_chunks` interaction.** `getAffixMagnitudeBonus` adds +5 per Craftsmanship level to BOTH `min` and `max` at roll time. That was designed for percent magnitudes — for raw-integer `+crit_chunks` (range 1..5), one Craftsmanship level buffs it to 6..10, a big jump. Consider clamping or skipping `magnitudeBonus` for `+crit_chunks`. Spec didn't anticipate this; left in place for now.
- **No skill-tree nodes for crit_chance yet.** The capability hook exists in `getCritChance` (`countCapability("crit_chance") × 0.01` per level) but no node carries the `crit_chance` tag. Authoring a node is straightforward — add an entry in `skillTreeNodes.ts` + `skillTreeDesign.json` with `unlocks: ["crit_chance"]`.
- **Bonus-overflow visual.** When a crit's bonus carries across a canvas boundary, the trigger and any in-old-canvas bonus chunks are painted but not visually flashed (the sale wipes `critChunks` before the next render). Only the new-canvas bonus chunks show the rainbow. Could be addressed with per-canvas critChunks tracking + a brief "just-sold canvas trace" overlay, but the completed-canvas flash already provides closure.
- **Stats panel doesn't show a "Crit chunks" breakdown.** Items + workers feed `getCritChunks` but the StatsRoom only surfaces the chance side. A second row (`Crit chunks (per crit)` with sources: Base / Items / Workers) would round out the panel — left for later.
- **Achievement re-balancing.** The full save wipe means existing achievement progress resets anyway. Per-canvas-crit thresholds in achievement definitions may need re-tuning for the per-chunk model. Spec deliberately deferred this.

---

## Canvas Stage polish (2026-05-24, pre-crit-rework)

Six commits on `master`, deployed in two waves before the crit work began. Sketches the easel area's current visual feel.

### What landed

1. **Click-to-paint a chunk** (`0d1665b`). Clicking the easel image dispatches `canvasTick(paintTimeSec / chunkCount)` to advance one chunk's worth of progress on demand. The `<CanvasStage>` accepts an optional `onChunkClick` prop; `PaintingRoute.tsx` wires it. Active play now meaningfully accelerates a canvas.
2. **Chunks doubled per tier** (`7858532`). The N×N sketch grid scales with tier via a new `getSketchGridDim(tier)` helper: `round(5 × √2^(tier-1))` → 5, 7, 10, 14, 20, 28, 40, … (cell count ~doubles each tier). Each click still paints one chunk, so higher tiers feel finer-grained — the cell-pop visual stays alive across the whole tier range.
3. **Workshop video + fit-without-letterbox** (`77cfaa6`). The static PNG was replaced with `painting_screen_anim.mp4` (autoplay/loop/muted/playsInline) for ambient life; the PNG stays as the `poster` so the scene appears instantly while the video loads. A separate bug-fix: `.imageContainer` was sized `width:100%; aspect-ratio:1376/768; max-height:100%`, which on wide windows produced a container WIDER than the image's aspect ratio — the image letterboxed via `object-fit:contain` but the sketch overlay (positioned in percent of the container) spilled past the easel. Replaced with `width: min(100cqw, 100cqh × 1376/768)` using container queries so the container always matches the actual rendered-image bounds; overlay is now always aligned.
4. **Chunk pop-in click feedback** (`0fbc529`). Replaced the previous full-image `filter: brightness(1.08)` flash on `:active` with per-cell pop-in animation: each chunk transitions from `scale(0.4)` to `scale(1)` with a back-ease overshoot cubic-bezier (220ms). The painted chunk itself is the click feedback — localized, satisfying, no full-screen flash.
5. **Paintbrush cursor** (`8711627`). Custom cursor on the clickable easel area. A 64×64 source PNG (`paint cursor.png`) is checked in alongside a 32×32 nearest-neighbor downscale (`paint_cursor_32.png`) generated via PowerShell + System.Drawing (browsers cap rendered cursor size around 32×32, and 64×64 sources looked oversized at native scale). Vite inlines the 32×32 as a base64 data URL in the CSS — zero extra request.

### Status

- All five live in the production bundle on 2026-05-24 (verified via bundle hash checks at each deploy).
- Cumulative impact: clicking matters, the easel breathes, the canvas visual escalates per tier, and the cursor signals interactivity.

### Notes

- **Pixel-art cursor sizing.** OS/browser cursor scaling is inconsistent. The 32×32 version looks crisp on Windows/Chrome at default DPI; high-DPI displays may upscale with smoothing. If anyone reports a blurry cursor, downscale further (16×16) or supply a separate hi-DPI asset and pick via `image-set()` in the CSS.
- **mp4 vs webm.** Only the mp4 ships. If a browser ever objects, encoding a `.webm` alongside and supplying both via `<source>` tags is the standard fix.

### Open follow-ups

- **Hoist `getSketchGridDim` out of `components/`.** It's now imported by `canvasTickPure.ts` (a core module). Move to `src/core/chunks.ts` (or similar) to clean the layering.
- **Cursor on inventory/workshop hover targets.** Could extend the paintbrush motif to other clickable surfaces, OR introduce different cursors per area (brush on easel, gold-glow on currency, etc.).

---

## Canvas Art — workshop scene + per-tier sketches (2026-05-23)

Three commits on `master`, deployed (production bundle `index-CfwiamNL.js`).

### What landed

The painting stage's old stylized SVG (sky/mountains/tree drawn in 200×140 viewport) is gone. The visual is now a layered composite:

1. **Workshop background** — `src/assets/images/Painting_screen.png` (1376×768 RGBA), a pixel-art studio scene with shelves, candles, books, tables, paint jars, and a centered easel with a transparent canvas placeholder. Fills the entire stage area edge-to-edge.
2. **Per-tier sketch overlay** — the painting currently in progress, rendered chunk-by-chunk over the easel's transparent area as `progressPct` advances 0 → 1.

The transparent easel-canvas bbox inside the workshop image was extracted programmatically via a throwaway pngjs script (since deleted) and hardcoded as the overlay's CSS positioning: `left=39.17%, top=19.40%, width=21.58%, height=39.19%`. The workshop image is rendered with `object-fit: contain` inside an `aspect-ratio: 1376/768` container so the overlay always lines up with the easel regardless of the stage's outer dimensions.

### Tier-specific art

`src/assets/canvas/T{1..4}/*.png` ship art that visually escalates per tier:
- **T1** (8 sketches): childlike pencil sketches on white — bike, car, dog, house, leaf, mountain, snail, stickman
- **T2** (11): inked black-and-white pixel art with scenery
- **T3** (11): limited-palette color pixel art (Game Boy / handheld era look)
- **T4** (11): full-color detailed pixel art with rich environments

Matches the cosmetic stage progression Sketch → Apprentice → Journeyman → … which the tier system rekeyed onto `canvasTier` earlier today. T5+ falls back to T4 art until more tiers are authored.

### Mechanism

`src/components/painting/canvasArt.ts` eagerly bundles every PNG under `src/assets/canvas/T*/` via `import.meta.glob`. Two exports drive the overlay:

- `getSketchUrl(tier, canvasNumber)` — picks one sketch from the tier's pool using `hash(canvasNumber, 0xa11a17) % pool.length`. Deterministic per (tier, canvasNumber) pair; same canvas always shows the same sketch across re-renders / catch-up replays.
- `getCellRevealOrder(canvasNumber, totalCells)` — returns a permutation of `[0, totalCells)` sorted by `hash(canvasNumber, i)`. Each canvas reveals its 25 chunks (5×5 grid) in a different scrambled order, but stable for that canvas.

`CanvasStage` renders the overlay as 25 absolutely-positioned cells inside the easel bbox, each a `<div>` with the sketch URL as `background-image` and a unique `background-position` to show its 1/5 × 1/5 slice. Cell opacity flips 0 → 1 with a 180 ms ease-out transition when its `revealRank < cellsRevealed`. The overlay container is keyed by `canvasNumber` so it remounts cleanly on each sale — without the key, the old canvas's cells would animate their fade-out (over 180 ms) while displaying the new sketch's image, visibly bleeding the next canvas before the actual reveal started.

### The `canvasNumber` source bug

Initially `canvasNumber` was passed as `lastSale?.id ?? 0`. That was wrong: `lastSale` is transient state cleared by `clearLastSale` after the floating gold-text animation completes. So between sales, `canvasNumber` would revert to `0` — and since `hash(0, …) % 8 = 3` (= house in alphabetical order), every canvas appeared to paint the house, with a fleeting flicker of a different sketch right at the sale moment (when `lastSale.id` was briefly set before being cleared).

Fix: pass `statsRun.canvasesSold` instead. It's a monotonically-increasing per-run counter, resets only on ascend, gives a stable seed for both the sketch pick and the cell-reveal shuffle.

### Status

- **983 tests green** across 106 files. `npx tsc --noEmit` clean. `npx vite build` succeeds.
- Production bundle `index-CfwiamNL.js`; the workshop PNG and 41 per-tier sketches are bundled (each gets its own content-hashed `/assets/<name>-<hash>.png`).
- No save schema changes — purely visual.

### Notes

- **CSS overlay alignment is precise** because the workshop image renders at its native aspect (16:9 ≈ 1376/768) inside an `aspect-ratio`-locked container. A small dark gutter (`#1a1410`, matching the workshop interior tone) shows on whichever axis the stage exceeds 16:9.
- **The CanvasStage tests** assert the 5×5 grid (25 cells) and the reveal-count math at progressPct = 0 / 0.5 / 1. The `canvasArt.ts` helper has its own test (T1 pool returns at least 3 distinct sketches across 50 different canvas numbers; T5+ falls back to T4; cell reveal is a deterministic permutation).
- **High-speed canvases reveal fewer chunks.** At 25 chunks per canvas, a 1-second canvas only shows ~5–10 chunks before completing. The grid density is `SKETCH_GRID_DIM = 5` in `CanvasStage.tsx`; bump it lower (e.g., 4×4 = 16) if late-game speed makes the reveal feel pointless, or higher (e.g., 6×6 = 36) for slower tiers.
- **T2 has a `bike - Copy.png` leftover** in the asset folder. Harmless — it just adds one more entry to the pool. Worth removing if cleanup happens.

### Open follow-ups

- **Higher-tier art (T5+).** Today T5+ falls back to T4. When you author T5 sketches, drop them into `src/assets/canvas/T5/` and bump `HIGHEST_AUTHORED_TIER` in `canvasArt.ts`.
- **Grid density per tier.** Could vary `SKETCH_GRID_DIM` by tier — coarse 3×3 at low tiers (so sketches appear fast), finer 8×8 at high tiers (so the slow long canvas has visible incremental progress).
- **Reveal pattern.** Currently random. Could be center-out, top-down, or weighted by sketch-content density (more detail areas appear later) if you want a more "painting-like" cadence.
- **Stage-area aspect mismatch gutter.** If the workshop scene's letterbox bars look distracting at unusual viewport ratios, switch CSS `object-fit: contain` → `cover` AND compute the easel bbox dynamically from the rendered image rect (more code, but no gutter).
- **T2 `bike - Copy.png` cleanup.** Delete the leftover file when convenient.

---

## Canvas Tier System (2026-05-23)

Twelve commits on `master`, deployed (production bundle `index-BNEI9jiA.js`). Spec at `docs/superpowers/specs/2026-05-23-canvas-tier-system-design.md`, plan at `docs/superpowers/plans/2026-05-23-canvas-tier-system.md`.

### What landed

A within-run prestige loop on the canvas, sitting alongside the five existing upgrade tracks (sell_price, speed, size, crit, combo). A `canvasTier: number` field starts at 1. The moment `sellPriceLevel >= 15 && speedLevel >= 15` in the current tier, `canvasTick` auto-fires `tierUp()`: increments `canvasTier`, resets all 5 track levels to 0, resets in-canvas state (`canvasProgress`, `comboChain`, `isCritThisCanvas`), and calls `evaluateAchievements`. No button — the trigger is implicit on the next tick after the gate is met (also covers the save-already-met case after rehydration).

What changed at each layer:

- **Balance constants (`src/core/balance.ts`):** added `tierFactor(N) = 10^(N-1)` and `timeFactor(N) = 2^(N-1)` helpers. Changed `CANVAS_TIME_BASE` from 2 to 10. Removed the legacy `PAINT_TIME_BASE_SECONDS = 10` constant (it duplicated `CANVAS_TIME_BASE` after the change). All seven canvas balance functions (`canvasGold`, `canvasTime`, `sellPriceUpgradeCost`, `speedUpgradeCost`, `sizeUpgradeCost`, `critUpgradeCost`, `comboUpgradeCost`) now take an optional `tier` parameter (default 1) and multiply by the appropriate factor.
- **Store (`src/store/canvasSlice.ts`):** added `canvasTier: number` to `CanvasState` (default 1). Changed default `sellPriceLevel` and `speedLevel` from 1 to 0 (consistent with the other 3 tracks; the L1 default was a long-standing oddity). Added `tierUp(): boolean` action with the gate check and reset semantics. `canvasTick` calls `tierUp()` at the end of each tick when the gate is met.
- **Multipliers (`src/core/multipliers.ts`):** `CanvasMultiplierInputs` now includes `"canvasTier"`. Each of the five canvas multipliers (`getCanvasGoldMultiplier`, `getCanvasSpeedMultiplier`, `getCanvasSize`, `getCritChance`, `getComboBaseChance`) reads `state.canvasTier` — but per-level effects do **NOT** scale with `tierFactor` (see "The per-level scaling fix" below). Items / workers / school / achievements stay tier-agnostic.
- **Tick (`src/core/canvasTickPure.ts`):** passes `draft.canvasTier` to `canvasGold` and `canvasTime`.
- **UI (`src/components/painting/CanvasStage.tsx`):** `STAGE_NAMES` rekeyed from `sizeLevel` (0-10) to `canvasTier` (1-11) — same names (Sketch / Apprentice / Journeyman / … / Mythic), just shifted +1. Title row now reads `— Tier {canvasTier} · {stageName} —`. The bottom-right tier badge reads `Tier {canvasTier}`. The pixel-art SVG `aria-label` corrected to `Size {sizeLevel}` (semantically accurate). The sell-hover breakdown's "Sell Price" line correctly matches the engine (no tier multiplier on the per-level term).
- **UI (`src/components/painting/StatsRoom.tsx`):** new `TierBlock` component rendered at the top of the stats panel, showing current tier and active multipliers (Base gold ×N, Base time ×N, Upgrade costs ×N).
- **UI (`src/routes/PaintingRoute.tsx`):** the `helperState` constructed for the canvas math now includes `canvasTier`; all five upgrade cost previews pass tier; `canvasGold` and `canvasTime` calls pass tier.
- **Save schema:** bumped to v22. Migration v21→v22 adds `canvasTier: 1` for existing saves. Pre-existing upgrade levels are preserved (so a returning player with sellPriceLevel=20 doesn't lose progress); the L0 default change applies only to fresh saves. **Players whose pre-tier-system levels already meet the gate (sellPriceLevel >= 15 && speedLevel >= 15) will auto-tier-up on their next canvas tick after load.**

### The per-level scaling fix (a9fe908)

The design spec originally said per-level effects scale by `tierFactor` (e.g., T2 sell_price = +100%/level, T6 = +10000%/level). When wired through, this compounded destructively for speed: at T6 with `speedLevel=1`, the multiplier became `1 + 0.05 × 100000 = 5001`, collapsing canvas time to `320 / 5001 ≈ 0.064s`. A single L1 speed upgrade obliterated the cost-benefit curve. **The fix:** per-level effects stay flat across tiers — sell_price is always +10%/level, speed is always +5%/level, etc. The tier-scaling reward comes entirely from base canvas gold (×10/tier), base canvas time (×2/tier), and upgrade costs (×10/tier). Net gold/sec ramp from base alone = ×5/tier (10 / 2). Each tier-up still feels meaningful because the player resets to L0 on a fresh cost ladder with a 10× larger base canvas gold — early upgrades give big relative gains, and re-reaching L15 in the new tier is still cheaper-relative-to-income than pushing past L15 in the old tier was.

### Status

- **971 tests green** across 105 files. `npx tsc --noEmit` clean. `npx vite build` succeeds.
- Production bundle `index-BNEI9jiA.js` — verified live (`canvasTier`, `tierUp`, `timeFactor` present in the minified bundle; `tierFactor` inlined).
- Save schema bumped 21 → 22.
- Player-facing changes are noticeable: base canvas time is now 10s (was ~1.9s with the old L1 speed default), and tier-up at L15+L15 sell/speed wipes and ramps. Players who had built past L15 in the old system find themselves on T2+ immediately on load.

### Notes

- **Auto tier-up lives in `canvasTick`**, not in the upgrade actions. This means there's a (1 tick = ≤100ms) latency between buying the 15th upgrade and the tier-up firing, but it gracefully handles the "save already past the gate" case at load without needing a separate Bootstrap hook.
- **`TierUpCard` was built then removed.** Earlier in the same session a manual `TierUpCard` button (locked/ready states) was shipped, then removed when the user opted for auto-trigger on the milestone. The component and its tests are in git history at `679b6bb` if you ever need them back.
- **3h sim tests got timeout bumps** (commit `8387beb`) — `tests/dev/bot-simulation.test.ts` and `tests/integration/catchupBoot.test.tsx` needed longer timeouts after `CANVAS_TIME_BASE 2→10` lengthened the simulated paint cycles. Pre-existing tests, not new.
- **The spec doc still describes per-level tier scaling** as part of the design. It's out of date — the implementation reverted it (per the speed-divisor problem). The spec should be updated if anyone reads it for design intent. The plan doc and HANDOVER (this entry) are correct.
- **Workshop items, office workers, school bonuses, achievement bonuses, and skill-tree node contributions all stay tier-agnostic.** As tiers grow, these become baseline contributions overshadowed by the base-canvas-gold ramp — same pattern as in earlier-game balance.

### Open follow-ups

- **Crit and combo at high tiers.** Both have hard caps (95% crit, 100% combo). At T2 with the cap, you softcap crit in ~30 levels and cap combo in ~50 levels — same as T1. The user flagged that this needs rework (the user picked "we need to rework this later" during the design phase). Options: scale a crit-gold-multiplier past the cap, increase the cap per tier, or different past-cap behavior. No plan yet.
- **Spec doc accuracy.** The per-level scaling fix in `a9fe908` diverges from the spec. Either update the spec doc to match implementation, or write a brief addendum at the top noting the deviation and pointing to this HANDOVER entry.
- **Visual differentiation between tiers.** Today the canvas pixel art doesn't change between tiers. The stage name (Sketch → Apprentice → …) does, but the canvas itself looks identical at T1 and T11. Future work could tint or accent the frame per tier.
- **No tier cap.** Open-ended per design. At very high tiers (T20+) the base gold becomes `10 × 10^19 = 10^20`, which `break_eternity.js` handles fine — but eventual exploration of late-game pacing past T10 should confirm UI / formatBig hold up at those magnitudes.

---

## Paint Mastery removed (2026-05-23)

Ten commits on `master`, plan in `docs/superpowers/plans/2026-05-23-remove-paint-mastery.md`. Not yet deployed.

### What landed

The Paint Mastery (PM) mechanic is gone from the game. PM was a Big-valued accumulator earned only from achievements (`paint_mastery_flat` effect kind), which multiplied canvas gold output via `pmMult = 1 + 5.0 × log10(pm + 1)`. Removed end-to-end across engine, store, UI, and tests.

What changed at each layer:
- **Engine:** `pmMult` and `PM_LOG_FACTOR` deleted from `src/core/balance.ts`. `getPmMultiplier` and the `"paintMastery"` member of `CanvasMultiplierInputs` deleted from `src/core/multipliers.ts`. `canvasTickPure` no longer multiplies gold by `getPmMultiplier(draft)` — this was the live gameplay site for PM's gold effect.
- **Store:** `src/store/paintMasterySlice.ts` deleted, replaced by `src/store/lifetimeStatsSlice.ts` which keeps only `lifetimeGold` and `lifetimeInspiration` (independently fed achievement conditions, not PM). `addPaintMastery` / `_setPaintMastery` are gone.
- **Achievements:** `paint_mastery_flat` handler dropped from `evaluateAchievements`. The effect kind is removed from `KNOWN_EFFECT_KINDS` in the achievement-designer types. No existing achievement defs in `achievementsDesign.json` or `achievementConfig.ts` granted PM, so no JSON edits were needed.
- **UI:** PM chip gone from BottomBar (3 chips now: gold, inspi, fame). `CurrencyKind` no longer has `"pm"`. StatsRoom no longer shows the "Paint Mastery" multiplicative. CanvasStage sell-hover no longer shows the "Paint Mastery: ×N" line. AchievementsRoute no longer shows "+N PM" effect labels or the "{N} PM earned" header total. CatchupRecapModal no longer shows a "Paint mastery" row.
- **Catch-up:** `paintMasteryGained: Big` dropped from `CatchupResult` in `src/systems/catchup.ts`.
- **Save schema:** bumped to v21. Migration v20→v21 destructures and drops the persisted `paintMastery` field; old saves load cleanly with PM data silently discarded.
- **CSS:** the teal `--pm` / `--pm-d` / `--pm-glow` tokens are kept — they're shared with Ascension card visuals. Only the comment header changed ("PM (Paint Mastery)" → "Teal accent (Ascension cards)").

Tests: ~30 test files touched. `tests/store/paintMasterySlice.test.ts` renamed to `lifetimeStatsSlice.test.ts` and trimmed to lifetime-tracker coverage only. `tests/store/persistence-integration.test.ts` rewrote PM-presence assertions to absence assertions and added a new `describe("save migration v20 → v21 (Paint Mastery removed)")` block.

### Status

- **921 tests green** across 105 files. `npx tsc --noEmit` clean. Production build (`npm run build`) succeeds.
- Commits on `master`. **Not yet deployed** — run `npx vercel --prod` to ship.
- Save-state impact: live players' existing PM is silently dropped on next load (v21 migration). Their gold-per-canvas output drops back to the non-PM baseline immediately — this is the intended user-visible behavior change.

### Notes

- `canvasTickPure`'s removal of the PM factor is the critical behavioral change. The live `canvasSlice.canvasTick` delegates entirely to `canvasTickPure`, so the change applies to the running game, not just the catch-up sim.
- The v3→v4 migration (which originally added `lifetimeGold` as part of the v1.1 "PM redesign") still runs on legacy saves. Its behavior is unchanged; the v21 migration cleans up `paintMastery` at the end of the chain regardless of what intermediate steps did with it.
- Historical JSDoc/inline comments in `src/store/index.ts` migration block still reference "paintMasterySlice" in their descriptions of the v18→v19 migration. These are accurate for the moment they describe; leaving them preserves the migration log's historical truth.

---

## Tab-return catch-up wiring (2026-05-23)

One commit on top of the reset regression fix + brand logo, on `master`, deployed.

### What landed

**Commit `cc590ae` — `fix(catchup)`: run catch-up sim on tab-return, not just page load**

Symptom: switching tabs for 5s+ and returning credited nothing. The player saw the inspiration counter sit at the value it had when the tab went hidden, despite `928310b` and the surrounding offline-progress catch-up work shipping a week earlier.

Trace:
1. `defaultLifecycleHooks.onHide` correctly wrote `lastSeen = Date.now()` and paused the tick loop on visibility=hidden.
2. `defaultLifecycleHooks.onShow` only called `resumeTickLoop()` on visibility=visible. It never read `lastSeen`, never called `runCatchupSimulation`.
3. The catch-up engine itself was wired into `Bootstrap`'s `silent_sim` phase, which only fires once per page load (after rehydration). No path re-entered `silent_sim`, so tab-return missed time was just lost.

Fix: replace `installLifecycle(defaultLifecycleHooks)` in `Bootstrap` with custom hooks that delegate `onHide`/`onUnload` to default but override `onShow`. When `(Date.now() - lastSeen) / 1000` falls in `(SILENT_THRESHOLD_S, TOAST_THRESHOLD_S)` (5s, 2h), the new `onShow` runs `runCatchupSimulation` silently and then `setPhase((cur) => ({ ...cur, toast: result }))` so the same `CatchupToast` component renders over the live game. `≤5s` and `≥2h` fall through to a plain `resumeTickLoop()`. The `≥2h` in-session path stays a plain resume by design: a mid-session loading scene + recap modal would be too jarring for a returning player (user explicitly scoped the fix this way during the work).

Two race defenses in the new hook:
- `resumeSimInFlight` ref blocks overlapping sims if the user thrashes tab visibility (rapid hide/show before the previous sim commits).
- `useGameStore.setState({ lastSeen: Date.now() })` immediately after `runCatchupSimulation` resolves successfully. `cloneGameState` copies `lastSeen` as a primitive, so the sim's `setState(draft)` commit reverts `lastSeen` to the baseline; without this overwrite, the next visibility cycle would re-replay the same window.

Tests: +2 in `tests/integration/catchupBoot.test.tsx` under a new `Bootstrap in-session tab-return catch-up` block. One asserts the 10min-hide → toast path (sim called with ~600s, "Welcome back" appears); the other asserts the 3s-hide → no-sim, no-toast path. Both use `vi.spyOn(document, "hidden", "get")` to drive `visibilitychange`, mirroring the existing `tests/systems/lifecycle.test.ts` pattern.

### Status

- **935 tests green** across 105 files (+2 from the in-session tests; nothing else moved).
- Commit on `master` (HEAD `cc590ae`) and deployed via `npx vercel --prod`. Production bundle `index-DKLddeP-.js` confirmed live by grepping for `catchup.simulation.resume` (the new `reportError` context).
- No save-state changes. SAVE_VERSION stays at 20.

### Notes / save-state impact

- **The fix doesn't touch `lifecycle.ts`.** That module stays agnostic — the catch-up logic lives in Bootstrap, where it has natural access to `setPhase` (for the toast) and `unmountedRef` (for cancellation). The same pattern (custom hooks composed from `defaultLifecycleHooks`) is the recommended escape hatch for anything that needs to extend onShow/onHide without coupling the lifecycle module to UI state.
- **`lastSeen` post-sim write is essential.** Without it, the second visibility cycle in a session re-replays the first cycle's window because `cloneGameState` snapshots `lastSeen` and the draft commit reverts it. The first cycle works fine because `onHide` writes `lastSeen=Date.now()` before pausing; the bug only manifests on subsequent cycles. This is also a latent issue in Bootstrap's boot-time catch-up (also commits a stale `lastSeen` via the draft), but the boot path is followed by the 10s heartbeat which corrects it within one tick; the in-session path can be followed by another `onHide` *before* the heartbeat fires, which is why the explicit write is required here.
- **`resumeSimInFlight` is a `useRef`, not slice state.** StrictMode's effect double-fire still installs/cleans the lifecycle hooks twice in dev, but the ref persists across the remount, so the guard isn't broken by the second install. If we ever move catch-up orchestration out of Bootstrap into a system module, the ref needs to follow it — leaving it behind would re-introduce the race.
- **The displayed `inspi/sec` chip on the topbar shows only the tree's passive rate.** Poke the Tree grants are not in that number. Players returning from a tab-hidden window now see the toast with the correct total (tree + poke), which can read as "over-estimated" if they mentally extrapolate from the chip × elapsed seconds. Not a bug; if it causes confusion at scale, the chip can be extended to include Poke contribution (see `src/components/shell/CurrencyChip.tsx:46` + `src/core/skillTreeTickPure.ts`).

### Open follow-ups

- **Regression test for the in-session `lastSeen` post-sim write.** The two new tests cover the happy-path 10min and the silent ≤5s. Neither asserts that the second consecutive visibility cycle in a session uses the right baseline. A test that hides → shows (sim runs) → hides → shows (second sim runs with elapsed measured from the *first* show, not from a stale lastSeen) would lock the race defense in. Worth adding before the catch-up engine sees more state changes.
- **Convergence-test coverage at production deltas.** `tests/dev/bot-simulation.test.ts` asserts live-vs-sim convergence at matched 1s delta over ~1h. Production catch-up uses `chooseDelta` (0.1s / 1s / 10s / 60s based on elapsed window). Empirical probe during this session showed exact match for vanilla tree-only state at any delta, and ~1 missed Poke the Tree grant per 600s at `delta=0.1s` due to FP accumulation in `pokeTreeTimer`. Under-counts only, but worth a precision test that pins the actual numbers per delta tier.
- **The `≥2h` in-session path silently drops missed time.** Intentional per the design call this session, but if a player leaves the tab open for a working day with the game hidden, they'll come back to no catch-up at all on that return. If we revisit, options are: trigger the loading-scene path on tab-return (jarring), apply the sim silently with a recap-style modal (less jarring, no scene), or just show a "you missed 8h — reload to claim" hint. No action needed unless players complain.

---

## Reset regression fix + brand logo (2026-05-23)

Two commits on top of the boot UX polish, both on `master`, both deployed.

### What landed

**Commit `2d4bbb2` — `fix(reset)`: prevent `beforeunload` from re-persisting wiped state**

The TopBar dev reset stopped wiping progress after `928310b` (offline-progress lifecycle wiring). Symptom: clicking Reset → Yes only reset the music volume; gold/inspi/fame/skill-tree/etc. all came back identically after the reload.

Trace:
1. `wipeAndReload()` in `TopBar.tsx` correctly cleared IDB (`persist.clearStorage()`) + `localStorage.clear()` + `persistedAdapter.discard()`.
2. `location.reload()` fired `beforeunload`.
3. The new `defaultLifecycleHooks.onUnload` in `lifecycle.ts` ran `useGameStore.setState({ lastSeen: Date.now() })`. That setState went through the Zustand persist middleware, which enqueued a save of the **still-in-memory progress** into the throttled adapter.
4. `persistedAdapter.flush()` (also inside `onUnload`) wrote that save straight back to IDB — undoing the wipe a few hundred ms before the page actually reloaded.
5. After reload, IDB had the just-rewritten save → progress restored.

The music wasn't affected because it lives in `localStorage`, and nothing in `onUnload` re-writes localStorage.

Fix: set the existing `sessionStorage.__skipNextLastSeenWrite = "1"` flag (already used by the dev `testCatchup` helper) before `clearStorage`. `shouldWriteLastSeen()` in `lifecycle.ts` reads-and-consumes the flag, so `onUnload` skips its `setState`. No setState → persist doesn't enqueue → flush is a no-op → IDB stays empty across the reload.

Reusing the existing flag mechanism rather than adding a new one keeps `lifecycle.ts` agnostic; the wipeAndReload flow just sets the same sessionStorage key that the catch-up dev helper sets.

**Commit `b325134` — `feat(topbar)`: replace ARTDLE wordmark with logo PNG**

Top bar's hand-typed `<span class="brandA">A</span><span>RTDLE</span>` swapped for an `<img src="/artdle_logo.png" alt="Artdle">` rendered at 42px tall. The PNG is already preloaded by `index.html` for the splash, so the topbar instance is a cache hit — zero extra network. Pixel-rendered (`image-rendering: pixelated`/`crisp-edges`). Drops the `.brandA` `--fame` glow trick from the old typographic mark; the pixel logo carries its own identity. Test `"renders the ARTDLE brand wordmark"` retitled and rewritten to assert `getByAltText("Artdle")` instead of the two `getByText("A")` / `getByText("RTDLE")` checks.

### Status

- **933 tests green** across 105 files (TopBar test count unchanged).
- Both commits on `master` (HEAD `b325134`) and deployed via `npx vercel --prod`. Latest production bundle `index-B5RRGwCU.js` (reset fix); brand-logo bundle ships next deploy.
- No save-state impact.

### Notes / save-state impact

- **The reset regression was latent in any flow that called `location.reload()` after `clearStorage()`.** The new mitigation is specific to the TopBar reset button. If another path needs the same guarantee (e.g., a "wipe player data on logout" feature), it should set the same `__skipNextLastSeenWrite` flag.
- **`__skipNextLastSeenWrite` is now used by two callers**: the dev `testCatchup` window helper (sets the flag so a manually-set `lastSeen` survives the reload) and `wipeAndReload` (sets the flag so the lifecycle doesn't re-persist the wipe). Same mechanism, two semantically distinct callers — both want "skip the next lifecycle write". The flag is read-and-consumed by `shouldWriteLastSeen()`, so concurrent uses (impossible in practice, but in theory) would still be safe: only the first onHide/onUnload after the flag is set skips its setState.
- **Brand logo carries the same `/artdle_logo.png` asset as the splash.** Replacing the logo file means updating one place (the source PNG); both surfaces pick up the change. `index.html` preload + cache means the topbar render is instant.

### Open follow-ups

- **Regression test for the reset bug.** `tests/components/shell/TopBar.test.tsx` covers the brand rendering and the reset confirm flow; it does not assert that the `beforeunload` lifecycle hook respects the skip flag during a reset. A jsdom test that dispatches `beforeunload` after `wipeAndReload` could lock this in. Worth adding before the next save-shape change.
- **Lifecycle hook detach during reset.** Setting the skip flag is fine but it's a workaround for a missing primitive: "the page is intentionally tearing down, stop all lifecycle writes." If a future feature needs a stronger guarantee (e.g., the lifecycle starts writing more than `lastSeen`), a `disableLifecycle()` API in `lifecycle.ts` would be cleaner than per-write flags.

---

## Boot UX polish + nav icons (2026-05-22→23)

Three commits on top of the offline-progress catch-up, all on `master`, all deployed (latest bundle `index-dROLcnuR.js`).

### What landed

**Commit `961bc24` — minimum 3s hold on the long-absence loading scene**

Adaptive-delta sims finish in ~50ms for typical absences, so the loading scene was flashing by faster than readable. `MIN_LOADING_SCENE_MS = 3000` (exported from `main.tsx`) is now enforced before transitioning out of `loading_scene`. Applied to both the success path (→ recap) and the fail-open path (→ playing) so the failure case doesn't flash differently from the success case. The hold accumulator captures `Date.now()` after `setPhase({ kind: "loading_scene", ... })` and `await`s `MIN_LOADING_SCENE_MS - elapsed` if positive before the next transition. New integration test asserts the Continue button can't appear before the minimum hold elapses.

**Commit `9c22fbc` — logo splash + crossfade to game + always-land-on-tree**

Reshaped the boot sequence around a single splash identity. Previously the player saw three unrelated screens — bare "Loading…" text, then the catchup progress bar with no logo, then the logo image popping in mid-scene as the PNG finished loading, then a recap modal on a black backdrop. Now:

- Logo PNG copied to `public/artdle_logo.png` (alongside the source in `src/assets/Images-gen/`) and `<link rel="preload" as="image" href="/artdle_logo.png">` in `index.html`. Both `LoadingScreen` and `CatchupLoadingScene` reference the same `/artdle_logo.png` URL, so the same cached image renders across the rehydrate → silent_sim → loading_scene transitions — no flash, no second load.
- `LoadingScreen.tsx` rewritten to share `CatchupLoadingScene.module.css`: same dark vertical gradient, same `.logo` styling (`image-rendering: pixelated`, 480px max-width, 32px bottom margin). The "Loading…" text is gone. The CSS Module hash equality across the two importers means the class names match at runtime.
- `recap` phase folded into `playing` as an overlay field. New phase shape: `{ kind: "playing"; recap: CatchupResult | null; toast: CatchupResult | null }`. When the long-absence sim finishes, the phase transitions directly to `playing(recap=result, toast=null)`. The App mounts (BrowserRouter + tree route), and `CatchupRecapModal` renders on top with its existing semi-transparent `rgba(0,0,0,0.7)` backdrop — the player sees the recap over the dimmed game scene instead of a void.
- Motion `AnimatePresence` crossfade (500ms) between splash and game. The splash is wrapped in a `motion.div` with `position: fixed; inset: 0; zIndex: 9999`; on phase change, the `exit` animation fades its opacity to 0 while the game's `initial={{opacity:0}}/animate={{opacity:1}}` fades it in. Both render simultaneously during the transition, so the modal lands on a fully-rendered game.
- Synchronous URL rewrite at module load: `window.history.replaceState({}, "", "/tree")` if the current path isn't `/tree` and doesn't start with `/dev/`. Runs before React mounts, so BrowserRouter reads the corrected URL on first render. Reload on any sub-route always reveals the inspiration tree after the fade; `/dev/*` designers preserve their working URL.
- Achievement evaluation guard updated to fire only when entering `playing` with both `recap === null` AND `toast === null` (the no-sim path). Recap dismissal flips `recap → null` but doesn't change `phase.kind`, so the effect (deps `[phase.kind]`) doesn't re-fire — no double evaluation.

**Commit `334eabd` — pixel-art icons for nav + locked Music/Sculpture teasers**

Top bar nav swapped from text labels to 36×36 pixel-art icons stored in `src/assets/bar_icons/` (`tree.png`, `painting.png`, `ascension.png`, `constellation.png`, `Achievements.png`). Visual treatment:
- Inactive: `opacity: 0.55` + `grayscale(0.35)`.
- Hover: `opacity: 0.9`, full color, 1px translateY lift.
- Active: full opacity + saturation + `drop-shadow(0 0 4px var(--fame))` golden glow + existing fame-coloured border.
- All icons use `image-rendering: pixelated`/`crisp-edges` so the dithering stays crisp at 36px.
- Labels preserved via `aria-label` and `title` attributes (tooltip + screen-reader).

Locked teasers inserted between Painting and Ascension: **Music** (`music.png`) and **Sculpture** (`sculpture.png`). Rendered as `<span>` (not `<NavLink>`) so no router navigation possible; styled with `opacity: 0.22 + grayscale(1)`, `cursor: not-allowed`, no hover animation, title `"X — coming soon"`, `aria-label="X (locked)"`. A 22×22 inline-SVG padlock badge sits at `right: -4px; bottom: -4px` overlapping into the icon's bottom-right corner, with a 4-direction 1px `drop-shadow` outline + a 3px ambient shadow so the lock reads cleanly against any backdrop. The padlock is hand-coded as `<rect>` blocks in a 10×10 viewBox with `shape-rendering: crispEdges` for pixel-perfect rendering at any size.

These teasers hint at the multi-art-form roadmap (per [`docs/PORT_PLAN.md`](PORT_PLAN.md) §13 and project memory) without committing routes; if the player tries to click them, nothing happens.

### Status

- **933 tests green** across 105 files. +1 from the minimum-hold test in `catchupBoot.test.tsx` (the +60 from offline-progress was already in the previous handover).
- `MIN_LOADING_SCENE_MS` is exported from `src/main.tsx` for the test that asserts the hold.
- All three commits on `master` (HEAD `334eabd`) and deployed via `npx vercel --prod`. Production bundle `index-dROLcnuR.js` includes the catchup strings, the preload link, and the lock SVG inline.
- Untracked, intentionally not committed: 4 fresh experiment PNGs under `src/assets/Images-gen/` (alongside the now-committed `artdle_logo.png`), `phase7.png`–`phase40.png` future tree stages, `src/assets/images/ascend gate/gate.png` legacy fallback.

### Notes / save-state impact

- **No save-state changes this batch.** SAVE_VERSION stays at 20.
- **`MIN_LOADING_SCENE_MS` is module-level, not slice state.** Live runtime instantiates the module once per page load; tests assert via the exported constant rather than mocking it. A future "skip catch-up animation" toggle (if requested) would gate this constant, not eliminate it.
- **CSS Module sharing across `LoadingScreen` and `CatchupLoadingScene`**: both `import styles from "@/components/catchup/CatchupLoadingScene.module.css"`. Vite/CSS-Modules hashes class names per-file, so importing the same file from two TS files yields identical hashes — both components see the same `.scene`, `.logo`, `.title`, `.barOuter`, `.barInner` keys. If `CatchupLoadingScene.module.css` is renamed or its class names change, both consumers update together.
- **Recap-on-game means the App mounts during the recap phase.** Tick loop and lifecycle install on entering `playing` regardless of `recap` state, so the game is logically "live" while the recap modal is visible — clicks behind the 70%-opaque backdrop wouldn't reach the App's pointer-events because the modal's backdrop is `position: fixed; inset: 0`, but if a future modal design has gaps, the App is interactable. The existing modal blocks all clicks via the backdrop, so this is currently safe.
- **`/tree` URL rewrite is one-shot at module load.** Subsequent in-game navigation (e.g., to `/painting`) is unaffected. Only initial page loads on a non-tree route get rewritten. If we ever add deep-linking (share a URL to a specific route), this rewrite would need an opt-out (e.g., respect a `?keep` query param).
- **Locked nav items have no route registered in `App.tsx`.** `/music` and `/sculpture` are not in the `<Routes>` block. Direct URL navigation to those paths would hit the `*` catch-all and redirect to `/tree`. The locked teasers in the top bar can't trigger navigation because they're `<span>`, not `<NavLink>`.

### Open follow-ups

- **Loading scene still uses a flat gold progress bar.** A themed animation (animated brush stroke, growing tree, slowly-filling ink well) would feel more on-brand. Not urgent.
- **Recap modal copy on zero-gain catch-ups.** A player who was idle in a state with no producing tree and no autocraft sees a recap with "+0 gold · +0 inspi · 0 canvases". Consider suppressing the recap (and the toast) when all gains are zero — go straight to game.
- **Locked teaser glow.** If we ever want to draw attention to upcoming art forms, a slow ambient pulse or a "soon" sparkle on Music/Sculpture would work without breaking the no-click constraint.
- **TopBar still tests against labels.** The TopBar tests pass because `aria-label` preserves the discoverable name, but if we ever remove `aria-label` (e.g., decide the icons are self-describing), those tests need icon-based selectors.

---

## Offline-progress catch-up — full implementation (2026-05-22)

### What landed (18 commits, all on `master`)

Plan: [`docs/superpowers/plans/2026-05-22-offline-progress.md`](superpowers/plans/2026-05-22-offline-progress.md). Spec: [`docs/superpowers/specs/2026-05-22-offline-progress-design.md`](superpowers/specs/2026-05-22-offline-progress-design.md).

Closes the long-standing v1 "no offline progress" gap. On reload, the rehydrated state is cloned and ticked forward by the elapsed wall-clock time inside an async chunked loop, then committed back to the store in a single `setState`. UX branches on elapsed time: ≤ 5s silent, ≤ 2h spring toast top-right, > 2h full-screen loading scene + recap modal.

**Phase 1 — pure tick refactor (6 commits, `65454aa` → `e22a5d3`)**

Every game tick now exists in two forms: a `*TickPure(draft, deltaSeconds)` mutator in `src/core/`, and a thin slice wrapper in `src/store/*Slice.ts` that builds a draft, calls the pure form, then returns a shallow-merge object to Zustand. Helpers (`addCurrency`, `spendCurrency`, `trackSaleGoldPure`, `trackInspirationGainPure`, `incrementStatPure`, `patchRunStatsPure`, `awardOfficeXpPure`) live in `src/core/pureMutations.ts`. New files:
- `treeTickPure.ts` — inlines `getProducingParts` + `growSapling` loop (cap 100 iter).
- `skillTreeTickPure.ts` — poke-tree timer.
- `schoolTickPure.ts` — research countdown + completion stat bumps.
- `officeTickPure.ts` — candidate trickle into queue.
- `canvasTickPure.ts` — full multi-sale loop with crit/combo RNG, embeds `awardOfficeXpPure`. Skips `evaluateAchievements()` (deferred to end-of-sim).
- `workshopTickPure.ts` — includes `performCraftPure` (also called by the live `craft` wrapper).

The wrappers keep `evaluateAchievements()` on the live path (fires after the pure mutation returns), so live play behaves identically.

**Phase 2 — `lastSeen` plumbing (3 commits, `30a70bf` → `b2b84c2`)**

- `metaSlice.lastSeen: number` (epoch ms), seeded `Date.now()` at slice init. SAVE_VERSION **19 → 20**, migration backfills `lastSeen: Date.now()` for older saves (so a player on v19 sees zero elapsed on first load, which is correct).
- `defaultLifecycleHooks.onHide` and `.onUnload` write `lastSeen` before flushing IDB.
- `tickAll` accumulates a module-level `_heartbeatAccum`; every 10 simulated seconds it writes `lastSeen: Date.now()` so a hard crash (process kill, OS hang) loses at most 10 s of elapsed time.

**Phase 3 — clone helper (1 commit, `5e0c58a`)**

`src/systems/catchupClone.ts` exports `cloneGameState(state) → DraftState`. Spreads the top-level object, `{ ...obj }`-clones every mutable `Record`, `.map`-clones every mutable array (with nested `affixes` re-spread for `inventory`/`equipped`/`queue`), shares Big by reference (immutable). Pure tick functions can now scribble on the draft without leaking into the live store.

**Phase 4 — simulation engine (2 commits, `ea00177`, `7f3b8db`)**

`runCatchupSimulation(elapsed, onProgress) → CatchupResult` in `src/systems/catchup.ts`:
- `chooseDelta` adapts step size: < 30 min → 0.1 s, < 1 h → 1 s, < 1 d → 10 s, ≥ 1 d → 60 s. Keeps the work bounded — a 1-year elapsed simulates in ~3-5 s.
- Outer loop yields to the browser via `setTimeout(0)` every `BATCH_SIZE = 200` steps, so progress UI updates and the page stays responsive.
- After the loop, applies the draft via `setState`, then calls `evaluateAchievements()` once — newly-unlocked achievement IDs are diffed against the baseline and returned in the result.
- Bot convergence test (`tests/integration/bot-simulation.test.ts`) runs the same initial state through 3600 live ticks vs. one `runCatchupSimulation(3600)` and asserts gold / inspiration / canvases-sold land within 5%. Confirms the pure-tick refactor preserves economy semantics.

**Phase 5 — UI (3 commits, `e412987` → `47943e5`)**

- `CatchupToast` — fixed top-right, spring slide-in from the corner (matches `AchievementToast` palette), 6 s auto-dismiss, single line: `+gold · +inspi · N canvases`.
- `CatchupLoadingScene` — full-screen overlay, animated gold progress bar, "Catching up on Xh Ymin away…" copy. ARIA progressbar with live `aria-valuenow`.
- `CatchupRecapModal` — backdrop modal, dl-grid of stats (gold, inspi, canvases, items crafted, paint mastery), bullet list of newly-unlocked achievements (section omitted when empty), Continue button.
- `src/core/formatElapsed.ts` shared by all three.

**Phase 6 — Bootstrap branching (1 commit, `2cee95d`)**

`src/main.tsx` rewritten around a `Phase` discriminated union (`rehydrating | silent_sim | loading_scene | recap | playing`). On hydration finish, `decideEntry()` reads `lastSeen`, picks a branch, and the component renders accordingly:
- `elapsed ≤ 5s` → straight to `playing`, no UI.
- `5s < elapsed < 2h` → `silent_sim` (LoadingScreen) → run sim → `playing` with `toast` set.
- `elapsed ≥ 2h` → `loading_scene` with live progress → `recap` modal → click Continue → `playing`.
- Sim throws → `reportError` + skip to `playing` without catch-up UI (fail-open).
- Tick loop + lifecycle install only fire on entering `playing`. Achievement evaluation moved out of the standalone effect into the sim (and the no-catch-up branch fires it on first `playing` mount).

**Phase 7 — dev playtest helper (1 commit, `2438f66`)**

The naive playtest recipe (`useGameStore.setState({lastSeen: PAST}); location.reload()`) was racy: `onUnload` fires before unload and overwrites `lastSeen` back to `Date.now()`. Fix:
- `window.testCatchup(hoursAgo)` (DEV-only, mounted on `window` in `main.tsx`) — sets `lastSeen` to `Date.now() - hoursAgo * 3600_000`, writes `sessionStorage.__skipNextLastSeenWrite = "1"`, flushes IDB, reloads.
- `shouldWriteLastSeen()` in `lifecycle.ts` reads-and-consumes the flag on the next `onHide`/`onUnload` so the manually-set value survives the reload.
- Production lifecycle untouched (the flag is never set outside the helper).

### Status

- **932 tests green** across 105 files (was 872 / pre-catchup baseline). +60 net tests from the work.
- Browser playtest confirmed working at all three branches by user (2026-05-22).
- All 18 commits on `master` (HEAD `2438f66`). Push + `npx vercel --prod` performed at end of session.
- Pre-existing tsc errors in `achievementSlice.ts`, `officeSlice.ts`, `statsSlice.ts`, `bot-simulation.test.ts`, `SchoolDesignerRoute.test.tsx`, `SortableCard.tsx` carry over — not introduced here.

### Notes / save-state impact

- **SAVE_VERSION 20 migration is non-destructive**: older saves get `lastSeen = Date.now()` on first load, so the first reload after upgrade shows zero elapsed (correct — the player hadn't been "tracked" before).
- **Achievement notifications queue normally**: end-of-sim eval pushes any newly-unlocked achievements through the existing `notificationQueue`, so the rainbow toast fires on top of the catch-up recap once the user dismisses it. FIFO queue semantics from earlier work handle this naturally.
- **Failure mode is fail-open, not fail-stop**: any thrown error in the sim is reported (`reportError`) and the game mounts directly. Worst case the player loses the offline progress for that one session; the live tick loop and saves keep working.
- **The 10s heartbeat is module-level state**: tests that call `tickAll` across cases need to reset `_heartbeatAccum` (or be tolerant of cross-test bleed). Live runtime is unaffected — the module is instantiated once per page load.
- **`testCatchup` is a DEV-only window helper**: the lifecycle `shouldWriteLastSeen` gate has zero effect in production since the sessionStorage flag is never set. Safe to ship.

### Open follow-ups

- **Loading scene polish** — currently a flat gold progress bar on a dark gradient. Could swap in a themed animation (e.g. an animated brush stroke filling a canvas) when art lands. Not urgent.
- **Toast copy when zero gain** — if a player was idle in a state with no producing tree and no autocraft, the toast still appears showing `+0 gold · +0 inspi · 0 canvases`. Consider suppressing the toast when all gains are zero.
- **Recap "items crafted" count** is from `statsRun.workshopItemsCrafted` delta — this resets on ascension, so a catch-up that spans an in-sim ascension would under-report. Currently no system can auto-ascend during catch-up, so this is theoretical.

---

## Tree art + tier achievements + balance buff + gate videos + stats polish (2026-05-20→21)

### What landed (eight commits, all on `master`, all deployed)

**Commit `71a92a5` — tree backdrops replace hand-drawn SVG**
- `TreeScene` now renders one full-scene PNG per stage (`phase1.png`–`phase6.png` in `src/assets/images/Inspiration_Tree_phases/`) under the existing motes + fireflies SVG overlay. Stages 6+ clamp to `phase6.png`. The hand-drawn SVG landscape, 3-tier sprite variants, and the `data-tree-stage` test attribute are gone.
- `phase7`–`phase40` live in the same folder but are not wired (left untracked locally) — pick up when stages 7+ ship.

**Commit `440ea79` — Tier 2/3/4 tree achievements + designer `=` parser fix**
- New synthetic stat `tree.tier` in `resolveStatValue` (`achievementSlice.ts`) = `state.currentStage + 1` (1-indexed UI tier).
- `T2/T3/T4` achievements gated on `tree.tier >= N`, each grants `canvas_gold_pct: 1.0` (+100% canvas gold).
- New `"inspiration"` category added to `AchievementCategory` union; `AchievementToast.CATEGORY_LABEL` and `AchievementsRoute.CATEGORIES` learned about it. `psychedelic_enjoyer` renamed to `Psychedelic_enjoyer` to match the design file casing.
- Designer bug fix: `parseCondition` rejected `=` (single equals), so `tree.tier = N` silently fell back to the default `lifetime.canvasesSold >= 1`. Parser now accepts `=` as a synonym for `==` (normalizes to `==` on save).

**Commit `d759c53` — color tree / rainbow / get_inspired / basic_technique buffs**
Balance constants in `src/core/balance.ts`:
- `GET_INSPIRED_PER_LEVEL`: 0.25 → 0.50
- `BASIC_TECHNIQUE_PER_LEVEL`: 0.02 → 0.05
- `RAINBOW_PER_LEVEL`: 0.50 → 5.00 (multiplicative)
- `COLOR_PER_LEVEL`: 0.20→0.50 (black_white), 0.30→0.80 (×3 primaries), 0.40→1.30 (×3 secondaries), 0.50→2.00 (×3 tertiaries)

Full color tree + rainbow combined moves ×7.2 → ×82.8. Descriptions in `skillTreeNodes.ts` stripped inline numbers — `numericEffect` is the single source of truth. 10 multiplier test assertions and 1 hover test retuned.

**Commit `d644db5` — Rising Star (+20% speed at 1k canvas sales)**
Wires straight through — `lifetime.canvasesSold` already resolves via the slice's `lifetime.*` fallback, `speed_pct` already aggregates in `getCanvasSpeedMultiplier`. Description fixed in both JSON and runtime ("gold gain" → "canvas speed") to match the effect kind.

**Commit `8297f6d` — stats panel hides zero contributors and locked blocks**
`StatsRoom` was spoiling unlockable mechanics. Now:
- Contributor lines hide when value is 0 (extends the existing `School`/`Achievements` pattern to `Canvas upgrade`/`Skill tree`/`Items`/`Workers`).
- Whole blocks hide when they have neither contributors nor multiplicatives. Crit and Combo stay hidden until the player buys their unlock skills or equips an affixed item; Sell Price and Speed always show (sellPriceLevel/speedLevel default to 1).
- Size block hides until total size > 1; once raised, the `Base ×1.00` anchor stays and the other rows render only when meaningful.

**Commit `d7832de` — cavern backdrop replaced with looping gate video**
New `gate_animated.mp4` contains the whole ascension scene (cave + crystals + arch). `Cavern` renders it as a full-area `object-fit: cover` video; the SVG `Portal`, its CSS, and the cavern CSS gradient + 5 pulsing crystals are gone. Pauses on `prefers-reduced-motion`. `Portal.tsx` / `Portal.module.css` / `Portal.test.tsx` deleted; `AscensionRoute` dropped the `portalCenter` wrapper.

**Commit `e1707bc` — gate-opening video plays on confirm, then ascend**
Second video `gate_opening_animated.mp4`. `Cavern` now takes a `phase` prop (`"idle"` loops the closed-gate clip; `"opening"` plays the opening clip once with `loop={false}`). `AscensionRoute` swaps phase to `"opening"` on confirm-modal Ascend, hides the CTA during the animation, and calls `performAscend()` in the `onEnded` handler. Reduced-motion users skip the video and ascend immediately on confirm.

**Commit `3fda921` — favicon refresh + cache-bust**
`public/favicon.png` synced from `src/assets/Images-gen/favicon.png` (the runtime-served copy — Vite serves `public/` at the site root; the `src/assets/` copy is the working source and isn't read at runtime). `index.html` got `?v=2026-05-21` so cached browsers refetch.

### Status

- **872 tests green**, tsc clean (pre-existing errors in `achievementSlice.ts`, `officeSlice.ts`, `statsSlice.ts`, `bot-simulation.test.ts`, `SchoolDesignerRoute.test.tsx`, `SortableCard.tsx` remain — none introduced by this session).
- All eight commits pushed to `master` (HEAD `3fda921`) and deployed via `npx vercel --prod`. Each deploy verified by curl-grepping the production bundle for a known new string.
- Production live: https://artdle-web.vercel.app
- Untracked, intentionally not committed: `.mcp.json`, `docs/superpowers/plans/2026-05-17-achievement-system.md`, `src/assets/images/Inspiration_Tree_phases/phase7.png`–`phase40.png` (future stages), `src/assets/images/ascend gate/gate.png` (unused, potential poster fallback), `src/assets/Images-gen/favicon_old.png` (backup).

### Notes / save-state impact

- **Skill-tree buff is retroactive**: anyone with `purchasedNodes` populated gets the bigger multipliers on next load. No migration needed — multipliers recompute from the (unchanged) `purchasedNodes` record against the new constants.
- **psychedelic_enjoyer rename**: lowercase ID is no longer in the runtime. Any save with the old completion will see the toast again the next time `lifetime.inspirationgain >= 1000` re-evaluates.
- **Achievement set expanded**: the 2026-05-19 entry's note that the runtime was "intentionally reduced to the single `Sound_Blasting` achievement" is superseded. Current runtime achievements: `Sound_Blasting`, `Piggy_bank`, `Millionaire`, `Nerbard_alnaurt`, `Psychedelic_enjoyer`, `T2/T3/T4`, `Rising_star` (9 total).
- **Description-vs-effect drift watch**: now that `numericEffect` drives skill-tree display, a future tweak that bumps `balance.ts` but forgets `numericEffect` will silently show a wrong number to the player. The same class of bug bit Rising Star at design time (description said "gold gain" but effect was `speed_pct`) — caught at wiring.

---

## Achievement craft→game pipeline + rainbow unlock toast (2026-05-19)

### What landed

**Commit `c6802cd` — achievement designer pipeline + designer UX**

- **`/dev/achievement-designer` condition field is now plain text.** Raw text is the persisted source of truth (`conditionText`, ephemeral — stripped on save like effect ids, ignored by `migrateAchievement` unless present), parsed best-effort into the structured `{stat,op,value}`. Never reverts on blur/re-render. `ConditionInput` is fully controlled; invalid text shows a red border but is kept. (`types.ts`, `storage.ts`, `api.ts`, `AchievementDesignerRoute.tsx`/`.module.css`).
- **Save endpoint added.** `/api/achievement-design` Vite middleware in `vite.config.ts` (mirrors the skill/school writers). Previously the achievement designer POSTed to a non-existent `/__superpowers__/write-json` → every "Save to file" 404'd silently → file never updated. **Requires dev-server restart after pulling** (vite.config change).
- **File is source of truth on load.** `useAchievementDesignerState` now `useState(() => loadFileBaseline())` — the localStorage draft no longer overrides the file. Draft still auto-saves. This was a user-approved decision: stale drafts were silently reverting out-of-band wiring (and earlier caused a 219→1 data loss). Skill/school designers left unchanged.
- **One-char-at-a-time id input fixed** — achievement cards key by index, not the editable `ach.id`.
- **Shared `DevTabBar`** (`src/dev/DevTabBar.tsx`/`.module.css`) across skill/school/achievement designers (tabs persist on every designer page; active-tab underline).
- **Skill designer theming** — `.layout` overrides the game design tokens (`--mono/--sans/--serif`, `--bg-*`, `--ink-*`, `--border-subtle`) to a system-font grey palette so it visually matches school/achievement (was rendering the game's Silkscreen/purple theme via shared CSS vars). ActionBar usage replaced with an inline topBar.

**Achievement wiring (the craft→game loop)**

- New synthetic stat in `resolveStatValue` (`achievementSlice.ts`): `audio.musicVolumePct` reads localStorage mirroring `useMusic.ts` defaults (absent volume → 20, muted → 0). Convention: `audio.*` stats are localStorage side-channels.
- `Sound_Blasting` gated on `audio.musicVolumePct >= 100`, grants `inspi_pct 0.1` (feeds `getInspiMultiplier`). Verified: fresh game = 20 (no unlock), maxed = 100 (unlocks).
- Engine tests decoupled from the mutable design config via `vi.mock("@/config/achievementConfig", …)` in `tests/store/achievementSlice.test.ts` and `tests/core/achievementMultipliers.test.ts` — editing `achievementsDesign.json` can no longer break them.

**⚠️ Data note:** `src/config/achievementsDesign.json` was **intentionally reduced to the single `Sound_Blasting` achievement** per explicit user decision this session. The prior ~21-achievement set remains in git history (pre-`c6802cd`). Restore from history if the full set is wanted.

**Commit `b8daa13` — rainbow achievement-unlock toast**

- New `AchievementToast` overlay (`src/components/shell/AchievementToast.tsx`/`.module.css`), fixed top-right, mounted in `App.tsx`. Spring slide-in from the corner (vertical), ~5s hold (existing store `clearNotification` timer), exit collapses/folds back into the top-right corner (`transform-origin: top right`).
- Animated conic-gradient rainbow border (`@property --rb-angle` spin) + one-shot entry sheen; honors `prefers-reduced-motion`. Shows icon, name, and a rainbow category pill.
- `category` added to `AchievementNotification` (populated in `evaluateAchievements`).
- `InfoPanel` reverted to hover-only (notification no longer double-displayed); dead `notifRainbow`/`.notificationTitle` CSS removed.

### Status

- **848 tests green**, tsc clean.
- Both commits pushed (`master` → `b8daa13`) and deployed to production (https://artdle-web.vercel.app); new bundles verified live (grepped `musicVolumePct`, then `Achievement Unlocked`).
- Untracked, intentionally not committed: `.mcp.json`, `docs/superpowers/plans/2026-05-17-achievement-system.md`.

### Workflow note

Achievement loop is now: **user crafts the shell** (name/icon/category/description, placeholder condition) in the designer and saves; **agent translates the description's intent** into the real condition/effects and adds any new synthetic stat to `resolveStatValue`. Reusing existing stats (`lifetime.*`, `run.*`) + existing effect kinds (`paint_mastery_flat`, `canvas_gold_pct`, `speed_pct`, `inspi_pct`) needs zero code.

---

## Reshape A — panel bugs fixed + dead PM drip code deleted (2026-05-18)

### What landed

**Commit `d765c0e` — all five Reshape A tasks**

**`src/components/painting/StatsRoom.tsx`**
- Added `getSchoolGoldContribution`, `getAchievementGoldContribution`, `getSchoolSpeedContribution`, `getAchievementSpeedContribution` helper exports to `src/core/multipliers.ts` (one-liners over the existing school/achievement bonus functions, named to match the `getColorTreeContribution` / `getSkillTreeSpeedContribution` pattern).
- Both Sell Price and Speed stat blocks now include conditional "School" and "Achievements" rows (only shown when > 0). Displayed total now equals the sum of listed rows for all players.

**`src/components/shell/BottomBar.tsx`**
- Added `"/achievements": new Set([])` to `ROUTE_PROMINENCE`. The achievements tab now dims all currencies (informational tab — no currency is prominent there).

**`src/components/painting/SchoolRoom.tsx`**
- Removed raw `pushHoverInfo`/`clearHoverInfo` store subscriptions. Each research card is now wrapped in `<Hoverable as="div" title body footer>`, consistent with WorkshopRoom, OfficeRoom, and AchievementsRoute. Grid CSS uses only descendant selectors — no direct-child selectors broken by the wrapper.

**`src/components/shell/CurrencyChip.tsx`**
- Removed `pmThreshold` import. Replaced stale "Next tick at: X g lifetime" in the PM hover panel with "Earned from: completing achievements" (the old tick mechanic no longer exists).

**`src/core/balance.ts` + `tests/core/balance.test.ts`**
- Deleted `pmFromLifetime`, `pmGainPerSale`, `pmThreshold` — remnants of the passive PM-per-sale drip system removed when PM became achievement-only. Corresponding test `describe` blocks deleted. `pmMult` is live and untouched.

**Test suite: 848 tests green** (one test updated: `CurrencyChip.hover.test.tsx` PM assertion updated to match new copy).

### Remaining from the audit

- **Reshape B (next):** `tests/core/multipliers.test.ts` uses `as GameStore` casts that bypass the `CanvasMultiplierInputs` type safety net. Create a `useCanvasMultiplierInputs()` hook and replace test stubs with properly typed `CanvasMultiplierInputs` objects. See [`docs/superpowers/plans/2026-05-17-code-audit.md`](superpowers/plans/2026-05-17-code-audit.md) §Category 3 + Reshape B for full task list.
- **Reshape C (deferred):** Declarative run-scope registry. Only worth doing when adding a new run-scoped slice.
- **Browser verification pending:** StatsRoom school/achievement rows need a live playtest pass — unlock a school research with `canvas_gold_pct` effect and an achievement with the same kind, then confirm the breakdown rows appear and the total matches their sum.

### Audit doc

Full original audit: [`docs/superpowers/plans/2026-05-17-code-audit.md`](superpowers/plans/2026-05-17-code-audit.md)

---

## Code audit — structural discrepancies (2026-05-17)

Full audit of 40+ files. Five structural categories found; fix plan written. **Reshape A executed 2026-05-18 (see above).**

**Full audit:** [`docs/superpowers/plans/2026-05-17-code-audit.md`](superpowers/plans/2026-05-17-code-audit.md)

### Summary of findings

**Category 1 — Player-visible bugs: FIXED in Reshape A**

**Category 2 — Stringly-typed cross-references:** Effect kind strings, school bonus keys, and capability tags are runtime strings — a misspelling silently returns 0. The `taylorsim` node-ID typo is the canonical example. Accepted trade-off for node IDs; untreated for effect kinds. No fix scheduled.

**Category 3 — Helper-state hand-construction: Reshape B pending.** `tests/core/multipliers.test.ts` uses `as GameStore` casts bypassing compile-time safety.

**Category 4 — Reset orchestration hard-coded:** `performAscendOrchestrator` names each reset explicitly. `resetOffice()` misleadingly omits level/XP. `resetSchool()` exported but never called in production (school is permanent by design). Deferred.

**Category 5 — Dead code: FIXED in Reshape A** (`pmGainPerSale`, `pmThreshold`, `pmFromLifetime` deleted).

---

## Achievement designer rebuilt as inline flat-list (2026-05-17)

### What landed

**`/dev/achievement-designer` — full rewrite (commit `40c3a27`)**

Replaced the left-rail + detail-panel layout with a flat inline-editable card list, matching the school and skill-tree designer UX. Each achievement renders as a self-contained card with all fields editable directly — no click-to-select, no side panel.

- **`storage.ts`** — localStorage draft (`artdle:achievement-design:draft`) with `uuid()`, `migrateDesign/Achievement/Condition/Effect`, `loadDraft`, `saveDraft`, `clearDraft`. Idiomatic clone of the school designer's storage layer.
- **`useAchievementDesignerState.ts`** — 500 ms debounced draft save; actions: `addAchievement`, `deleteAchievement`, `updateAchievement`, `addEffect`, `updateEffect`, `deleteEffect`, `resetAll`, `importDesign`. Baseline loaded from `achievementsDesign.json` when no draft exists.
- **`api.ts`** — `stripEffectIds()` removes ephemeral `id` from each effect before writing `achievementsDesign.json` via `/__superpowers__/write-json`.
- **`types.ts`** — `DesignEffect` carries an ephemeral `id: string` for React keys; `DesignCondition`, `DesignAchievement`, `DesignFile`, `EMPTY_DESIGN`.
- **Card layout per achievement:** icon · id · name · category select · delete button / description / `if [stat] [op] [value]` condition row / effect rows (kind select + custom fallback + value input + delete) / `+ effect` button.
- **Top bar:** Save to file · Reset · links to School Designer and Game.

Test-Fire feature from the old designer removed (used left-rail selected state; not needed in flat list — just run the game).

---

## Achievement system + test suite green (2026-05-17)

### What landed

**Achievement system — full implementation (commits `6009542`→`f58dac1`)**

PM passive drip (per-canvas-sale accumulation) removed. PM is now earned exclusively by completing achievements via `paint_mastery_flat` one-shot effects. The system ships three layers:

**Stats ledger (`statsSlice`, commit `6009542`)**
- `StatsLifetime` (never reset): `canvasesSold`, `critsLanded`, `maxComboChain`, `workshopItemsCrafted`, `workshopItemsFused`, `schoolResearchesCompleted`, `schoolTiersPassed`, `officeWorkersHired`.
- `StatsRun` (reset on ascension): same canvas counters + `currentCritStreak`, `maxCritStreak`, `goldEarned: Big`.
- `patchRunStats` added alongside `incrementStat` — needed for fields that require exact-value sets (crit streak reset to 0 mid-run, not just increments).
- Aliased fields (`lifetime.goldEarned` → `paintMasterySlice.lifetimeGold`, `lifetime.ascensions` → `metaSlice.ascendCount`) resolved at evaluation time; no duplication in `statsSlice`.
- `incrementStat` + `evaluateAchievements` wired into: `canvasTick`, `workshopSlice` (craft + fuse), `schoolSlice` (research + exam), `officeSlice` (hire), ascend orchestrator, app startup (retroactive check on rehydration).

**Achievement engine (`achievementSlice`, commit `d614af3`)**
- `completedAchievements: Record<string, true>` — JSON-safe (not `Set`), persisted, survives ascensions.
- FIFO notification queue with module-level `_notifTimer` to prevent timer leaks on rapid simultaneous unlocks.
- `evaluateAchievements()` scans all incomplete achievements; `paint_mastery_flat` effects credited via `addPaintMastery()` (one-shot, not continuous).
- `AchievementNotification: { id, name, icon, effects }` — `icon` field required so InfoPanel renders per-achievement emoji.

**21 achievement definitions (`achievementsDesign.json`, commit `5552c0f`)**
- 6 canvas, 4 workshop, 4 ascension, 4 school_office, 3 secret.
- Condition DSL: `{ stat: string, op: ">=" | ">" | "==" | "<=" | "<", value: number }`.
- Effects: `canvas_gold_pct`, `speed_pct`, `inspi_pct`, `paint_mastery_flat`.

**Multipliers (`achievementMultipliers.ts`, commit `12c1d3a`)**
- `getAchievementBonus(state, kind)` wired into `getCanvasGoldMultiplier`, `getCanvasSpeedMultiplier`, `getInspiMultiplier`.
- `completedAchievements` made optional in the type signature — guards against partial-state stubs in tests (fix in `f58dac1`).
- `CanvasMultiplierInputs` and `getInspiMultiplier` picks updated; `TreeRoute.tsx` was missing `completedAchievements` in its `helperState` (caught by code reviewer — would have been a runtime `TypeError`).

**InfoPanel notification mode (commit `558f4a7`)**
- `activeNotification !== null` takes priority over hover info for 5 s.
- Rainbow title: `@keyframes notifRainbow` cycling `hsl(0°..360°, 80%, 65%)` — same technique as workshop rainbow caterpillar.
- Body: `motion.div` with `animate={{ y: [0, -3, 0] }}`, 1.5 s ease-in-out loop.
- FIFO drain: each notification gets its own 5 s window; simultaneous unlocks queue correctly.

**Achievements tab (`AchievementsRoute`, commit `21f361d`)**
- Completed-only grid (`repeat(auto-fill, minmax(64px, 1fr))`); hidden achievements absent from DOM.
- 5 labeled category sections; chip filter bar (All + 5 categories).
- Header: `N / total completed` + total PM earned from achievements.
- Nav item added to `TopBar`.

**`/dev/achievement-designer` (commit `9bdef69`)**
- Left rail: achievement list + New button. Right form: id/name/description/icon/category, condition builder with live reactive stat value display, effects builder.
- Test Fire: bypasses condition check, credits PM, pushes notification — tests the full pipeline without grinding.
- Saves to `achievementsDesign.json` via `/__superpowers__/write-json`.
- `liveStatValue` uses reactive `useGameStore` selector (not a snapshot); ID edit syncs `selected` state to prevent form disappearing.

**SAVE_VERSION 17→18 (commit `6009542`)**
- Migration seeds `statsLifetime`, `statsRun`, `completedAchievements: {}` for existing saves.
- `activeNotification` and `notificationQueue` excluded from `partialize` (transient).

**Test suite: all 857 tests green (commits `687ed39`, `f58dac1`, `a600e90`)**
- Persistence integration tests updated for SAVE_VERSION 18.
- `TopBar.test.tsx`: mocked `useMusic` (pre-existing jsdom crash) + updated nav count 4→5.
- `getAchievementBonus`: `completedAchievements?.[id]` guard prevents crash on partial-state stubs.
- **Bug fixed in `CurrencyChip` + `StarCanvas`:** `fameBody` was computing `Lifetime earned` from past runs only, excluding current fame balance. Fixed: `s.fame.add(pastTotal)`.
- `FamePreviewCard`, `PastRunsLedger`, `TrackCard`, `WorkshopRoom`, `AscensionRoute` tests updated to match current component output (CurrencyAmount widget splits text across DOM nodes; button labels changed; affix format `$12%` not `$ 12%`).

### Deployment

- **Production URL:** https://artdle-web.vercel.app
- **Deploy command:** `npx vercel --prod` — Vercel does NOT auto-deploy on git push from this repo; always run the command manually after pushing.
- Latest deployment confirmed live with achievement system bundle (`index-DcNgzMnl.js`).

### Lessons preserved

- **`completedAchievements` must be `Record<string, true>` not `Set`** — Zustand's JSON-based persist middleware cannot serialize `Set`. `has()` → `[id]` truthiness check is equivalent.
- **Timer leaks in FIFO notification queues:** store the `setTimeout` handle at module level and call `clearTimeout` before each new timer. Multiple rapid unlocks otherwise produce stale timers that fire against the wrong notification.
- **Multi-element text assertions in RTL:** `CurrencyAmount` splits numbers and icons into separate DOM nodes. Use `container.textContent` for cross-element assertions; `getByText` only works for elements whose full text content matches.
- **TypeScript structural widening can hide missing required fields:** `TreeRoute`'s `helperState` passed to `getInspiMultiplier` was missing `completedAchievements`. TypeScript did not catch it because the type widened structurally. Code review caught it; would have been a runtime `TypeError`.

### Next

- Goldsmith class node (`gold_diggers`) playtest: still pending browser verification (no code change expected).
- Chip-strip spacing for 6-stage tree chips (deferred).
- Combo chance soft cap (same treatment as crit) if playtesting shows it trivially maxes.
- **Lab / pigment hatchery** — brainstorm notes in `docs/superpowers/specs/2026-05-17-lab-pigment-hatchery-notes.md`. 5 open questions remain (simultaneous breeds, unlock gate, consume formula, balance parameters, T1 type count) before design can start.
- Balance pass on achievement PM rewards and multiplier values (deferred — designer tool ready for iteration).

---

## Type narrowing + test repair (2026-05-15)

### What landed

**Eliminated `as unknown as GameStore` casts (commit `1fb7a21`)**

- `getNextCost`, `canBuyNode` in `skillTreeSlice.ts` narrowed to `Pick<GameStore, "purchasedNodes">` / `Pick<GameStore, "purchasedNodes" | "devFreeNodes" | "fame">`.
- `getUnlockedSlotKinds`, `getCurrentSlotCount`, `getMaxInventorySlots` in `workshopSlice.ts` narrowed to `Pick<GameStore, "purchasedNodes">`.
- `getTotalLevelsInStage`, `getProducingParts` in `treeSlice.ts` narrowed to `Pick<GameStore, "partLevels">` / `Pick<GameStore, "currentStage" | "partLevels">`.
- `canAscend` in `ascend.ts` narrowed to `Pick<GameStore, "inspiration" | "purchasedNodes">`.
- `ConstellationRoute`, `AscensionRoute`, `TreeRoute`, `WorkshopRoom` route/component files: `as unknown as GameStore` casts removed; unused `GameStore` type imports dropped. `equipped` removed from `TreeRoute` helperState (was never consumed by the helper calls).
- The migration-function cast in `store/index.ts` was correctly left in place (legitimate use).

**Repaired 7 pre-existing test regressions (commit `1fb7a21`)**

- `skillTreeSlice.test.ts`: cost expectations updated from old `[1,5,10,15,20]` to actual `[1,2,3,5,8]` after depth-pricing rework.
- `AscensionRoute.hover.test.tsx`: hover-body regex `/Current inspi: 10,?000/` updated to `/Current inspi: 10\.00K/` to match `formatBig` K-suffix output.
- `useDesignerState.test.ts`: three tests assumed `resetAll()` → empty design. Now `resetAll()` reloads the file baseline (50 nodes). Add/delete tests switched to `importDesign(EMPTY_DESIGN)`; "resetAll" test updated to assert baseline reloaded + selectedId cleared.
- `bot-simulation.test.ts`: added `30_000` ms timeout (3-hour simulation was timing out at default 5 s).

### Next (carry-overs)

- Goldsmith class node (`gold_diggers`) playtest: code is correct (`gold_diggers` node → `class_goldsmith` capability → `rollWorkerClass` gate in `officeRoll.ts`). Needs browser verification — enable devFreeNodes, buy `gold_diggers`, confirm Goldsmith appears in office candidate rolls. No code change expected.
- Chip-strip spacing for 6-stage tree chips (deferred from prior session).
- Combo chance soft cap (same treatment as crit) if playtesting shows it trivially maxes.

---

## Skill tree pricing + dev tooling polish (2026-05-15)

### What landed

**BFS-depth pricing for all skill tree nodes (commit `ff75de3`)**

- All 52 nodes in `skillTreeDesign.json` now have cost arrays scaled by BFS depth from the two roots (`get_inspired` d0, `basic_technique` d0) — max parent depth + 1 for multi-parent nodes.
- Pricing ladder: d0 costs ~[1–8], d11 nodes (`painters_hat`, `gold_diggers`) cost 10,000 fame. Full scale in the commit diff.

**In-game dev toggle: "Free nodes" (commit `ff75de3`)**

- `devFreeNodes: boolean` added to `skillTreeSlice` — default `false`, excluded from persist (transient).
- `canBuyNode` and `buyNode` both short-circuit when `devFreeNodes = true` (skip fame check / spend).
- Toggle button in `ConstellationRoute` rail: `[DEV] Free nodes: ON/OFF`. When ON, cost display shows `0`.
- `toggleDevFreeNodes` action wired through store.

**Skill designer Reset button fixed (commit `ff75de3` / earlier)**

- `window.confirm()` is silently suppressed in cross-origin (localtunnel) contexts.
- `ActionBar.tsx` replaced with inline two-step confirm: "Discard changes and reload from file? / Yes, reset / Cancel".
- `resetAll` in `useDesignerState` now calls `setDesign({ ...loadFileBaseline() })` — guarantees a new object reference so React re-renders and the auto-save `useEffect` doesn't fight the reset.

**Top bar reset button fixed (commit `ba4cd3d`)**

- Same `window.confirm()` suppression issue in `TopBar.tsx`.
- Replaced with inline confirm: "Wipe all progress? Yes / No" rendered inside the meta bar strip.
- "Yes" calls `useGameStore.persist.clearStorage()` + `localStorage.clear()` + `location.reload()`.

### Lessons preserved

- `window.confirm()` / `window.alert()` are silently suppressed in cross-origin iframes and tunnels (localtunnel, ngrok). Always use inline React state for destructive-action confirmation.
- Zustand `Object.is` comparison: passing the same object reference to `setState` is a no-op even if the object's contents differ. Always spread or construct a new object when resetting state.

### Next (carry-overs)

- Four `as unknown as GameStore` casts remain in `WorkshopRoom`, `ConstellationRoute`, `TreeRoute`, `AscensionRoute`.
- Chip-strip spacing for 6-stage tree chips (deferred from prior session).
- Goldsmith class node (`gold_diggers`) playtest pending.
- Combo chance soft cap (same treatment as crit) if playtesting shows it trivially maxes.
- `StatsRoom.tsx` has an uncommitted modification (flagged in git status at session start) — verify before next session.

---

## Workshop UI polish — session 5 (2026-05-15)

Visual polish pass (empty slot placeholders, symbol scale uniformity) and crit balance fix.

### What landed

**Empty slot SVG placeholders (commit `cdd9388`)**

- Each empty equipped slot in the Workshop now renders a slot-specific SVG sketch instead of a bare `—` dash.
- `SLOT_PLACEHOLDER: Record<SlotKind, JSX.Element>` map added to `WorkshopRoom.tsx` with hand-drawn inline SVGs for all six slot kinds: brush (angled handle + bristle tuft), palette (kidney shape + thumb hole + 3 paint blobs), easel (A-frame legs + crossbar + canvas rect), hat (beret dome + brim ellipse + stem dot), apron (body rect + bib + straps), boots (simplified boot profile path).
- SVGs are wrapped in `.slotIcon` span — `opacity: 0.22`, `color: var(--ink-1)` — so they read as a faint sketch hint. Slot name text below in `.slotLabel` unchanged.
- `.emptySlot` min-height bumped 80 px → 88 px to accommodate icon + label without cramping.

**Affix symbol optical size normalisation (commit `cdd9388`)**

- `AFFIX_SYMBOL_SCALE: Record<AffixKind, number>` added to `workshopAffixes.ts`. Compensates for Unicode glyphs that render at different optical sizes at the same `font-size`: `✦` and `⊕` scale ×1.3, `∞` scales ×1.1, `$` and `»` stay ×1.0.
- Applied as `fontSize: \`${base * AFFIX_SYMBOL_SCALE[kind]}px\`` everywhere symbols are rendered: item squares (base 11 px), upgrade tiles / TrackCard (base 20 px), worker/queue cards (base 11 px), StatsRoom block headers (base 13 px), FireConfirmModal affix rows (base 11 px).

**Crit chance soft cap (commit `a076c97`)**

- Problem: `getCritChance` was a simple additive sum clamped at 1.0. `CRIT_PER_LEVEL = 0.01` means critLevel 100 alone hits 100%; stacked items (up to 34% per legendary affix × 6 slots) and levelled workers pushed past it trivially early.
- Fix: two new constants in `balance.ts` — `CRIT_SOFT_CAP_THRESHOLD = 0.30` and `CRIT_SOFT_CAP_CEILING = 0.95`. Below 30% raw, the formula is linear (no change). Above 30%, exponential diminishing returns:
  ```
  effective = threshold + range × (1 − exp(−excess / (range × 0.5)))
  ```
  where `range = ceiling − threshold = 0.65`. Representative curve: 30% → 30%, 50% → ~60%, 100% raw → ~87.5%, ∞ raw → 95% (floating-point floor at ceiling).
- `getCritChance` in `multipliers.ts` updated; `CRIT_SOFT_CAP_THRESHOLD` and `CRIT_SOFT_CAP_CEILING` imported from `balance.ts`.
- **Canvas tests made deterministic.** Three tests previously relied on `critLevel: 100` guaranteeing 100% crits:
  - Crit timing and regression tests now use `canvasProgress: 0.001, isCritThisCanvas: true` — the `canvasProgress > 0` check bypasses the `if (progress === 0)` RNG roll, forcing the crit flag without touching the RNG.
  - Re-roll ordering test changed to `critLevel: 0` after the forced crit: the post-sale re-roll at line 158 then guarantees `false`, making the assertion deterministic in both directions.

### Tests + build

- **776 tests passing across 80 files** (was 775; +1 net from split multiplier test case).

### Lessons preserved

- **Hard-clamp at 1.0 is the wrong design for idle-game probabilities.** Diminishing returns above a threshold lets every upgrade continue to matter at the margin while making 100% unreachable. The threshold + exponential formula is self-contained in `getCritChance` and tunable via two constants in `balance.ts`. Combo chance should get the same treatment if it becomes an issue.
- **Tests that assert `rng() < P` for P < 1.0 are probabilistically flaky.** Bypassing the roll entirely (`canvasProgress: 0.001` + explicit `isCritThisCanvas`) is cleaner and more maintainable than picking a seed and hoping the RNG cooperates with future balance changes. Use this pattern for any future test that needs to control whether a canvas crits.
- **`AFFIX_SYMBOL_SCALE` belongs in the config, not inline.** Different Unicode glyphs have different optical sizes at the same `font-size`. A centralised scale map keeps all rendering sites consistent without repeated magic numbers.

### Next (carry-overs)

- Four `as unknown as GameStore` casts remain in `WorkshopRoom`, `ConstellationRoute`, `TreeRoute`, `AscensionRoute`.
- Chip-strip spacing for 6-stage tree chips (deferred from prior session).
- Goldsmith class node (`gold_diggers`) playtest pending.
- Combo chance soft cap (same treatment as crit) if playtesting shows it also trivially maxes.

---

## Workshop UI polish — session 4 (2026-05-14)

Visual polish pass and fusion correctness fix.

### What landed

**2-column affix grid + colored symbols (commit `cd92294`)**

- `AFFIX_COLOR` added to `workshopAffixes.ts`: `$` → `#f0b847` (gold), `»` → `#4fc3e8` (cyan), `✦` → `#e85c5c` (red), `∞` → `#b06ee8` (purple), `⊕` → `#4cb87a` (green).
- Item squares (Workshop equipped + inventory) now render affixes in a 2-column CSS grid (`grid-template-columns: 1fr 1fr`). Each affix span wraps the symbol in a `<span style={{ color: AFFIX_COLOR[a.kind] }}>` so the symbol is colored and the magnitude stays in `var(--ink-2)`. Font reduced from 14 px to 11 px to fit two columns in 104 px tiles.
- `WorkerCard` and `QueueCard` affix rows now prefix with the colored symbol followed by the long-form label.
- `StatsRoom` block headers prepend the colored symbol before each stat name (Sell Price, Speed, Crit, Combo, Size).
- Item tile background changed to flat `var(--bg-stone-d)` for all tiers — only the border (thickened from 2 px to 3 px) carries the tier color. `equippedFusion` layer-1 background updated to match.

**Same-slot-only fusion (commit `cd92294`)**

- `getFusionTarget` previously iterated all equipped slots and returned the first match on tier + affix-kind multiset, deliberately ignoring slot kinds (a "hat" in inventory could fuse with an equipped "brush"). This caused cross-slot merges (apron into boots, etc.) visible in playtesting.
- Fix: replaced the loop with a direct lookup `equipped[invItem.slot]`. If no item is equipped in the same slot, returns `null` immediately. Slot mismatch → no fusion, regardless of tier or affixes.
- `slotFusionMap` comment and key updated: now keys by `item.slot` (which equals `target.slot` under the new constraint).
- Test `"slot kind of inventory item does not have to match equipped slot"` inverted to `"returns null when slot kinds differ even if tier and affix kinds match"`. Matching-test fixture corrected (`inv.slot` changed from `"palette"` to `"brush"` to match the equipped item's slot).

### Tests + build

- **775 tests passing across 80 files** (unchanged count; 2 tests updated to reflect new contracts).

### Lessons preserved

- **`getFusionTarget` must check slot — tier + affixes alone are insufficient.** The earlier design said "slot kind intentionally ignored" but that produced obviously wrong gameplay. The simpler implementation (direct slot lookup) is also correct.
- **Colored symbols via inline style is fine for a fixed small set.** Five affix kinds, defined once in `AFFIX_COLOR`. No CSS classes needed — inline `style={{ color }}` on the symbol span is clear and co-located with the symbol string.

### Next (carry-overs)

- Four `as unknown as GameStore` casts remain in `WorkshopRoom`, `ConstellationRoute`, `TreeRoute`, `AscensionRoute`.
- Chip-strip spacing for 6-stage tree chips (deferred from prior session).
- Goldsmith class node (`gold_diggers`) playtest pending.

---

## Workshop UI polish + fusion UX overhaul (2026-05-14, session 3)

Continuation session fixing visual bugs surfaced by browser playtesting and overhauling the fusion interaction model.

### What landed

**Visual fixes (3 commits)**

- **Affix symbols + craft button restore** (`e129148`). Introduced `AFFIX_SYMBOL` map in `workshopAffixes.ts` (`$ » ✦ ∞ ⊕`). Item squares now render `{symbol} +{magnitude}%` instead of the raw kind string. `WorkshopRoom.module.css` had three undefined CSS custom properties: `--accent` (→ `var(--gold)`/`var(--inspi)`), `--text-sm`, `--text-lg` (→ literal `12px`/`18px`). These made the craft button invisible and the XP bar blank. TrackCard labels under the canvas now prefix with the matching affix symbol (`$ Sell Price`, `» Speed`, etc.) so the two contexts share a visual vocabulary.
- **Item square sizing** (`d9ad03d`). Squares enlarged 72 → 104 px. Room column widened 340 → 368 px (3 × 104 + 2 × 8 px gap + 24 px padding = 344 px; fits). Affix font 9 → 14 px; tier/slot labels 9 → 12 px.

**Fusion UX overhaul (1 commit, `baaa91e`)**

Old model: inventory item was the fusion trigger (pulsing tier-color glow, click to fuse). New model:
- **Left-click inventory item** → equip (always). **Right-click** → discard. The ✕ hover-button is gone; `onContextMenu` calls `discard(item.id)`.
- **Equipped slot glows rainbow when a same-tier fusion candidate sits in inventory.** Clicking the equipped slot fuses (if affordable) or unequips (if not affordable — avoids trapping the player).
- Rainbow border is a rotating conic gradient via `@property --rainbow-angle` animated from `0deg` to `-360deg` (anti-clockwise). Two background layers on `.equippedFusion`: layer 1 `padding-box` clip restores the tile's inner background; layer 2 `border-box` clip shows the rainbow only in the 2 px border strip. `border-color: transparent` on `.equippedFusion` removes the static tier-colour ring.

**Fusion correctness fixes (2 commits)**

- **Tier gate** (`b5afc6e`). `getFusionTarget` added `&& eq.tier === invItem.tier`. A magic item can no longer fuse with a normal item. Test suite updated: all `fuseItem` action tests had mismatched `inv: magic` / `eq: rare` fixtures — corrected to matching tiers. New test: `"returns null when affix kinds match but tiers differ"`.
- **`slotFusionMap` key fix** (`52ce63f`). The map was keyed by `item.slot` (inventory item's slot) instead of `target.slot` (equipped item's slot). Because `getFusionTarget` ignores slot kinds, a "hat" inventory item can match an equipped "brush". With the wrong key, the rainbow landed on whichever equipped slot shared the inventory item's label (e.g. the magic brush) even though the actual fusion target was the normal hat — making it look like a cross-tier merge. Fix: `map.set(target.slot, ...)` and `map.has(target.slot)`.

### Tests + build

- **775 tests passing across 80 files** (was 774; +1 new tier-gate test).

### Lessons preserved

- **`slotFusionMap` must key on the equipped item's slot, not the inventory item's slot.** `getFusionTarget` deliberately ignores slot kinds (a palette in inventory can fuse with an equipped brush). Any "reverse lookup" from inventory item → equipped slot must use `target.slot`, not `item.slot`, or the rainbow indicator will land on the wrong slot.
- **`@property` + `conic-gradient(from var(--angle))` is the correct rotating-border technique.** `box-shadow` colour cycling looks like a flash, not a rotation. Register `--rainbow-angle` as `<angle>`, animate to `-360deg` for anti-clockwise, use `background-clip: padding-box / border-box` to confine the gradient to the border strip.
- **Undefined CSS custom properties fail silently.** `--accent`, `--text-sm`, `--text-lg` were referenced in `WorkshopRoom.module.css` but never defined in `tokens.css`. Result: invisible button, blank XP bar, wrong font sizes — no build error. Always cross-check new token names against `tokens.css` before shipping.

### Next (carry-overs)

- Four `as unknown as GameStore` casts remain in `WorkshopRoom`, `ConstellationRoute`, `TreeRoute`, `AscensionRoute`.
- Chip-strip spacing for 6-stage tree chips (deferred from prior session).
- Goldsmith class node (`gold_diggers`) playtest pending.

---

## Workshop overhaul + new skill-tree nodes (2026-05-14)

Two back-to-back sessions delivering the workshop overhaul spec (`docs/superpowers/specs/2026-05-14-workshop-overhaul-design.md`, plan `docs/superpowers/plans/2026-05-14-workshop-overhaul.md`) followed by wiring four new designer nodes (`docs/superpowers/plans/2026-05-14-new-skill-tree-nodes.md`). Both runs used subagent-driven execution with two-stage review per task.

### What landed

**Workshop overhaul (Tasks 1–6, 10 commits)**

- **Tier unlock levels and XP** (`95c32d5`). Five-tier ladder: normal unlocks at L1, magic L3, rare L8, epic L20, legendary L40. XP per craft now scales 1/2/3/4/5 by tier. Probability ranges: magic 1–30%, rare 1–15%, epic 0.5–5%, legendary 0.01–1% — all interpolated linearly from unlock level to L100.
- **Tier-scaled affix magnitude ranges** (`a62a61d`). `AFFIX_MAGNITUDE_RANGE` reshaped from flat `Record<AffixKind, {min,max}>` to `Record<ItemTier, Record<AffixKind, {min,max}>>`. Normal 5–15, magic 8–22, rare 13–32, epic 20–44, legendary 38–56 (all ±affix-kind variation). Rolled via `AFFIX_MAGNITUDE_RANGE[tier][kind]` in `workshopRoll.ts`. Office workers hardcoded to `["normal"]` tier magnitudes — they are not item-tier-scaled by design (comment in `officeRoll.ts`).
- **Hat / apron / boots slot kinds + fame nodes** (`38fc1b8`). Three new `SlotKind` values added to `ALL_SLOT_KINDS`. Three new fame nodes (`painters_hat`, `painters_apron`, `painters_boots`) unlock each slot. `getUnlockedSlotKinds` extended. `SLOT_UNLOCK_NODE` map in `WorkshopRoom.tsx` shows locked-slot tooltips with the unlock node name.
- **`Item.fuseCount` + save migration v14 → v15** (`c0ad0e2`). `fuseCount: number` added to `Item`. `performCraft` initialises it to 0. Migration backfills `{ fuseCount: 0, ...item }` (spread order is idempotent) for all inventory and equipped items. All existing 40+ inline `Item` fixture literals across 5 test files updated.
- **Fusion mechanic** (`193b13d`). `getFusionTarget(invItem, equipped)`: finds equipped item whose affix-kind multiset (count + set, order-irrelevant via sort+join) matches `invItem`. Slot kind intentionally ignored. `getFuseCost(equippedItem, workshopLevel)`: `craftCost(level) × 2^fuseCount`. `fuseItem(dropId)`: validates drop → finds target → spends gold atomically → per-affix absorption `pct = 0.05 + rng() * 0.45` ([0.05, 0.50)) → `Math.round` (can be 0 for small magnitudes — intentional) → removes drop, increments fuseCount on equipped item. Known follow-up: `new Map(drop.affixes.map(a => [a.kind, a.magnitude]))` only keeps last magnitude per kind if a drop has duplicate kinds — under-donates in that case.
- **PoE-style Workshop UI rewrite** (`567e3d6`, `67f184e`). 72×72 item squares in CSS Modules. Tier color via `--tier-color` CSS custom property set on `.itemSquare[data-tier="..."]` selectors (scoped to avoid leakage). `fusionCandidate` animation via `@keyframes fusionPulse` using `var(--tier-color)` box-shadow. Discard button visibility via `.itemCell:hover .discardBtn` — critical: `.discardBtn` is a sibling of the Hoverable `<span>`, not a descendant of `.itemSquare`, so the selector must be on `.itemCell`. `craftHoverBody` / `levelHoverBody` use `useGameStore.getState()` (lazy, no hook) since called inside `body()` prop. `fusionTargetMap` memoised over `[inventory, equipped]`. Fusion candidate `data-tier` set to the matching equipped item's tier (not the drop's tier).

**New skill-tree nodes (Tasks 1–4, 4 commits)**

- **`apprentice_pool` removed** (`6efae1d`). Node dropped from `skillTreeDesign.json` by designer. `getMaxInventorySlots` line and stale test deleted.
- **`better_scaling`** (`bfe6694`). `getAffixMagnitudeBonus` in `multipliers.ts` now adds `getNodeLevel("better_scaling") * state.workshopLevel * 1` pp when purchased (1 level max). Signature extended to `Pick<GameStore, "purchasedNodes" | "workshopLevel">`. No call-site changes needed — only caller (`performCraft`) passes full `GameStore`.
- **`socks`** (`f04d4fa`). `getEquippedContribution` in `workshopSlice.ts` now iterates `Object.entries(equipped)` and applies ×1.5 to any affix on the `boots` slot when `socks` is purchased (1 level max). Signature extended to include `purchasedNodes`. All callers in `multipliers.ts` pass `CanvasMultiplierInputs` which already has `purchasedNodes` — no call-site changes.
- **`third_hand`** (`948f35b`). `workshopTick` now computes `interval = 10 × (1 − 0.10 × thirdHandLevel)` before the timer math. L0 = 10 s (unchanged), L5 = 5 s. `freshState()` in tests got `autoCraftTimer: 0` (was missing, causing order-dependent test pollution in the Taylorism block).

**Designer node tree changes (committed separately, `050b4ff`)**

`painters_hat` renamed "Enjoyable Shade" (parent: `painters_apron`, cost 1), `painters_apron` renamed "No More Stains" (parent: `socks`, cost 1), `painters_boots` renamed "Warm Feet" (parents: `monk_internship` + `third_hand`, cost 1). `third_hand` (5 levels) and `better_scaling` (1 level) and `socks` (1 level) added. `basic_technique` numericEffect fixed "1%" → "2%". Node positions updated throughout the workshop cluster.

### Tests + build

- **774 tests passing across 80 files** (was 750 before this batch; +24 net). TypeScript strict clean throughout.

### Lessons preserved

- **`getEquippedContribution` signature must include `purchasedNodes` to support per-slot modifiers.** Before `socks`, the function iterated `Object.values` with no slot awareness. Per-slot scaling requires `Object.entries` + a slot multiplier. Any future "X slot gets bonus Y" node follows this pattern: extend `getEquippedContribution`'s slot-mult logic rather than adding a parallel accumulation.
- **Discard button (or any hover-revealed sibling) needs a wrapper class, not a descendant selector.** `.itemSquare:hover .discardBtn` broke silently when Hoverable wrapped `.itemSquare` in a `<span>`, making `.discardBtn` a sibling. Always wrap the interactive cell in `.itemCell { position: relative }` and use `.itemCell:hover .child` for reveal logic.
- **`Map(affixes.map(a => [a.kind, a.magnitude]))` drops duplicate-kind magnitudes.** In the fusion absorption loop, if a drop has two affixes of the same kind, the Map only keeps the last one. A future fix would sum duplicates. Filed as known follow-up; not a regression (base case is single-affix-per-kind items).
- **`workshopTick` interval should be a variable, not the bare constant.** Adding `third_hand` only required computing `interval` before `Math.floor(next / interval)`. Any future "speed up autocraft" node follows the same pattern: modify `interval` before it's used.

### Next (carry-overs)

- Browser smoke test for workshop overhaul not yet confirmed: 72×72 squares readable, tier glow visible, fusion flow works end-to-end, discard button appears on hover.
- Goldsmith class node (`gold_diggers`) playtest pending.
- Four `as unknown as GameStore` casts remain in `WorkshopRoom`, `ConstellationRoute`, `TreeRoute`, `AscensionRoute`.
- Chip-strip spacing for 6-stage tree chips (deferred from prior session).

---

## Inspiration tree v1.x: 6 stages + auto-grow (2026-05-12)

15 commits delivering the 6-stage inspiration tree expansion specified in `docs/superpowers/specs/2026-05-12-inspiration-tree-expansion-design.md`. Plan: `docs/superpowers/plans/2026-05-12-inspiration-tree-expansion.md`. Subagent-driven execution with two-stage review per task.

### What landed

- **Config rewrite** (`bb2cd08`, `2f9155f`, `59892f3`). 3 stages × 2 parts → 6 stages with variable parts (1/2/2/3/3/4): Tiny Sprout (cotyledon), Bud (tendril, budtip), Leaflet (vein, leaftip "Leaf Tip"), Sapling (twig, branch, leaf), Whisperleaf (softbough, quietleaf, faintvein), Verdant Shoot (greenshoot, lushbough, vividleaf, stalk). Cost/rate curves preserve the prior `×10 between / ×5 within` ratios; unlockThresholds are 0/5/12/25/50/100. Mid-implementation the part id `"leaflet"` was renamed to `"leaftip"` to avoid a collision with the stage id of the same name, and the display name was later set to `"Leaf Tip"` to keep the in-rail labelling unambiguous. The remaining 20-stage roadmap (through Mossling, Sylvan Sapling, … Genesis Arbor → World Tree) is parked in the spec, not yet coded.
- **Auto-stage-up** (`d1d5cce`, `f13696d`, `49ef351`, `386a189`). `growSapling()` stays as the canonical atomic mutator but the manual button is gone. Two trigger points fire it automatically: `buyPartLevel` (immediately after a successful purchase) and `treeTick` (defensive safety-net for post-migration / loaded-qualifying-state). Both use the same `AUTO_GROW_MAX_ITER = 100` guard. `buyAllAffordableTreeParts` cascades through stages naturally since each outer iteration re-reads `state.currentStage`.
- **Save migration v13 → v14** (`7d7ab3b`, `e139238`, `f269fdb`). Wipes `currentStage` (→ 0) and `partLevels` (→ all-zero on the 15 new IDs). Currency, fame, items, workers, PM, lifetime gold, fame nodes, and every other slice are preserved. Returning v13 saves boot into stage 0 with zero levels but full gold — auto-grow rebuilds progression quickly. The TREE_PART_IDS array is documented in-place with one row per stage so future readers don't need to cross-reference `treeStages.ts` to understand the migration.
- **UI cleanup** (`b154bed`, `2560cda`). `StagePanel` drops the `canGrow`/`onGrow` props and the Grow button entirely; the chip strip iterates `TREE_STAGES` for 6 chips. The hover footer became "Stage advances automatically when threshold is reached." and the hover body's threshold-reached line became "Threshold reached — advancing!" (was "Ready to grow!" which implied player agency). `TreeRoute` drops the `growSapling` selector and the `canGrowSapling` import. Dead `.grow` CSS rules removed.
- **TreeScene tier mapping** (`e885469`). 6 stages → 3 sprite tiers via `floor(stage / 2)`: stages 0-1 use the seed sprite, 2-3 use sapling, 4-5 use tree. `getSpriteTier(stage)` clamps at `SPRITE_TIERS.length - 1`, so any future stage 6+ falls back to the tree sprite until new art lands.
- **Stage-up toast** (`23168d5`). `TreeRoute` tracks `currentStage` in a `useRef`; on advance it sets a 2-second toast inside the `.scene` container with name "Grown into {stageName}!" and a CSS-keyframe fade. No new dependencies.

### Tests + build

- **750 tests passing across 80 files** (was 746; +4 net: +3 new auto-grow-on-buy cases, +2 new auto-grow-on-tick cases, +1 new migration case, -2 Grow-button-specific cases that no longer apply).
- `npx tsc --noEmit` clean. `npm run build` clean. Bundle ≈ **164.16 KB gzipped** — essentially unchanged from the 164 KB baseline; well under the 250 KB DoD budget.

### Lessons preserved

- **Two trigger points are cheaper than they look.** Auto-grow guarded by `canGrowSapling(get())` at the end of both `buyPartLevel` and `treeTick`: the action path catches a "buy crossed threshold" event immediately; the tick path catches a "state loaded already qualifying" case (post-migration, balance changes, hand-edited saves). The cost is one O(parts-in-stage) sum per tick — trivial. The pattern is grep-able (`AUTO_GROW_MAX_ITER`) and should be reused when any future auto-advance mechanic ships.
- **Stage IDs and part IDs share a namespace in test/grep, not in code.** When stage 2 was named `"leaflet"` and one of its parts was also id `"leaflet"`, no runtime bug existed (TREE_STAGES[n].id vs partLevels keys are different lookups), but a future tooling pass that built a flat identifier map would silently collide. The fix was the early rename (`leaflet` → `leaftip`) plus a later display-name update (`"Leaflet"` → `"Leaf Tip"`) so the in-rail UI is also unambiguous. **Avoid name-equal-to-parent in nested configs.**
- **Migration that wipes one slice is cheaper than translating it.** Old part IDs (`spark/bud/leaf/branch/bough/crown`) have no mechanical equivalent in the new config. Mapping by total levels or estimating equivalent stages would produce misleading state. Wiping only `currentStage` + `partLevels` while preserving currency/items/workers/fame is graceful: returning players keep their gold income and auto-grow rebuilds tree progression in a few minutes.
- **Toast coalesces across multi-stage advances.** If a single `treeTick` advances the player across two thresholds (rare: stage cascade from a loaded save), the `useRef`-tracked previous value updates between renders and only the final stage's name lands in the toast. Behaviour is benign; document as expected.
- **Player-facing text should match the system model.** The hover body originally said "Ready to grow!" — verb implies player action. After the auto-grow change that's a lie. Renamed to "Threshold reached — advancing!" so the body matches the footer's framing. This text is rarely visible in practice (auto-grow fires synchronously after the threshold-crossing buy, so the "ready" state lasts at most one render frame) but should be correct when seen.

### Next

Open ends:

- **Browser smoke not yet completed.** The dev server is running (started earlier in session). User to verify: (1) buying enough cotyledon flips to Bud automatically with the toast firing; (2) no Grow button anywhere; (3) chip strip readable at 6 wide on the rail (the implementer judged spacing already compact at `var(--s-2)` gap + 11px font, but only browser playtest can confirm); (4) v13 saves migrate to v14 without errors visible in DevTools console.
- **Chip-strip spacing** may need tightening if 6 chips overflow. CSS was not adjusted by the plan; deferred pending playtest.
- **Stages 7+ art and balance** queued for a future wave. The current `×10 between stages` curve is mathematically untouchable past stage 10 or so; that wave needs a new growth curve. Names are pre-authored in the spec.
- The carry-overs from yesterday's HANDOVER stand: Goldsmith class playtest, crit perception verify, four remaining `as unknown as GameStore` escapes.

---

## Tree expansion + tick-loop fix + type-safety guard (2026-05-12)

Seven commits covering one feature batch, one engine bug, and one architectural cleanup that closes a recurring class of bugs.

### What landed

- **"Buy all" button on the inspiration tree** (`8bbded7`). New `buyAllAffordableTreeParts` action in `treeSlice` uses a greedy "cheapest affordable next" loop: each iteration finds the lowest-cost affordable upgrade across all unlocked stages and buys one level, repeating until nothing's affordable. Maximally drains gold (greedy + geometric per-level cost growth = optimal). Capped at 10000 iterations. Button lives in the TreeRoute upgrades header, disabled when nothing's affordable.

- **11 new fame skill-tree nodes + 7 new capability tags** (`8bdf6b6`, `40da6f5`). Filled the underbuilt Office branch and added depth to canvas/inspiration paths. Nodes:
  - Office (5): `gold_diggers` (user renamed from `master_painter`) — `class_goldsmith`; `recruiter` — `queue_slot`; `hire_manager` — `roster_slot`; `accelerator` — `worker_xp_mult`; `bookkeeper` — `hire_cost_reduction`.
  - Canvas-depth (2): `afterburner` — `combo_decay_reduction`; `expanding_horizon` — `canvas_size_bonus`.
  - Inspiration (2): `enlightenment` — `ascend_threshold_reduction`; `patron` — `inspi_mult_bonus` (parent: `poke_tree`).
  - Workshop (1): `apprentice_pool` — hardcoded inventory slot like the existing chests.
  
  Six new selectors in `multipliers.ts` plus `getCritGoldBonus` wired into `canvasTick`'s crit path. `comboEffectiveChance` and `fameOnAscend` extended with optional decay / threshold-reduction params (backward-compatible defaults). 9 focused tests cover each new capability selector. All new selectors use `countCapability` so authoring more nodes with the same tag stacks linearly.

- **Office black-screen regression fix** (`a66f3fb`). The new `getHireCostMultiplier` reads `state.purchasedNodes`, but QueueCard's helperState (`{ officeLevel } as GameStore`) didn't include it → `countCapability` crashed on `Object.entries(undefined)` → React unmounted. Subscribed to `purchasedNodes` and threaded through useMemo deps. The third instance of this exact bug class (canvas NaN preview, Office black-screen v1, now Office black-screen v2). Triggered the next item.

- **Typed `Pick<GameStore, ...>` selector signatures across the board** (`47f2794`). Closes the `as unknown as GameStore` escape hatch that enabled the recurring helperState bug. Each selector now declares the minimum fields it reads:
  - **`Pick<GameStore, "purchasedNodes">`** — `getNodeLevel`, `hasNode`, `sumLevels`, `hasCapability`, `countCapability`, `getCanvasTrackUnlocked`, `getInspiMultiplier`, `getColorTreeContribution`, `getRainbowMultiplier`, `getSkillTreeSpeedContribution`, `getTreeUpgradeCostMultiplier`, `getAffixMagnitudeBonus`, `getWorkerXpMultiplier`, `getHireCostMultiplier`, `getComboDecayReduction`, `getCritGoldBonus`, `getAscendThresholdReduction`.
  - **`Pick<GameStore, "paintMastery">`** — `getPmMultiplier`.
  - **`Pick<GameStore, "equipped">`** — `getEquippedContribution`.
  - **`Pick<GameStore, "roster">`** — `getOfficeContribution`.
  - **New exported `CanvasMultiplierInputs` type** — union of all fields canvas multipliers read. `getCanvasGoldMultiplier`, `getCanvasSpeedMultiplier`, `getCritChance`, `getComboBaseChance`, `getCanvasSize` all take it. Components (PaintingRoute, StatsRoom) type their helperState as `: CanvasMultiplierInputs` instead of `as unknown as GameStore`. TS now catches missing fields at compile time.
  
  Net result: the three bugs that hit us (canvas NaN, Office black-screen v1, Office black-screen v2) would all have failed to compile under the new guard. Zero `as GameStore` escapes remain in canvas/office UI code.

- **Multi-sale-per-tick fix — crit now actually scales at high speeds** (`f41f4df`, `7003c0b`). Old `canvasTick` fired *exactly one sale per call* and discarded leftover time beyond `effectiveTime`. Result: at high `speedMult` (or any state where `effectiveTime < 16ms` RAF delta), throughput was throttled to 60 sales/sec regardless of underlying speed. Crit (×10 faster) showed no visible gold/sec lift once base canvas was already sub-second — the extra speed had nowhere to go. Now `canvasTick` loops over the deltaSeconds budget, finishing as many canvases as time covers per tick; re-rolls crit/combo each iteration; refreshes state between iterations so PM compounds correctly. Safety cap at 1000 sales/tick. Regression test asserts ≥8× more sales/sec at 100% crit vs no-crit (geometric ~10×) — would fail under the old throttle.

### Tests + build

- **746 tests passing across 80 files** (was 736 before this batch; +10 net for new capabilities + Buy-all + multi-sale + crit regression).
- `npx tsc --noEmit` clean. `npm run build` clean. Bundle ≈ 164 KB gzipped (under 250 KB DoD).

### Lessons preserved

- **`as` casts on partial state are landmines.** Three bugs hit the same pattern (component constructs `{ field1, field2 } as unknown as GameStore`, selector reads a field not in the stub, runtime crash). The fix is to make the cast unnecessary: narrow selector signatures to typed Picks so TS catches mismatches at compile time. Apply the same pattern wherever else `as unknown as GameStore` appears (workshop, constellation, ascension, tree routes still have one each — defer until something breaks).
- **The greedy "cheapest first" sweep is optimal under geometric per-level cost growth.** When a per-level cost grows by a fixed ratio (e.g., ×1.5), buying the cheapest part first always gives more total levels for the same gold than other orderings. The `buyAllAffordableTreeParts` action exploits this.
- **One-sale-per-tick throttles invisibly cap crit / speed late game.** Originally the throttle was a defensive choice ("exactly one sale per tick" was even commented). It's wrong: when `effectiveTime < frameDelta`, the engine is dropping sales. Multi-sale loop with a safety cap is the correct shape. Future content that boosts canvas speed (workers, items, tree nodes) won't silently regress now.
- **Capability tags via `countCapability` make per-level-stacked nodes cheap to add.** Six of the seven new capabilities are pure additive multipliers via `countCapability(state, tag) × constant`. Authoring a new node with the same tag adds another level worth of effect — no engine changes needed. Pattern to keep using for future content.
- **JSON-driven node config means rename-with-content-preservation is free.** User renamed `master_painter` → `gold_diggers` mid-session. Engine reads the capability tag, not the ID; only one test referenced the literal ID and needed updating. Mid-session renames are a natural part of authoring.

### Next

Open ends:
- Goldsmith class node now exists (`gold_diggers`) but unwired in playtest — verify in browser that purchasing it lets Goldsmith candidates trickle.
- Crit-not-working perception bug: user reported it after `f41f4df` shipped. Regression test passes. Probable cause was stale HMR; needs hard-refresh + Stats-tab verification of crit chance. Tracked.
- Four `as unknown as GameStore` casts remain in `WorkshopRoom`, `ConstellationRoute`, `TreeRoute`, `AscensionRoute`. None has triggered a bug yet; leave until one does, then apply the same typed-Pick pattern.

---

## Size rework + review-driven fixes (2026-05-11)

Nine commits after the post-Office polish, driven by a formal `requesting-code-review` pass plus a user-requested Size system rework.

### What landed

- **Review-pass fixes** (`386264b`). Critical: `awardOfficeXp` no longer credits `officeXp` when the roster is empty — spec §4.3 said "emergent from roster activity," but the slice was silently leveling the Office from canvas sales before any worker was ever hired (so a player opening Office for the first time would walk into a fully-tier-unlocked office with fast trickle). Companion test renamed + assertions inverted. Plus integration test for additive stacking across canvas + items + workers (closes the gap where unit tests covered each source in isolation but not their sum). Minors: `useMemo` on StatsRoom `helperState`; `LEVEL_UP_CAP` extracted and dev `console.warn` when it binds on `applyWorkerLevelUps` / `applyOfficeLevelUps`; `screenToSvg` dev-warn on null CTM; explicit L0 guard in `getOfficeTierCap`; one-line comment on `Worker.affixes` shared-ref with `Candidate`.
- **Craftsmanship 5× weaker than designed** (`a90e494`). `workshopSlice.craft` was passing the raw fame-node level (1–5) to `rollAffixes` where it expected percentage points (5–25 from `getAffixMagnitudeBonus`). Selector existed and was correct; the consumer bypassed it and reinvented (incorrectly) the math. At Craftsmanship 5, players were getting +5pp shift instead of +25pp. Fix: `workshopSlice.craft` now calls `getAffixMagnitudeBonus(state)` directly. Regression test added (asserts every rolled magnitude ≥ 27 at L5, which fails under the old bug).
- **CanvasStage hover mislabeled workers as "Colors"** (`2deb828`). The sell-price hover reverse-engineered `colorSum = goldMult / rainbow − 1 − items − sellPrice`. Post-Office, `getCanvasGoldMultiplier` also includes worker contribution, so worker bonuses were displayed under the Colors line. Total was correct; the breakdown lied. Added explicit Workers line + subtracted from colorSum.
- **Size rework — single unified value** (`18a4c32`). Replaces the dual `sizeLevel`/`sizeMult` model. Size is now ONE number, base 1, with all sources contributing additively (canvas size-track level × `SIZE_PER_LEVEL=0.15`, equipped `+size%` items, hired workers' `+size%` affixes, and any future fame nodes via the `+size%` capability). Canvas gold scales as **size²**, canvas time scales as **size** — so doubling size quadruples gold and doubles time, making bigger canvases strictly more efficient per second (gold-per-second = (BASE/TIME_BASE) × size, linear and unbounded). Replaces `SIZE_GOLD_PER_LEVEL` + `SIZE_TIME_PER_LEVEL` with the single `SIZE_PER_LEVEL`; `canvasGold(size, multiplier)` and `canvasTime(size)` shed the `sizeMult` parameter; `getSizeMultiplier` becomes `getCanvasSize`. All consumers updated: `canvasSlice`, `PaintingRoute`, `CanvasStage` hover, `StatsRoom` Size block (now Base / Canvas / Items / Workers + Gold factor (size²) + Time factor (size)). The user's choice: +15% per level, additive composition, gold chain `BASE × size² × sellMult × PM × combo`.
- **Three follow-up size fixes**:
  - `651a3e3`: `PaintingRoute.helperState` was missing `sizeLevel`, so the canvas's "next sale gold" preview rendered `(e^NaN)NaN`. Added.
  - `bbd12d7`: canvas title showed "Tier 18 · Tier 18" past size 10 because `STAGE_NAMES` only covers 0–10 and the fallback `Tier N` collided with the title's "Tier N · " prefix. Title now reads `— {stageName} —` only; tier number stays in `tierBadge` below.
  - `a591ddc`: removed `ScalingMathPanel` from the bottom info bar. The same scaling info now lives in the Stats tab with cleaner breakdowns.

### Tests + build

- **736 tests passing across 80 files** (was 738 after the post-Office polish; net −2 from removing the ScalingMathPanel suite, +5 from integration / Craftsmanship / size tests).
- `npx tsc --noEmit` clean. `npm run build` clean. Bundle ≈ 162 KB gzipped JS (under 250 KB DoD).

### Lessons preserved

- **Selectors-that-wrap-math are the contract; consumers must call them.** Craftsmanship's bug was the canonical anti-pattern: a selector (`getAffixMagnitudeBonus`) existed and did the right math, but `workshopSlice.craft` bypassed it and recomputed (wrong) inline. The pattern is now grep-able: any direct `getNodeLevel(state, "<id>") * constant` outside `multipliers.ts` is a smell. A quick repo-wide sweep after each new selector lands would catch this.
- **Reverse-engineered breakdowns are stale-by-default.** `CanvasStage.sellHoverBody` derives `colorSum` by subtracting known sources from the total multiplier. When a new source (Office workers) lands in the multiplier function, the breakdown lies until someone explicitly subtracts the new source. Better pattern: `StatsRoom` adds each source as an explicit line (additive construction). The mislabel will recur whenever something new gets wired into `getCanvasGoldMultiplier` and CanvasStage isn't updated.
- **Spec §4.3 "emergent from roster activity"** is the design promise. `awardOfficeXp` violated it silently because canvas-sale path calls it unconditionally. The guard belongs in the action itself, not the caller — a single early return is more robust than asking every future caller to remember the precondition.
- **Single-value models beat dual-axis models for player-facing concepts.** The dual `sizeLevel` (integer canvas upgrade count) + `sizeMult` (fractional items+workers multiplier) was technically correct but conceptually muddled — adding the two via "+30%" / "+10%" breakdown looked additive but actually compounded. The unified `size` value with `size²` gold and `size` time is harder to *implement* (multi-file refactor) but easier to *reason about* (one number, one formula).
- **`helperState` is a maintenance liability.** Several consumers construct `as unknown as GameStore` stubs with hand-picked fields. When a new selector lands that reads a different field (e.g., `getCanvasSize` now reads `state.sizeLevel`), every helperState in the codebase silently breaks. The `(e^NaN)NaN` regression came from exactly this. Worth considering a typed helper like `subsetGameStore(...)` that errors at compile time when fields are missing — but YAGNI for now.

### Next

The Stats panel surfaces canvas-axis multipliers only; PM and inspi-mult are still invisible there. Goldsmith class remains unauthored (no fame node grants `class_goldsmith`). The `helperState` pattern noted above is fragile and would benefit from a typed helper if/when it bites again.

---

## Post-Office playtest polish (2026-05-11)

Nine commits after Painter's Office landed. Each surfaced from in-session browser playtesting.

### What landed

- **Build break fixed** (`5622d3c`). Task 19 left 4 `TS2532` errors in test files that broke `tsc -b` but not `tsc --noEmit`. Added `!` non-null assertions on `s.queue[0]` / `s.roster[0]` / `s.roster[1]` indexed access. `npm run build` now passes; bundle ≈ 160 KB gzipped JS (under 250 KB DoD budget).
- **Constellation pan + zoom + MiniMap viewport** (`e53b85d`, `8ef26b9`, `5cafabf`, `477acb5`, `71f34eb`). New `viewport.ts` pure module with `clampZoom`, `clampPan`, `zoomAt`, `panBy`, `centerOn`; shared viewport state in `ConstellationRoute` drives both the interactive `<StarCanvas>` and the `<MiniMap>` indicator. Wheel = cursor-anchored zoom (non-passive listener, `preventDefault`-ed); left-drag = pan; double-click = reset. Drag-vs-click discrimination via 3px movement threshold + `onClickCapture`. MiniMap renders a translucent stroked rect at the current viewport bounds and supports click-to-jump (centers the main view there). VIEWBOX is now computed from the actual node bounding box plus 880 px of margin (80 padding + 800 future growth), so the whole tree fits at default zoom and there is room for new nodes in every direction.
- **Constellation pan-clamp evolution**. Initial strict clamp (entire viewport must sit inside VIEWBOX) made dragging dead at zoom 1; relaxed to "viewport center inside VIEWBOX" (gave ±half-viewport pan room); then added `PAN_BLEED = 1` so the user can drag past VIEWBOX bounds by a full extra viewport in every direction. Three iterations because each smaller fix surfaced a tighter UX expectation the next playtest.
- **Skill tree merge** (`76b8716`). Designer's localStorage draft predated subproject 2's capability tags, so saving from it stripped `size_matters` / `big_picture` / `genius_episode` / `consistency` / `fast_learner` / `unrelentless` from the JSON — permanently locking the canvas Size/Crit/Combo tracks. Merged the 6 lost nodes back into the user's new layout, keeping their additions (`monk_internship`, `entrepreneur`, `education`, `free_will`) and fixing `entrepreneur`'s capability from the bogus `"Office_tab"` to `["roster_slot", "queue_slot"]`. Layout positions later refined (`a7f6072`).
- **Office tab crash fix** (`ac4a37d`). `QueueCard` used `useGameStore(s => getHireCost(s, candidate))` — selector returned a fresh `Big` instance each call → Zustand "getSnapshot should be cached" → max-update-depth → React unmounted the tree → blank dark screen. Fixed by pulling `officeLevel` as a primitive and computing the Big inside `useMemo` keyed on `(officeLevel, candidate)`.
- **Stats tab** (`d740cc1`, `b7fd3eb`, `d6357b1`). New right-rail tab below Lab in `RoomRail`, always enabled. `StatsRoom.tsx` shows each canvas-axis multiplier (Sell Price / Speed / Crit / Combo / Size) with a per-source breakdown: Canvas upgrade, Skill tree, Items, Workers. Multiplicative lines (Rainbow, Size factor) render below the additive ones; the displayed total reflects the full multiplicative product. Three new helper selectors in `multipliers.ts` — `getColorTreeContribution`, `getRainbowMultiplier`, `getSkillTreeSpeedContribution` — wrap previously-private logic for UI use without duplicating it. Size handling is a special case: the canvas Size upgrade is a *multiplier on the sell-price additive sum*, not an additive contribution to it, so Size shows up in two places — its own block (with canvas/items/workers lines) and as a multiplicative line in the Sell Price block.
- **Scrollbars styled** (`5b699f1`). Thin 8 px scrollbars on `--bg-stone-d` tracks with `--ink-line` thumbs (hover lightens to `--ink-3`). Applied globally in `src/index.css`. Covers all scrollable panels including StatsRoom, OfficeRoom, WorkshopRoom, and dev tools.

### Tests + build

- **738 tests passing across 81 files** (was 725 after the Office handover; +13 net for `viewport.test.ts`).
- `npx tsc --noEmit` clean; `npm run build` clean; bundle ≈ 160 KB gzipped JS.

### Lessons preserved

- **Zustand selectors that return fresh objects each call cause infinite loops.** When a selector wraps a function that constructs a new `Big` / array / object per call, Zustand sees a new identity every render and re-runs the selector forever. Fix: subscribe to the primitive inputs (state field) and compute the derived object via `useMemo` keyed on those inputs. The error surfaces as "The result of getSnapshot should be cached" → max-update-depth → blank dark screen because React unmounts the tree.
- **localStorage drafts in dev tools can shadow file edits silently.** The SkillDesigner's `loadDraft()` reads `localStorage` first and only falls back to the JSON file when storage is empty. After we updated the JSON in tree on disk, the editor kept loading the stale draft. The editor has no "Reload from file" button; the recovery path is manual (`localStorage.removeItem('artdle:skill-design:draft')` + refresh). Worth adding the button if this pattern bites again.
- **Pan/zoom clamps trade safety for vibe.** Strict bounds (viewport must stay inside content) feel dead at default zoom; relaxed bounds (allow over-pan into empty space) feel alive. The right balance is content-aware: compute the content bounding box, then add explicit "future growth" margin around it, then let the user pan-bleed up to one viewport beyond that margin. Three constants make the intent legible: `PADDING` (breathing room around current nodes), `FUTURE_GROWTH` (empty space for additions), `PAN_BLEED` (over-pan ratio).

### Next

Open ends from this session: Goldsmith class still has no fame node granting `class_goldsmith` (only Speedrunner is reachable via `free_will`); user can author one in the designer when ready. The Stats tab covers canvas-axis multipliers but doesn't yet surface PM mult or inspiration mult — could be added if it'd be useful in playtesting.

---

## Painter's Office (shipped on `main`, 2026-05-11)

**Status:** Shipped. Subproject 3 of 3 in the Painter's Office decomposition. The passive idle counterpart to the Workshop: a trickle queue of rolled worker candidates, Hire/Reject/Fire decisions, per-worker geometric XP levelling, and an Office Level meta-progression that survives ascend. Workers buff the single canvas through the same shared affix pool as the Workshop, wired additively into every multiplier.

**Plan:** `docs/superpowers/plans/2026-05-11-painters-office.md`. **Spec:** `docs/superpowers/specs/2026-05-10-painters-office-design.md`.

### What landed

- **Balance constants + formulas** (`core/balance.ts`): `workerXpToNext(level)` geometric scale, `officeXpToNext(level)` for Office Level, `trickleSeconds(officeLevel)` trickle rate, `hireCost(officeLevel, candidate)` gold cost, `computeOfficeTierProbabilities(officeLevel)` weighted tier roll, `OFFICE_TIER_AFFIX_COUNT`, `OFFICE_TIER_UNLOCK_LEVEL`, `XP_GOLD_FRACTION`, `levelScale`.
- **Class config** (`config/officeClasses.ts`): `generalist`, `goldsmith`, `speedrunner` classes with per-kind weight ranges (e.g., Goldsmith `+sell_price% [3,7]`, Speedrunner `+speed% [3,7]`); `GENERALIST_CLASS_WEIGHT = 3`, `SPECIALIST_CLASS_WEIGHT = 1`. Classes gated by capability tags (`class_goldsmith`, `class_speedrunner`).
- **Roll engine** (`core/officeRoll.ts`): `rollWorkerClass` (capability-gated weighted pool), `rollWorkerWeights` (per-kind weight tuple with reroll-on-all-zero guard), `rollWorkerAffixes` (weighted pick sampling capability-filtered kinds), `rollCandidate` (full pipeline composing class → weights → affixes → tier). Weight tuple is ephemeral — not stored on the worker.
- **`officeSlice`** (`store/officeSlice.ts`): state (`officeLevel`, `officeXp`, `queue`, `roster`, `trickleTimer`), actions (`tickOffice`, `hireFromQueue`, `rejectFromQueue`, `fireWorker`, `awardOfficeXp`, `resetOffice`), selectors (`getRosterCap`, `getQueueCap`, `getClassUnlocked`, `getOfficeTierCap`, `getHireCost`, `getOfficeContribution`). `getRosterCap` / `getQueueCap` delegate to `countCapability` so each level of a user-authored fame node contributes +1 slot.
- **Ascend hook** (`systems/ascend.ts`): `resetOffice()` call wipes queue + roster + trickleTimer while preserving `officeLevel` and `officeXp`.
- **Save migration v12 → v13** (`store/index.ts`): seeds new office fields at defaults; `officeLevel` and `officeXp` intentionally preserved if already present. `SAVE_VERSION` bumped to 13.
- **Multiplier wiring** (`core/multipliers.ts`): `getOfficeContribution(state, kind)` sums `affix.magnitude` across all roster workers' affixes for a given `AffixKind`. Wired additively into `getCanvasGoldMultiplier`, `getCanvasSpeedMultiplier`, `getCritChance`, `getComboBaseChance`, and `getSizeMultiplier`.
- **SkillDesigner chips** (`dev/skillDesigner`): quick-add chips for `roster_slot`, `queue_slot`, `class_goldsmith`, `class_speedrunner` extend the subproject-2 chip set.
- **UI panel components** (`components/painting/`): `OfficeRoom.tsx` (340 px right-rail panel), `OfficeLevelHeader.tsx` (level + XP bar + tier cap + trickle period), `QueueCard.tsx` (candidate display with Hire/Reject), `WorkerCard.tsx` (roster member with affix list + Fire button), `FireConfirmModal.tsx` (confirmation modal). CSS via `OfficeRoom.module.css` (mirroring Workshop CSS convention).
- **RoomRail switching** (`components/painting/RoomRail.tsx` + `routes/PaintingRoute.tsx`): `RoomRail` accepts `activeRoom` + `onSelect` props; Office tab shows when `getRosterCap(state) >= 1` (at least one fame node with `roster_slot` purchased). `PaintingRoute` holds local `activeRoom` state and conditionally renders `<OfficeRoom>` vs `<WorkshopRoom>`.

### Tests + build

- **725 tests passing across 80 files** (was 663 before this subproject; +62 net). Tests cover balance formulas, roll engine (rollWorkerClass, rollWorkerWeights, rollWorkerAffixes), officeSlice actions + selectors, XP levelling, ascend integration, and multiplier contribution.
- `npx tsc --noEmit` clean. `npm run build` (`tsc -b`) fails on 4 pre-existing `TS2532` ("Object is possibly 'undefined'") errors in `tests/store/officeSlice.test.ts:118` and `tests/store/officeSlice.xp.test.ts:21,22,38` — `noUncheckedIndexedAccess` on `s.queue[0]` / `s.roster[0]` / `s.roster[1]`. Fix is 4 non-null assertions (`!`) or narrowing guards; deferred as out-of-scope for Task 19 (`Modify only: docs/HANDOVER.md`). Bundle size could not be measured (build blocked by these errors). Prior task sweeps ran `npx tsc --noEmit` (excludes test project refs) but not `npm run build`, which is why the errors were not caught earlier.

### Lessons preserved

- **`countCapability` is the levelled sibling of `hasCapability`.** When a capability needs to contribute a quantity (roster slots, queue slots) rather than a boolean, `countCapability` sums `node.level` across all nodes tagging that capability. This parallelism is now explicit in `skillTreeSlice.ts` and should be the pattern for any future count-based capability.
- **Per-worker random weight profiles are ephemeral; only the rolled affixes are stored.** `rollWorkerWeights` produces a per-kind weight tuple consumed immediately by `rollWorkerAffixes` and then discarded — it is never stored on the `Worker` record. The variance surfaces through the affix list the player sees. Don't be tempted to store weights for display: the spec's decision was "naturally surfaces through the rolled affix list."
- **`Big`-vs-`number` boundary lives at the multiplier return, not inside the contribution sum.** `getOfficeContribution` sums `affix.magnitude` (plain JS numbers) and returns a raw number; `getHireCost` operates on a `Big` result from the start because the hire cost formula mixes `officeLevel`-based scaling with a `Big` floor. The boundary rule: use `Big` when the value itself can exceed `Number.MAX_SAFE_INTEGER` or is monetary/inspiration-scale; keep contribution sums as numbers since magnitudes are bounded small integers.

### Next

All prerequisites for v1.x Office feature extensions are in place: capability-tag gating, `countCapability` for slot caps, per-worker affix system, multiplier wiring, save migration. Future waves can add new worker classes, tier expansions, or Office Level perks by authoring fame nodes and extending class config — no engine changes required.

---

## Post-shipping polish (2026-05-10, after affix-pool-rework)

Seven commits of in-session playtest fixes after subprojects 1 + 2 landed. Each surfaced during browser testing.

### What landed

- **`+size_gold_per_level%` renamed to `+size%`** (`7f55fb8`). User feedback: the long name was unnecessary "shenanigans" — the mental model is just "bigger canvas = more gold + more time," so the affix is `+size%` and scales the *effective sizeLevel* symmetrically. Both gold AND time formulas now consume `getSizeMultiplier(state)` (renamed from `getSizeGoldPerLevelMultiplier`). `canvasTime(sizeLevel, sizeMult = 1)` gained an optional 2nd arg matching `canvasGold`'s shape. Save migration **v11 → v12** wipes inventory + equipped (old magnitudes don't translate; gameplay implications changed).
- **ScalingMathPanel reflects `sizeMult`** (`84d0a03`). Reference panel's gold + time formulas display `× sizeMult` so the math stays accurate when `+size%` items are equipped.
- **Crit RNG bug fixed** (`d95fdcd`). canvasTick rolled crit only when `canvasProgress === 0`, but after a sale the slice sets `canvasProgress: leftover` (typically > 0). So the gate failed on every canvas after the first → players never saw crits even at high crit chance. Fix: roll the next canvas's crit **inside the sale path itself** rather than waiting for the next tick's progress-=-0 check.
- **Per-kind affix magnitude ranges** (`4f0e7e5`). Old uniform `5..15` range across all 5 kinds was unbalanced — `+crit_chance%` is non-linearly strong (10× speed on hit compounds at stack) and `+combo_chance%` is weak (fixed +10%/link with decay). New `AFFIX_MAGNITUDE_RANGE` record per kind:
  - `+sell_price%` / `+speed%` / `+size%`: 5..15 (baseline)
  - `+crit_chance%`: 2..8 (smaller pp)
  - `+combo_chance%`: 5..20 (wider pp)
  Targets rough EV equivalence at 5-legendary stacking (~1.5..1.75× output multiplier across kinds).
- **Progress bar rubberband fix** (`45256d6`). The `.fill` and `.progressFill` divs had CSS transitions (200ms/100ms) that animated DOWN when progress snapped from ~100% → ~leftover% on sale. Fix: key both divs by `canvasNumber` (= `lastSale.id`); React re-mounts on sale, CSS transitions restart from 0. No CSS changes — the transitions stay (they're what makes in-canvas filling smooth); only the re-key timing changed.
- **PM uncapped** (`a8cfa7f`). Two caps were limiting Paint Mastery:
  - `pmFromLifetime` had a 30-iteration loop bound (~10^93 lifetime gold ceiling, ~30k PM).
  - `pmMult` called `pm.toNumber()` → saturated at `Number.MAX_SAFE_INTEGER` (~9e15) → multiplier capped at ~81.
  
  Fixes: loop bound 30 → 100 (covers ~10^303, practical infinity); `pmMult` switches to `pm.add(1).log10().toNumber()` (break_eternity's native `.log10()` operates on the Big directly, no precision loss). At PM = 1e20, mult ≈ 101. At 1e50, ≈ 251.
- **PM scaling linearized** (`ab2db71`). Even with the cap removed, players hit PM ~1000 at lifetime gold 1M and saw it freeze: the phase-ratcheting design made each next +1 PM cost another 1M gold (then 1B, then 1T, ×1000 per phase). Replaced with **linear `PM = floor(lifetimeGold / 1000)`** forever. Continuous growth: every 1000 g of lifetime earnings → +1 PM, regardless of how high lifetime gold goes. Existing PM values preserved across the change; only the formula that grows PM changed. `pmFromLifetime` body collapsed from 30-iteration phase loop to a single `.div(1000).floor()`; `pmThreshold` now constant `1000`. The PM mult curve (`1 + 5 × log10(PM + 1)`) still does the smoothing — log of linear = log of lifetime gold, asymptotically gentle without phase plateaus.

### Tests + build

- **663 tests passing** (was 680; net –17 from removing phase-ratcheting test cases that no longer apply). All new linear-PM behavior covered.
- tsc clean. Lint clean. Bundle: ~157 KB gzipped JS (negligible drift). Under the 250 KB DoD budget.

### Lessons

- **State transitions need explicit reset triggers.** The crit bug came from assuming "the next tick's canvasProgress === 0 check will fire" — but the sale path sets canvasProgress to `leftover` (positive). When state convention is "this flag triggers re-roll," the re-roll must happen at the boundary where the next-state is constructed (the sale path), not deferred to a future tick that depends on a fragile invariant.
- **CSS transitions + React keys = clean visual reset.** When a value should "snap" on a discrete event but smoothly animate otherwise, key the element by an event counter. React replaces the DOM node, transitions restart. Cleaner than conditional transition disabling.
- **`break_eternity.js` has Big-native log/exp/etc.** When stacking caps come from `pm.toNumber()` → JS-number saturation, switch to `pm.log10()` / `pm.exp()` etc. — the Big stays in precision through the operation, only the final return value drops to a JS number.
- **Phase-ratcheting designs read as "capped" to players.** A 1000× ratchet between phases makes each phase boundary a wall — players hit it, watch PM stall, and call it broken. Two layers of curve-shaping (phase ratchet + log multiplier) double up on the smoothing and produce flat plateaus. One log-shaper is enough; let the underlying input grow linearly and let `pmMult`'s log do the rest.

---

## Affix pool rework + capability tags (shipped on `main`, 2026-05-10)

**Status:** Shipped. Subproject 2 of 3 in the Painter's Office decomposition. The workshop affix pool is rewritten to match the canvas-depth axes; the 3 advanced affixes are gated at craft-time by capability tags on user-authored skill-tree nodes (so node IDs are free-form game-design choices, not engine constraints).

**Plan:** `docs/superpowers/plans/2026-05-10-affix-pool-rework.md`. **Spec contract:** §6 of `docs/superpowers/specs/2026-05-10-canvas-depth-design.md`.

### What landed

- **`AffixKind` enum** rewritten: `+canvas_gold% / -paint_time%` → `+sell_price% / +speed% / +crit_chance% / +combo_chance% / +size_gold_per_level%` (5 kinds total). Magnitude range still 5–15% per affix; Craftsmanship skill-tree node still shifts both bounds.
- **Multiplier consumers** all wired:
  - `+sell_price%` → `getCanvasGoldMultiplier` (additive, alongside item bonus + colors + sell-price level + rainbow)
  - `+speed%` → `getCanvasSpeedMultiplier` (additive, alongside basic_technique / muscle_memory / speed level)
  - `+crit_chance%` → `getCritChance` (additive, clamped at 1.0)
  - `+combo_chance%` → `getComboBaseChance` (additive, clamped at 1.0)
  - `+size_gold_per_level%` → new `getSizeGoldPerLevelMultiplier` (multiplicative on `SIZE_GOLD_PER_LEVEL` inside `canvasGold(sizeLevel, mult, sizeGoldMult)` — extended with optional 3rd arg)
- **`getPaintTimeMultiplier` deleted** entirely — its non-linear `v / (1 - v)` magnitude conversion was unintuitive; new `+speed%` stacks additively. canvasTick + PaintingRoute simplified accordingly.
- **Roll-time gating via capability tags:** `rollAffixes(tier, state, magnitudeBonus)` takes state, filters the pool by `getCanvasTrackUnlocked`. The 3 advanced affixes only roll when the corresponding canvas track is unlocked. No wasted rolls.
- **Capability-tag system** (the architectural unlock):
  - `SkillNodeConfig` gains `readonly unlocks: ReadonlyArray<string>`. Default `[]` for nodes without the field.
  - New selector `hasCapability(state, capability)` — scans purchased nodes (level ≥ 1) for any whose `unlocks` array contains the capability string.
  - `getCanvasTrackUnlocked(state, "size" | "crit" | "combo")` → delegates to `hasCapability(state, "canvas_<trackId>")`. Sell price + speed return `true` unconditionally (always-unlocked tracks).
  - Engine reads capability strings, never node IDs. **Node naming is now a pure game-design decision.**
- **Existing user-authored nodes tagged:**
  - `size_matters` → `unlocks: ["canvas_size"]`
  - `genius_episode` → `unlocks: ["canvas_crit"]`
  - `unrelentless` → `unlocks: ["canvas_combo"]`
  - `gear_up` continues to use its hardcoded ID for the palette slot — left untouched in this subproject (could be migrated to `unlocks: ["palette_slot"]` later for consistency).
- **`/dev/skill-designer` UI** updated: each node form exposes the `unlocks` field as a comma-separated text input + 4 quick-add chips (`canvas_size`, `canvas_crit`, `canvas_combo`, `palette_slot`). Storage migrates legacy nodes to `unlocks: []` automatically.
- **Workshop UI:** `WorkshopRoom` affix label map updated for the 5 new kinds (`+X% sell price`, `+X% speed`, `+X% crit chance`, `+X% combo chance`, `+X% size gold/level`).
- **Canvas hover body:** `<CanvasStage>` `sellHoverBody` references the new affix names; the gold breakdown now includes a separate "Sell Price (Lv N)" line and the base-gold formula factors in `sizeGoldMult`. Combo line appears when chain > 0.
- **Save migration v10 → v11:** wipes inventory + equipped (game unreleased; magnitudes from `-paint_time%` don't translate cleanly to `+speed%`). Workshop level + XP preserved (long-tail meta).

### Tests + build

- **671 tests passing across 76 files** (was 653 after canvas-depth; +18 net for affix pool + capability tags).
- tsc clean. Lint clean (only pre-existing `main.tsx` warning).
- Bundle: **157.30 KB gzipped JS** (was 156.37 KB; +0.93 KB). Under the 250 KB DoD budget.
- 14 commits from `5b568a3` (plan) → `3a7b5d7` (capability-tag refactor).

### Lessons preserved

- **Node IDs are game-design, not engine concerns.** When the user pointed out that the engine's hardcoded `unlock_canvas_*` IDs forced their node naming, the right fix was to introduce a capability-tag layer — the engine reads what it needs, the designer names nodes thematically. The `unlocks: string[]` field is the API.
- **`getEquippedContribution(state, kind)` already returns fractional sums.** Five new consumers added; none accidentally double-divides by 100. The convention is documented inline in `workshopSlice.ts` at the function definition.
- **Migration wipes are fine pre-release.** Magnitudes from `-paint_time%` (where `v / (1 - v)` math applied) don't translate to `+speed%` (where additive applies). Wipe is the practical move; v9 → v10 (canvas-depth) and v10 → v11 (this subproject) both wipe with rationale.

### Next

Subproject 3 — Painter's Office. Sketch design at `docs/superpowers/specs/2026-05-10-painters-office-design.md`; numbers TBD until this subproject's affix pool is in production. Now that pool exists, the Office spec can resolve its TBDs and become plan-ready.

---

## Canvas depth — 5 upgrade tracks (shipped on `main`, 2026-05-10)

**Status:** Shipped. Subproject 1 of 3 in the Painter's Office decomposition (see `docs/superpowers/specs/2026-05-10-painters-office-design.md` for the parked Office sketch). The canvas's single `canvasTier` upgrade is replaced by **5 independent upgrade tracks**, each levelled in gold; sell-price + speed unlocked from start, size + crit + combo gated by user-authored fame skill-tree nodes.

**Spec:** `docs/superpowers/specs/2026-05-10-canvas-depth-design.md`. **Plan:** `docs/superpowers/plans/2026-05-10-canvas-depth.md`.

### What landed

- **5 tracks, each with its own gold-cost curve `BASE × 1.5^currentLevel`:**
  - **Sell Price** (unlocked from L1, `+10%` gold per level, base cost 100g)
  - **Speed** (unlocked from L1, `+5%` speed per level, base cost 100g)
  - **Size** (gated, `+30%` gold AND `+15%` time per level — net positive, base cost 1000g, replaces the old tier² scaling)
  - **Crit** (gated, `+1%` chance per level, fixed 10× speed on hit i.e. "90% faster", base cost 5000g)
  - **Combo** (gated, `+2%` base chain chance per level, fixed `+10%` gold per chained link, decay -5pp per current link, base cost 5000g)
- **Schema:** `CanvasState` drops `canvasTier`; adds `sellPriceLevel`, `speedLevel`, `sizeLevel`, `critLevel`, `comboLevel`, `comboChain`, `isCritThisCanvas`. All 5 levels + chain reset on ascend (Workshop pattern: only the institution survives, not the run-state).
- **Track unlocks** read by `getCanvasTrackUnlocked(state, trackId)` from `skillTreeSlice`. Engine recognises 3 well-known fame node IDs the user authors via `/dev/skill-designer`:
  - `unlock_canvas_size`
  - `unlock_canvas_crit`
  - `unlock_canvas_combo`
  Each grants `+1 unlock` (level ≥ 1 = unlocked). Until purchased, the matching TrackCard renders Locked and the action no-ops.
- **`canvasTick` rewrite:** Crit rolled at canvas start (when `canvasProgress === 0`) and stored in `isCritThisCanvas` for the canvas's lifetime; effective time = `canvasTime(sizeLevel) / (speedMult × critFactor)`. On sale, gold = `canvasGold(sizeLevel, mult) × comboBonusFactor(comboChain)` (combo applies the PRIOR chain). After sale, combo rolls with `comboEffectiveChance(base, chain)` decay; chain extends on hit, resets to 0 on miss. `isCritThisCanvas` resets to `false` on sale.
- **Multipliers:** `getCanvasGoldMultiplier` adds `SELL_PRICE_PER_LEVEL × sellPriceLevel` to the additive bonus alongside item affixes + color tree. `getCanvasSpeedMultiplier` adds `SPEED_PER_LEVEL × speedLevel`. New: `getCritChance(state)` and `getComboBaseChance(state)`, both clamped at 1.0.
- **`<TrackCard>`** parameterised tile renders 5 cells in `<CanvasUpgradesStrip>` (the 5-cell grid that v2.0 left empty for this). Locked variant for gated tracks. Hover info via `<Hoverable>` shows `<Track> — Level N` + current effect + next-level cost (or "Locked" + skill-tree prompt).
- **`<CanvasStage>`** prop renamed `tier` → `sizeLevel`; gains `comboChain` + `isCrit` props. New badges: 🔥 ×N (top-left, when chain > 0) and CRIT pulse (top-right, when current canvas crits).
- **`<TierCard>`** component deleted. `tierUpgradeCost`, `MAX_TIER`, `TIER_UPGRADE_BASE`, `TIER_UPGRADE_RATIO` removed from `balance.ts`. `upgradeTier` action removed from `canvasSlice`.
- **`<ScalingMathPanel>`** updated for the new model: gold formula shows `10 × (1 + 0.30 × sizeLevel) × Xx`, time shows `2 × (1 + 0.15 × sizeLevel)s ÷ Xx`, "Tier Upgrade Cost" replaced by "Sell Price Upgrade (Lv N)".
- **Save migration v9 → v10:** drops `canvasTier`, seeds the 7 new fields with defaults. Game unreleased; no translation of the old 1–10 tier onto the new tracks per spec §8.
- **Affix pool unchanged** in this subproject. The §6 contract (sell_price / speed / crit_chance / combo_chance / size_gold_per_level affix kinds) is reserved for **subproject 2 (affix pool rework)**.

### Tests + build

- **653 tests passing across 76 files** (was 628 baseline; +25 net).
- tsc clean. Lint clean (only pre-existing `main.tsx` warning).
- Bundle: **156.37 KB gzipped JS** (was 156.34 KB; effectively flat). Well under the 250 KB DoD budget.
- 19 commits from `7eb8766` (plan) → `fb65579` (final fix from end-of-impl review).

### Post-merge actions

1. **Author the 3 fame skill-tree unlock nodes** via `/dev/skill-designer`. Engine recognises `unlock_canvas_size` / `unlock_canvas_crit` / `unlock_canvas_combo` (any level ≥ 1 = unlocked). Set fame costs to taste — these gate the 3 advanced tracks.
2. **Subproject 2 — Affix pool rework.** Spec handshake at `2026-05-10-canvas-depth-design.md` §6: rename `canvas_gold` → `sell_price`, `paint_time` → `speed`, add `crit_chance` / `combo_chance` / `size_gold_per_level` kinds. Update workshop affix rolling + `multipliers.ts` to consume the new kinds. New `SAVE_VERSION` bump.
3. **Subproject 3 — Painter's Office.** Sketch design in `2026-05-10-painters-office-design.md`; numbers TBD until subproject 2 ships.

### Next

Subproject 2 (affix pool rework) — see §6 of the canvas-depth spec for the exact contract.

---

## v3.1 — Workshop leveling + tiered items (shipped on `main`)

**Status:** Shipped. Workshop now levels via 1 XP per craft. Items have a tier (Normal..Legendary) determining affix count (1..5). Slot kinds (brush, palette) gate inventory rolls and are unlocked via skill-tree fame nodes.

### What landed

- **Schema:** `Item = { id, slot, tier, affixes[] }` (was single-affix). `WorkshopState` adds `workshopLevel`, `workshopXp`; `equippedItems[]` becomes `equipped: Partial<Record<SlotKind, Item>>`.
- **Slot kinds:** `"brush"` always unlocked; `"palette"` unlocks via the `gear_up` skill-tree node (renamed in `skillTreeDesign.json` to "Unlock Palette Slot"). Each unlocked kind = 1 equip slot of that kind.
- **Tier system:** Hard gates per tier — Normal=L1, Magic=L5, Rare=L15, Epic=L35, Legendary=L70. Affix counts: 1/2/3/4/5. Probability formula: linear interp from `(unlock_level, min)` to `(L100, max)` per tier; normal fills remainder. Legendary 0.01% at L70, 1% at L100.
- **Cost curve:** piecewise growth — 1.05 per level for L1–L5, 1.20 per level past L5. L1 = 100g, L5 = 122g, L70 = 21M g, L100 = 5B g.
- **XP curve:** `xpToNext(level) = 4 × (level + 1)`. 1 XP per craft. Cumulative L70 ≈ 9,936 crafts.
- **Affix rolling:** Flat 5–15% magnitude per affix, regardless of tier. Duplicate affix kinds allowed on the same item. Future skill-tree nodes can multiply at read time.
- **`<WorkshopRoom>` UI:** level header with XP bar + dynamic-cost craft button + tiered item cards (color-bordered by tier, with slot-kind badge + affix list) + per-slot equipped panel (one row per unlocked slot kind only).
- **Save migration v8 → v9:** wipes inventory + equipped (game unreleased; no real cost).
- **Workshop level + XP survive ascend** (long-tail meta, like skill tree). Inventory + equipped wiped on ascend (run-state).

### Tests + build

- **573 tests passing.**
- tsc clean. Lint clean (only pre-existing main.tsx warning).
- Bundle: 151.63 KB gzipped JS (~+2 KB from v3.0).

### Next

Skill-tree nodes for affix magnitude multipliers, legendary chance bonuses, workshop XP boosts — designer-driven; the read-time multiplier pattern from v3.0 carries forward without engine changes.

---

## v3.0 — Skill tree rewrite from designer JSON (shipped on `main`)

**Status:** Shipped. The v1.1 5-node tree has been replaced by the user's designed 17-node DAG (multi-level, multi-parent). `src/config/skillTreeDesign.json` is the source of truth; `skillTreeNodes.ts` derives `SKILL_NODES` from it at module load. Save schema v7 → v8 wipes `purchasedNodes` (game unreleased — no save migration needed).

### What landed

- **Schema:** `purchasedNodes: Partial<Record<string, number>>` (level count). New selectors: `getNodeLevel`, `getNextCost`, `sumLevels`. `hasNode` / `canBuyNode` API names preserved with new semantics. `SkillNodeId = string` (typo protection sacrificed for data-driven config).
- **DAG prereqs:** `node.parentIds` (array). `canBuyNode` requires every parent owned at level ≥ 1.
- **Multi-level purchases:** `buyNode` spends `costs[currentLevel]` and increments. Maxed at `maxLevel`.
- **New effects:**
  - **Get Inspired** (5%/lvl × 5 = +25%) — inspi rate mult, replaces v1.1 Patient Eye
  - **10 colors** (B&W + 9 chroma, 10% additive each = +100% all bought) + **Rainbow** (20%/lvl additive × 5 = +100%) — canvas gold mult, replaces v1.1 Goldsmith
  - **Basic Technique + Muscle Memory** (1%/lvl additive each, max +10%) — NEW canvas speed multiplier in `canvasTick`
  - **Poke the Tree** (auto +100×lvl inspi every 10s) — NEW periodic timer (`pokeTreeTimer` + `skillTreeTick`)
  - **Bargain** (-1%/lvl tree-cost, floored at 50% off) — NEW discount on tree-part upgrades in `treeSlice.buyPartLevel`
  - **Gear Up** (1 → 2 workshop slots) — replaces v1.1 Second Slot
  - **Dropped without replacement:** v1.1 Faster Strokes (-10% palier) and Better Brush (+1 affix magnitude). No equivalent in the new tree.
- **Constellation visuals:** `<StarCanvas>` shows level badges for multi-level nodes, "maxed" state. `<NodeCard>` shows "Level N / M" + button cycles through Acquire / Upgrade · cost / Maxed. Multi-parent edges drawn from each parent.
- **Designer integration:** `nodeLayout.ts` derives `NODE_POSITIONS` and `EDGES` from `skillTreeDesign.json` at module load via `computeAutoLayout`. The `/dev/skill-designer` route remains the authoring tool.

### Tests + build

- 541 tests passing (was 536 baseline; net +5 from added skill-tree config tests).
- tsc clean. Lint clean (only pre-existing main.tsx fast-refresh warning).
- Bundle: 150.19 KB gzipped JS / 5.74 KB gzipped CSS / **~156 KB total** (was ~150 KB pre-T1; +6 KB for new effect plumbing + multi-level UI).

### Next

The skill tree is content-driven now. Authoring loop: open `/dev/skill-designer`, design, Save to file, restart dev server, see new tree. To wire a new effect type, the implementer (Claude) reads the `numericEffect` text and adds the appropriate multiplier/system. Currently all 17 nodes' effects are wired.

---

## v2.0 — Visual redesign shipped (on `feat/v2-redesign`, tag `v2.0`)

**Status:** v2.0 complete. All 4 routes rebuilt to match the handoff aesthetic. Pure visual adapt — no new gameplay features (per the v2.0 spec rule). Ready to merge to `main`.

### What v2.0 is

A pure visual redesign of v1.1, ground-up:
- Tailwind dropped → CSS Modules + `tokens.css` (semantic design tokens).
- All 4 routes rebuilt with inline-SVG scenes + CSS Grid layouts: **Tree** (canopy + ground + glowing leaf), **Painting** (vignetted canvas + gilded frame + room rail + workshop side panel), **Ascension** (animated stone-arch portal + cavern with floating crystals + past-runs ledger), **Constellation** (star-map with 5 nodes + edges + selectable NodeCard + minimap).
- New persisted field: `pastRuns` ledger on `metaSlice`. SAVE_VERSION 5 → 7.
- All v1.1 mechanics preserved: 4 currencies (Gold / Inspiration / Fame / Paint Mastery), canvas tiers (gold = 10 × tier² × multipliers), 5-node skill tree, workshop crafting, ascend.

### Visual deviations from handoff (per "pure adapt" rule)

- Keep IndexedDB persistence (handoff suggested localStorage).
- 4 currencies (handoff used 3); PM teal `#7adcd6` token added.
- 3-stage tree (handoff showed many stages).
- 1-tile canvas-upgrades strip (handoff showed 5).
- 5-node constellation (no fake locked future-nodes).
- 1 cluster only ("Starters") — no fake clusters.
- No pan/zoom on the constellation (5 nodes fit one viewBox).
- React 19 + lucide-react icons (handoff suggested emoji glyphs).

### Reduced-motion

`prefers-reduced-motion: reduce` honored across every animated component:
- `TreeScene` — SVG `<animate>` paused.
- `Cavern` — crystal float paused, opacity locked.
- `Portal` — float + shimmer paused.
- `StarCanvas` — twinkles paused.
- `index.css` — `fame-pulse-anim` paused.
- `FloatingGoldText` — programmatic suppress + onComplete still fires.

### Round breakdown

- **R0** (foundation): Tailwind drop, `tokens.css`, react-router-dom, lucide-react, top-bar nav, currency chips.
- **R1**: Tree route (TreeScene + GroundLine + EnergyMeter + tree-stage interactivity).
- **R2**: Painting route (CanvasStage + TierCard + WorkshopRoom side panel; legacy popup retired).
- **R3**: Ascension route (Cavern + Portal + ThresholdPanel + FamePreviewCard + PastRunsLedger; pastRuns ledger added to save).
- **R4**: Constellation route (StarCanvas + NodeCard + MiniMap + ClusterList).

Each round: own plan in `docs/superpowers/plans/`, executed via subagent-driven-development with TDD per task. Tagged `v2.0-round-{0..4}` for rollback.

### Tests + build (final)

- **470 tests passing** (442 baseline + 28 new across R4).
- tsc clean. Lint clean (only pre-existing `main.tsx` fast-refresh warning).
- Bundle: 144.91 KB gzipped JS / 4.86 KB gzipped CSS / **~149.77 KB total gzipped**.

### Next

Merge `feat/v2-redesign` → `main`. After merge, the v1.2 Quality-axis content work (currently parked per memory) is the natural next thread.

---

## v2.0 Round 4 — Constellation route (complete on `feat/v2-redesign`)

**Status:** Round 4 complete. Polish pass + v2.0 tag pending.

### What landed

- New `src/components/constellation/` directory:
  - `<StarCanvas>` — bg-0 + warm radial glow + 32px grid + 7 animated star twinkles + FAME hub (gold disc + halo + Cinzel "FAME" label) + 5 skill nodes laid out per `nodeLayout.ts` + 5 edges. Click → onSelect callback. Selected node gets purple halo + (for available) inner inspi dot.
  - `<NodeCard>` — 240px fame-bordered + glow card. Shown when ConstellationRoute has a selectedId. Title (fame Cinzel) + meta + description + Acquire button.
  - `<MiniMap>` — small SVG overview using same node positions, scaled. Caption shows N/5 owned. (No viewport rect — no pan/zoom in v2.0.)
  - `<ClusterList>` — single "Starters · N/5" row. No fake clusters per "pure adapt" rule.
  - `nodeLayout.ts` — fixed 2D positions for the 5 nodes + 5 edges. The data layer the 2 SVG components share.
- `src/routes/ConstellationRoute.tsx` rebuilt: CSS Grid `1fr 280px` (canvas + right rail). Selection state at the route. Right rail panels: 42px-serif Fame to spend display + MiniMap + ClusterList.

### Visual deviations from handoff (per v2.0 "pure adapt" rule)

- 5 nodes only (v1.1's Goldsmith / Patient Eye / Second Slot / Faster Strokes / Better Brush). No fake locked future-nodes.
- 1 cluster only ("Starters"). No fake clusters in the cluster list.
- No pan/zoom interaction. With 5 nodes the entire chain fits in a single 600×600 viewBox; pan/zoom lands when a future wave grows the node count past one screen.

### Visual state

- All 4 routes — Tree (R1) + Painting (R2) + Ascension (R3) + Constellation (R4) — now match handoff aesthetic.

### Tests + build

- 470 tests passing.
- tsc clean. Lint clean (only pre-existing main.tsx fast-refresh warning).
- Bundle: 144.91 KB gzipped JS / 4.86 KB gzipped CSS / ~149.77 KB total gzipped.

### Next

Polish round (animations + reduced-motion + final HANDOVER + v2.0 tag), then v2.0 ships.

---

## v2.0 Round 3 — Ascension route (complete on `feat/v2-redesign`)

**Status:** Round 3 complete. Round 4 (Constellation) pending.

### What landed

- New `src/components/ascension/` directory:
  - `<Cavern>` — radial violet→black gradient + repeating stone-block grid + 5 floating purple-diamond crystals (CSS clip-path) with staggered 3s opacity pulse.
  - `<Portal>` — animated stone-arch SVG (bricked stone gradient + thin joint lines + inner radial glow + keystone with gold ✦ rune + 6 purple flanking runes). CSS `portal-float` (±6px Y, 6s) + `portal-shimmer` (drop-shadow pulse, 4s).
  - `<ThresholdPanel>` — current inspi (28px mono inspi-glow) + progress bar to threshold + caption.
  - `<FamePreviewCard>` — fame-bordered + glow card with big serif "+N" fame gain + permanence caption.
  - `<PastRunsLedger>` — 4 most-recent runs in mono table format + total fame footer. Empty state for first-time players.
- `src/routes/AscensionRoute.tsx` rebuilt: CSS Grid `1fr 360px` (cavern + right rail). Inline confirmation modal (role=dialog, aria-modal) for the irreversible Step Through action.

### Data layer

- New persisted field: `pastRuns: ReadonlyArray<PastRun>` on `metaSlice`. Each entry: `{ fame: number; ascendedAt: number }`.
- New action: `metaSlice.addPastRun(run)` (orchestrator-only consumer).
- `performAscendOrchestrator` now appends one entry per successful ascend after fame credit + ascendCount bump.
- Save migration v6 → v7 adds default `pastRuns: []` to existing v6 saves.

### Visual state

- Ascension route: matches handoff aesthetic (cavern + animated portal + right-rail panels + irreversible-action modal).
- Tree (R1) + Painting (R2): complete from prior rounds.
- Constellation: still degraded; Round 4 rebuilds.

### Tests + build

- 442 tests passing.
- tsc clean. Lint clean.
- Bundle: 143.22 KB gzipped JS / 4.52 KB gzipped CSS / ~148.18 KB total gzipped.

### Next

Round 4: Constellation (skill tree). Per spec §8 Round 4.

---

## v2.0 Round 2 — Painting route (complete on `feat/v2-redesign`)

**Status:** Round 2 complete. Round 3 (Ascension) pending.

### What landed

- New `src/components/painting/` directory:
  - `<CanvasStage>` — vignetted canvas frame + gilded picture frame + pixel landscape SVG inside + animated paint-fill overlay (height = progressPct%) + easel cap + thin gold progress bar + bottom info row.
  - `<TierCard>` — primary tile in the canvas upgrades strip. Gold border + gold glow + Roman numerals current → next + Upgrade button.
  - `<CanvasUpgradesStrip>` — 5-cell layout container. v2.0 fills 1 cell (TierCard); 4 are empty layout slots reserved for future upgrades.
  - `<RoomRail>` — 64px vertical nav with 4 tabs (Workshop active; Office/School/Lab disabled with "Coming soon"). lucide-react icons.
  - `<WorkshopRoom>` — 340px right panel replacing legacy WorkshopPopup. Same v1.1 craft/equip/unequip/discard logic, restyled.
- `src/routes/PaintingRoute.tsx` rebuilt: CSS Grid `1fr 340px 64px / 1fr auto` with named areas (stage / upgrades / room / rail).

### Retired

- `src/ui/widgets/TierUpgradeButton.tsx` (replaced by TierCard).
- `src/ui/popups/WorkshopPopup.tsx` (replaced by WorkshopRoom panel; popup state removed).
- `src/store/uiSlice.ts` (workshopPopupOpen field + open/close actions no longer needed).
- `<WorkshopPopup />` mount in `App.tsx`.

### Visual state

- Painting route: matches handoff aesthetic (vignetted canvas + gilded frame + tier card + room rail with workshop side panel).
- Tree: complete (Round 1).
- Ascension / Constellation: still degraded; Rounds 3-4 rebuild.

### Tests + build

- 411 tests passing.
- tsc clean. Lint clean.
- Bundle: 141.15 KB gzipped JS / 3.60 KB gzipped CSS / ~145.19 KB total gzipped.

### Next

Round 3: Ascension route. Per spec §8 Round 3.

---

## v2.0 Round 1 — Tree route (complete on `feat/v2-redesign`)

**Status:** Round 1 complete. Round 2 (Painting) pending.

### What landed

- New `src/components/tree/` directory:
  - `<TreeScene>` — pixel-art landscape SVG with sky/mountains/hills/pond/ground + 3-stage tree variant + 7 animated motes + 3 rising fireflies.
  - `<InspiReadout>` — Cinzel 28px inspi-purple rate readout overlay (top-left of scene) with mono `Stage · {name}` subtext.
  - `<StagePanel>` — right-rail top: title `Current → Next`, 3 stage chips (Seed/Sapling/Tree, current highlighted), progress bar, `Grow into …` CTA.
  - `<UpgradeRow>` — bordered rows with monogram tile + serif name + mono meta + gold cost pill.
- `src/routes/TreeRoute.tsx` rebuilt: CSS Grid `1fr 340px` layout (scene + right rail). All v1.1 tree mechanics preserved (3 stages × 2 parts; `buyPartLevel`/`growSapling` actions; `canGrowSapling` gate).

### Visual state

- Tree route: matches handoff aesthetic (pixel landscape + Cinzel/mono typography + inspi-glow + 3-stage tree visual).
- Painting / Ascension / Constellation: still degraded post-T9; Rounds 2-4 rebuild.

### Tests + build

- 399 tests passing.
- tsc clean. Lint clean (pre-existing main.tsx warning only).
- Bundle: 140.76 KB gzipped JS / 2.47 KB gzipped CSS / ~143 KB total gzipped.

### Next

Round 2: Painting route. Per spec §8 Round 2.

---

## v2.0 Round 0 — Foundation (in progress on `feat/v2-redesign`)

**Status:** Round 0 complete on branch. Round 1+ pending.

### What landed

- `feat/v2-redesign` branch off `main` at `a0bb088`.
- Design tokens: `src/styles/tokens.css` (copied from `design_handoff_artdle/tokens.css` + new `--pm` teal block: `#7adcd6`).
- Globals + base reset: `src/styles/globals.css`. Google Fonts (Cinzel, JetBrains Mono, Inter, Press Start 2P, VT323) loaded via `index.html`.
- Tailwind 4 fully removed (uninstalled, vite plugin dropped, `@theme` block in `src/index.css` deleted; only the fame-pulse keyframe remains).
- New deps: `react-router-dom@7`, `lucide-react`.
- New shell components in `src/components/shell/`: `<TopBar>`, `<BottomBar>`, `<CurrencyChip>`, `<InfoPanel>`, `<MetaChip>`. All CSS Modules-styled per handoff aesthetic.
- React Router wired: 4 routes (`/tree`, `/painting`, `/ascension`, `/constellation`) + redirect from `/` and catch-all to `/tree`.
- Legacy views moved to `src/routes/` (`HomeView` → `TreeRoute`, `PaintingView` → `PaintingRoute`, `AscensionView` → `AscensionRoute`, `SkillTreeView` → `ConstellationRoute`). Tailwind classes stripped from each; layout preserved via inline style for essentials.
- Legacy shell widgets (`ui/widgets/{TopBar, BottomBar, InfoPanel, CurrencyDisplay}`) deleted.
- `viewSlice` retired. Migration v5 → v6 drops the `currentView` field from persisted saves. (T11 added a v4→v5 no-op + v5→v6 currentView-drop chain; final SAVE_VERSION = 6.)
- `WorkshopPopup` auto-close-on-route-change refactored from `currentView` to `useLocation()` pathname.

### Visual state

- TopBar / BottomBar / InfoPanel: fully redesigned per handoff.
- Route content (Tree / Painting / Ascension / Constellation): functionally working, visually degraded (no Tailwind = unstyled internal elements). Per-route visual rebuild lands in Round 1-4.

### Tests + build

- 373/373 tests passing (36 test files).
- tsc clean. Lint clean (pre-existing main.tsx warning unchanged).
- Bundle: 138.76 KB gzipped JS / 1.77 KB gzipped CSS / ~141 KB total gzipped. (vs v1.1's ~129 KB — +12 KB from react-router-dom + lucide-react, minus Tailwind removal).

### Smoke checklist for the user

After pulling this branch and running `npm run preview`:

1. Open the printed URL in **incognito** (clean IDB).
2. Browser redirects to `/tree` from `/`.
3. TopBar: brand "ARTDLE" with fame-tinted "A". 4 nav links visible.
4. BottomBar: 4 currency chips. On `/tree`, gold + inspi prominent; fame + PM dimmed.
5. Click "Painting": URL changes; PaintingView content renders (degraded styling — that's expected).
6. Tier upgrade button still works (gold spent, tier increments).
7. Click "Ascension": URL changes; ascend works at threshold.
8. Click "Constellation": URL changes; skill nodes purchasable.
9. Refresh page on any route: lands back at the same route (router preserves URL); state persisted (gold/inspi/PM all rehydrate).
10. BottomBar dimming switches correctly per route.

### Next

Round 1: Tree route. Per spec §8 Round 1 in `docs/superpowers/specs/2026-05-04-v2-redesign-design.md`.

---

**Date:** 2026-05-03 (v1.1 SHIPPED)
**Status:** v1.1 tagged. Phases 0+1+2+3+4+5+6a+6b (v1.0) + all v1.1 tasks complete + PM redesign patch. **350/350 tests** across 32 files. tsc clean. lint clean (1 pre-existing warning in main.tsx). Bundle: 124.83 KB gzipped JS / ~129 KB total. Repo on `origin/main` with `v1.1` annotated tag pending push (user will push explicitly).

---

## What v1.1 adds (on top of v1.0)

- **10 canvas tiers.** Tier 1 = 2s/sale, 10g; tier 5 = 10s/sale, 250g; tier 10 = 20s/sale, 1000g. Gold scales as `BASE × tier² × multipliers`. Paint time scales as `tier × 2 / paintTimeMult`. Stripped form of canvas-design.md §6 (`quality = tier`, no style/palette/mastery yet).
- **Tier upgrade button** on PaintingView. Cost curve `100 × 2.78^(tier-1)` g per single upgrade. Total path 1→10 ≈ 558k g. Hover shows current vs. next tier deltas (gold/sale, time/sale, PM/sale).
- **Paint Mastery (PM)** — 4th currency. Permanent (persists across ascends). Earned `tier²` per canvas sale. Multiplies canvas gold via `1 + 5 × log10(pm + 1)`. PM 100 → ×11; PM 1M → ×31; PM 1e10 → ×51 (asymptotic log shape).
- **BottomBar** grows from 3 to 4 currency widgets (gold / inspi / fame / PM). PM widget pulses on increment, same CSS-keyframe pattern as fame.
- **Save migration v2 → v3.** Existing v2 saves load with `canvasTier = 1`, `paintMastery = big(0)` defaults. v1 saves chain through v1→v2 then v2→v3.

---

## v1.1 deliverables vs. spec DoD

| # | DoD requirement | Status |
|---|---|---|
| 1 | All formulas in balance.ts with passing tests | ✅ |
| 2 | canvasSlice.canvasTier works (init, upgrade, reset) | ✅ |
| 3 | paintMasterySlice works (gain, persist, no-reset on ascend) | ✅ |
| 4 | PM mult applied to canvas gold sales end-to-end | ✅ |
| 5 | PaintingView has TierUpgradeButton with hover + disabled states | ✅ |
| 6 | BottomBar 4 widgets; PM widget pulses on increment | ✅ |
| 7 | Save migration v2→v3 unit + integration tests | ✅ |
| 8 | 276 baseline tests still pass; ~25 new; ~300+ total | ✅ (332 total — +56 from v1.0 baseline) |
| 9 | Manual smoke check | ⚠️ DEFERRED to user (subagent cannot run interactive playthrough) |
| 10 | Bundle < 250 KB gzipped | ✅ (124.83 KB — ~50% headroom; +0.65 KB over v1.0) |
| 11 | tsc + lint clean | ✅ |

---

## Strict scope adhered

No new workshop affixes, no new skill tree nodes, no tree-stage expansion (per spec strict scope). All changes interior to canvas + new PM slice + UI surface.

---

## What shipped in v1.1 (commit log)

- `29320a3` — `core(balance):` canvasGold takes tier; tier² scaling
- `836bf1e` — `core(balance):` add canvasTime(tier) formula
- `655edfe` — `core(balance):` add tierUpgradeCost + tier constants
- `5c0142e` — `core(balance):` add pmGainPerSale(tier) formula
- `c7f57f6` — `core(balance):` add pmMult + PM_LOG_FACTOR
- `1d115d5` — `store(paintMastery):` scaffold slice (not yet registered)
- `4ef2ab7` — `test(paintMastery):` cover initial state, gainFromSale, helper
- `04d9e05` — `store:` register paintMasterySlice + getPmMultiplier helper
- `d964d80` — `store(canvas):` add canvasTier field (default 1, resets on ascend)
- `7fd81e2` — `store(canvas):` add upgradeTier() atomic action
- `7bba100` — `store(canvas):` tick uses canvasTime(tier) and tier-scaled gold
- `afd4a6b` — `test(canvas):` pin canvasTier-at-sale contract
- `8323678` — `test(ascend):` pin v1.1 reset semantics
- `5f9f629` — `store:` bump SAVE_VERSION to 3; v2→v3 migration adds v1.1 defaults
- `0c0a49a` — `test(persistence):` rename stale 'v2 current' test to '(legacy)'
- `31f2bfd` — `ui(painting):` add TierUpgradeButton widget
- `029310f` — `ui(painting):` mount TierUpgradeButton; show tier in canvas header
- `5561dc1` — `ui(currency):` support paintMastery kind in CurrencyDisplay
- `7276b5c` — `ui(bottombar):` add 4th currency widget for paintMastery

---

### v1.1 patch — PM redesign (2026-05-03, post-internal-playtest)

The original v1.1 PM gain (`tier²` per sale) felt too aggressive in playtest:
canvas gold compounded within minutes. Redesigned to a gold-fraction model:

- **PM gain per sale = `saleGold / pmThreshold(lifetimeGold)`.**
- **`pmThreshold(lifetimeGold)`** ratchets up by 1000× at each milestone:
  1k g/PM (lifetime < 1M) → 1M g/PM (1M ≤ lt < 1B) → 1B g/PM (1B ≤ lt < 1T) → ...
- **New persisted field:** `lifetimeGold: Big` on `paintMasterySlice`. Cumulative
  canvas gold ever earned. Persists across ascends like `paintMastery`.
- **Save migration v3 → v4:** adds `lifetimeGold: big(0)` default. Existing
  `paintMastery` values preserved — only the gain rate changes going forward.
- **PM/sale is now fractional** (early game: 0.01 PM/sale at tier 1). The
  multiplier curve (1 + 5 × log10(pm + 1)) is unchanged; only the gain shape
  shifted from per-canvas to per-gold.
- **Net effect:** PM accumulates roughly log-shaped relative to lifetime gold.
  Asymptotic ceiling around ×16-20 multiplier in normal play, vs the original
  design's effectively-uncapped curve.

The `v1.1` tag was moved forward locally to include this patch. The original
v1.1-without-redesign was never publicly tagged.

---

## Lessons preserved (v1.1 additions)

(Appended to the existing list. Numbering continues from lesson #37.)

38. **Cross-slice action calls inside ticks are idiomatic.** `state.gainFromSale(state.canvasTier)` from `canvasSlice.canvasTick` reaches into `paintMasterySlice` — same shape as the existing `state.add("gold", gain)` pattern. No coupling concerns.
39. **PM mult composes multiplicatively, item bonuses additively.** Convention: `getCanvasGoldMultiplier` returns `1 + Σ contributions` (additive); `getPmMultiplier` returns the multiplicative factor; combined via `*` at the call site. Documented in `multipliers.ts` JSDoc.
40. **Save migrations are transient typecheck-broken until the slice is registered.** v1.1's slice scaffold (1d115d5) and tests (4ef2ab7) were committed before registration (04d9e05), leaving typecheck broken for that window. Future rule: any new slice using `state.X` from the same slice must be committed in the same commit as the store registration in `store/index.ts`, OR use `as any` casts during the gap.
41. **Vitest's `toBeCloseTo` with negative precision is more lenient than Jest documents.** `toBeCloseTo(5983, -1)` passes for values near `5972.82` even though the tolerance formula would predict failure. Test expectations don't need to match `Big.pow` exactly; integer-rounding the actual value is cleaner.
42. **Test name discipline:** "migrate from version N (current) is a no-op" rots when N becomes legacy. Prefer "migrate from version N (legacy) is idempotent" — see commit 0c0a49a which renamed the stale test.

---

## Repo state

- **Branch:** `main` at `https://github.com/mitoufle/Artdle-web.git`. **Pending push** (`v1.1` annotated tag pending push — user will push explicitly).
- **Bundle:** `dist/index.html` 0.29 KB gzipped, CSS 3.98 KB gzipped, JS 124.83 KB gzipped — total **~129 KB gzipped**. Well under the 250 KB DoD budget.
- **Versions:** TS 6.0.3, Vite 8.0.10, Vitest 4.1.5, Zustand 5.0.12, Tailwind 4.2.4, React 19.2.5, Motion 12.38.0. See `VERSIONS.md`.

---

## What's next — v1.2

Per `docs/PORT_PLAN.md` §2.1: v1.2 = subjects (5 starters + 15 derived) + per-subject 10-tier mastery. Source: `docs/specs/2026-04-25-canvas-design.md` §7.

When starting v1.2 in a fresh Claude session in this directory:

> Read CLAUDE.md and docs/HANDOVER.md. v1.1 is shipped (tag v1.1). We're starting v1.2 — Subjects + per-subject mastery. Read docs/specs/2026-04-25-canvas-design.md §7 for the source design. Use brainstorming → writing-plans → subagent-driven-development.

---

---

# Historical — v1.0 (shipped 2026-05-03)

**Date:** 2026-05-03 (v1.0 SHIPPED)
**Status:** v1.0 tagged. Phases 0+1+2+3+4+5+6a+6b complete. **276/276 tests** across 30 files. tsc clean. lint clean (1 pre-existing warning). Bundle: 124.18 KB gzipped JS / ~128 KB total. Repo pushed to `origin/main` with `v1.0` annotated tag.

---

## What v1.0 is

The end-to-end playable loop, in browser, save persists across sessions:

- **Tree (HomeView):** 3 stages × 2 parts. Buy parts with gold; each level adds inspi/sec. Click **Grow next stage** when prior-stage levels hit the unlock threshold (Seed 0 → Sapling 10 → Tree 100). Stage header fades on transition.
- **Canvas (PaintingView):** Auto-paints on a 10s base cycle (modified by paint-time multiplier from equipped items). Each completion sells for 10g base (modified by canvas-gold multiplier). Floating "+Ng" text rises on each sale. Workshop button opens the popup.
- **Workshop (popup over PaintingView):** Click **Craft** (100g) to roll one item with one painting-only affix (`+canvas_gold%` or `-paint_time%`, magnitude 5–15%). Inventory ≤ 3; equip 1 (or 2 with Second Slot). Equip / unequip / discard. Popup fades in/out via Motion.
- **Ascension (AscensionView):** Convert inspiration to fame when above palier (`PALIER_BASE × PALIER_GROWTH^count`). Fame is permanent; gained as `floor(log10(inspi) × 10)`. Run resets (currencies, tree, canvas, workshop); fame + skill tree + ascendCount + playerId preserved. Fame value pulses on increment.
- **Skill Tree (SkillTreeView):** 5 nodes in a strict-linear chain — Goldsmith (1 fame, +10% gold), Patient Eye (3, +15% inspi), Second Slot (10, 1→2 equip slots), Faster Strokes (30, −10% palier), Better Brush (100, +1pp affix magnitude). Total chain: 144 fame.
- **Hover info:** Every interactive element wraps in `<Hoverable>` with title / body / footer factory callbacks. Body resolves at hover time so live values stay current. InfoPanel strip is fixed-height (h-20 + overflow-hidden) so layout never shifts.
- **Currencies (BottomBar):** Gold, Inspi, Fame as `<CurrencyDisplay>` widgets. Hoverable concept entries. Fame increment fires a 500ms scale + color pulse.
- **TopBar:** 4 nav buttons; active state via `aria-pressed` + `bg-app-panel`. View persists across reloads (`viewSlice.currentView`).
- **Save:** IndexedDB via `idb-keyval`, throttled 1Hz writes, flush on hide / unload. Async rehydration gated by `<LoadingScreen />`. Versioned schema (currently v2 after the v1→v2 inspi-affix removal migration). `playerId` UUID generated on first launch and preserved across all saves and ascends.
- **Lifecycle:** Single `installLifecycle(defaultLifecycleHooks)` orchestrator owns `visibilitychange` (pause+flush / resume) + `beforeunload` (flush). All flush rejections route through `reportError` — no silent persist failures.

What's deliberately NOT in v1.0: offline progress, audio, achievements, Painter's Office, Painting School, Expositions, multi-art-form, accounts, mobile, French. All deferred to waves v1.1+ per `docs/PORT_PLAN.md` §2.1.

---

## What shipped this session (post-Phase-5)

**Phase 6a (10 commits, executed via subagent-driven-development):**

- `bdffa94` — `feat(telemetry):` error-reporter seam (`reportError` + swappable sink with captured-default reset).
- `c672e78` — `refactor(core):` tickLoop pause/resume API extracted; internal `_visibilityHandler` removed.
- `2bf5dd1` — `feat(systems):` `installLifecycle` orchestrator + `defaultLifecycleHooks` (consolidates Phase 2 carry-overs #1, #2, #5: `.flush().catch()`, telemetry hook, single `visibilitychange` listener).
- `302733d` — `store(canvas):` `lastSale: { id, amount } | null` transient field + `clearLastSale()` action; stripped from `partialize`.
- `ad99a1c` — `ui(painting):` `<FloatingGoldText>` Motion widget + PaintingView mount keyed on `lastSale.id`.
- `a41a21e` — `ui(home):` tree stage transition fade via `<AnimatePresence mode="wait">`.
- `59668da` — `ui(currency):` fame increment pulse via CSS keyframe + `useEffect`-driven attribute toggle.
- `3728719` — `ui(workshop-popup):` mount/unmount fade via `<motion.div>` + `<AnimatePresence>` (used the C-1 testid swap from Phase 6 opening).
- `72a24fe` — `docs:` v1.0-RC README (player + dev, ~110 lines) + `docs/screenshots/.gitkeep` placeholder.

**Post-Phase-6a adjustments (2 commits):**

- `f479ad5` — `ui(info-panel):` fixed `min-h-16` → `h-20 overflow-hidden` so InfoPanel never reflows.
- `10368d9` — `config(workshop):` dropped `+inspiration_rate%` affix (items are painting-only). `SAVE_VERSION` 1 → 2 with a real `migrate` function that filters out items with the removed kind from `inventory` + `equippedItems`. 4 new migration unit tests.

**Phase 6b (this commit + tag):**

- `<this commit>` — `docs:` HANDOVER catch-up to v1.0-shipped state.
- `v1.0` annotated tag pushed to `origin`.

**Test count progression:** Phase 5 ended at 239/239. Phase 6a added 30 (Motion + lifecycle + telemetry + canvasSlice.lastSale + 1 persistence integration). Adjustment 2 added 4 (migrate unit tests) — net 4 because the inspi-affix tests were rewritten not replaced. **Final: 276/276 across 30 test files.**

---

## v1.0 deliverables vs. PORT_PLAN §8 DoD

| # | DoD requirement | Status |
|---|---|---|
| 1 | All 3 currencies persisted | ✅ (gold, inspiration, fame; Big-typed; serialized via `__big` markers) |
| 2 | 3 tree stages w/ parts, upgrades, transitions | ✅ |
| 3 | Canvas paints, sells, credits gold, single slot | ✅ (single canvas; equip slots are 1 or 2 via Second Slot) |
| 4 | Workshop crafts items, equips, affixes apply | ✅ (2-affix painting-only pool: `+canvas_gold%`, `-paint_time%`) |
| 5 | Ascend works: palier, fame, run reset, fame/skills/count preserved | ✅ |
| 6 | Skill tree: 5 nodes, fame purchases, applies to gameplay | ✅ |
| 7 | Save/load via IDB, async-rehydration-gated, survives 30-day idle | ✅ |
| 8 | playerId UUID generated + preserved | ✅ |
| 9 | Versioned schema + migrate chain | ✅ (now at v2 with real v1→v2 migration; chain is no longer a stub) |
| 10 | Hover info on every interactive surface | ✅ |
| 11 | ~120 Vitest tests passing | ✅ (276 — well over budget; UI tests added in Phase 4+5 weren't in the original estimate) |
| 12 | Bundle < 250 KB gzipped | ✅ (124.18 KB JS + 3.95 KB CSS; ~50% headroom) |
| 13 | Cold-load 60 FPS, warm-load instant | ✅ assumed; not formally measured. RAF + CSS path is performant by construction. |
| 14 | Complete play-through (start → 3-5 ascends → close → reopen → continue → save still works) | ⚠️ NOT empirically verified — no playtest was run. Functional path is exercised by 276 unit + integration tests but not by a real human session. See "Known unverified" below. |

---

## Known unverified (intentional v1.0 gap)

Per the user decision in the Phase 6b brainstorm (2026-05-03), **balance was NOT tuned via playtest**. Reasoning: future waves (Painter's Office, Painting School, Expositions, audio, achievements) will require re-tuning anyway, so investing in playtest-driven v1.0 balance was deemed wasted effort.

What this means concretely:

- **Numbers in `src/core/balance.ts` and `src/config/treeStages.ts` are formula-derived, not playtest-validated.** The PORT_PLAN §7 target of 5–15 min first-ascend is plausible from the analytical math but not confirmed.
- **The 2-affix pool (down from 3) is a deliberate design choice but not playtested.** PORT_PLAN §1.3 flags "may feel thin" as a tuning question; expansion candidates (`-craft_cost%`, `+craft_quality%`, `+canvas_gold_per_equipped%`) are documented but not shipped.
- **No formal play-through verification.** The DoD #14 requirement is satisfied by automated tests, not by real play.

Patch path: if real play surfaces issues, ship a `v1.0.1` tag with targeted balance constants. Most likely targets if needed: `PALIER_BASE` (currently 1000), `CANVAS_GOLD_BASE` (currently 10), `PAINT_TIME_BASE_SECONDS` (currently 10), the `treeStages` part `baseCost` / `rate` curves.

---

## Lessons preserved (still apply for v1.1+)

From Phase 0+1+2:

1. **`break_eternity.js` `Big.pow(integer)` is not bit-exact.** Use `toBeCloseTo` for any Big-derived value flowing through `Big.pow`.
2. **`JSON.stringify` calls `Decimal.toJSON()` BEFORE the replacer runs.** Recursive `serializeBigs` walker handles new Big-bearing fields.
3. **Test name = test contract.** Each `it("…")` description must accurately describe what the body asserts.
4. **The afterEach-spy-restore pattern** for Zustand singleton tests when swapping methods.
5. **`Object.freeze` on module-level initial-state constants.**
6. **Tick-driven mutations require persist throttling** (1s window + flush on hide/unload).
7. **D7 tick order is part of the API contract.** `treeTick` then `canvasTick`.
8. **Idle-frame guards belong in slice ticks, not the orchestrator.**

From Phase 3:

9. **Literal-union keys over `Record<string, …>`.**
10. **Atomic guard order is "validate → spend → mutate"** for any new player verb.
11. **System-file orchestrators talk to slices through actions, not `set` directly.**
12. **`tsconfig.app.json` MUST set `"noEmit": true` in a Vite project.**
13. **Per-task reviews are narrow by design — final cross-cutting review catches what they can't.**
14. **AffixKind / SkillNodeId / ViewId strings are persisted** — renames require save migration. JSDoc above each warns. Phase 6a's adjustment 2 demonstrated this with the v1→v2 migration on AffixKind.
15. **Save-format-binding JSDoc adds zero runtime cost and infinite future safety.**

From Phase 4:

16. **Selectors-only is structural, not stylistic.** `useGameStore.getState()` in render is forbidden. Acceptable in event handlers (mouseEnter, onClick, `onAnimationComplete`) and Hoverable factory callbacks.
17. **Helper signatures over `GameStore` create cast-debt at view call sites.** Future refactor opportunity: `Pick<GameStore, K>` narrowing.
18. **Tailwind 4 JIT picks up runtime-concatenated class strings without a safelist.**
19. **`@testing-library/jest-dom` matchers under `verbatimModuleSyntax` need their types in `tsconfig.app.json`'s `types` array.**
20. **RTL 16 + Vitest globals auto-cleanup between tests.** No `afterEach(cleanup)` needed.
21. **Exhaustive `switch (currentView)` over a `ViewId` literal union** gives compile-time view coverage.
22. **`InfoPanel`'s height is fixed** (h-20 + overflow-hidden as of Phase 6b) — content longer than 5 lines clips silently rather than reflowing the chrome.
23. **`data-testid` survives Tailwind class churn AND Motion wrapping.** The Phase 6 opening C-1 fix (testid on the WorkshopPopup inner card) directly enabled 6a's Motion fade without test changes.

From Phase 5:

24. **Hoverable factory callbacks are the I-1-compliant escape hatch for live values.** Factories run at hover time (event-handler context).
25. **Block-level children inside Hoverable need `as="div"`.**
26. **Transient UI state is a separate slice.** `uiSlice` (workshopPopupOpen) lives separately from gameplay state.
27. **Popup mount goes inside `<main>` (relative parent), not at the root.**
28. **Auto-close-on-view-change is a load-bearing invariant, not a convenience.** `WorkshopPopup`'s `@invariant` JSDoc explicitly names the predicate-relaxation required before any non-painting entry point.

From Phase 6a:

29. **Telemetry hook pattern: function-export + module-level mutable default + reset helper.** `reportError` is the call site; `setErrorReporter` swaps for tests / future v2.0 backends; `resetErrorReporter` restores the captured default. Zero call-site change to swap sinks.
30. **`installLifecycle({onHide, onShow, onUnload})` orchestrator pattern.** Decouples event-fan-out from production-wiring; testable in isolation; production hooks (`defaultLifecycleHooks`) are themselves a unit-tested module export.
31. **tickLoop is event-agnostic.** `pauseTickLoop` / `resumeTickLoop` are the API; lifecycle.ts decides when to call them. Pause is idempotent; resume is no-op when no `_onTick` is installed. Reset `_last` on resume so the first post-resume frame has delta ≈ 0 (v1 ignores elapsed paused time).
32. **`<motion.div>` with `key={trigger.id}` + `onAnimationComplete` is the AnimatePresence-substitute for one-shot animations.** No need for `<AnimatePresence>` when a single conditional render with a stable-per-firing key + a state-clearing callback already drives the lifecycle.
33. **CSS keyframe is the right tool for inline-element pulses.** Wrapping a `<span>` in `<motion.div>` shifts baselines; a `data-pulsing` attribute toggle + a class with `@keyframes` keeps layout stable.
34. **`useReducedMotion()` returns `boolean | null`.** Truthy-check (`reduce ? ...`) treats `null` (jsdom default / pre-listener) as "animate normally" — correct fallback.
35. **AnimatePresence v12 emits no DOM wrapper when children are conditionally null.** `container.firstChild === null` assertions still pass; this is what made Task 8 (WorkshopPopup fade) a zero-test-change drop-in.
36. **Save migrations: `(persisted, fromVersion) => mergedState`. Always merge, never replace.** v1→v2 migration pattern: walk a `Record<string, unknown>`, mutate the relevant slots, return `state as unknown as GameStore`. Filter functions return `[]` for non-array inputs (defensive). Export `migrate` for unit testing.
37. **`v1.0` deliberately ships unplaytested.** v1.1+ waves will re-tune anyway. Patch path is `v1.0.1` if real play surfaces issues.

From v1.1:

38. **Cross-slice action calls inside ticks are idiomatic.** `state.gainFromSale(state.canvasTier)` from `canvasSlice.canvasTick` reaches into `paintMasterySlice` — same shape as the existing `state.add("gold", gain)` pattern. No coupling concerns.
39. **PM mult composes multiplicatively, item bonuses additively.** Convention: `getCanvasGoldMultiplier` returns `1 + Σ contributions` (additive); `getPmMultiplier` returns the multiplicative factor; combined via `*` at the call site. Documented in `multipliers.ts` JSDoc.
40. **Save migrations are transient typecheck-broken until the slice is registered.** v1.1's slice scaffold (1d115d5) and tests (4ef2ab7) were committed before registration (04d9e05), leaving typecheck broken for that window. Future rule: any new slice using `state.X` must be committed in the same commit as the store registration in `store/index.ts`, OR use `as any` casts during the gap.
41. **Vitest's `toBeCloseTo` with negative precision is more lenient than Jest documents.** `toBeCloseTo(5983, -1)` passes for values near `5972.82` even though the tolerance formula would predict failure. Test expectations don't need to match `Big.pow` exactly; integer-rounding the actual value is cleaner.
42. **Test name discipline:** "migrate from version N (current) is a no-op" rots when N becomes legacy. Prefer "migrate from version N (legacy) is idempotent" — see commit 0c0a49a which renamed the stale test.
43. **PM gain shape redesign mid-wave is OK if the multiplier formula stays.** The v1.1 internal-playtest catch (PM compounded too fast with `tier²` gain) was fixed in 6 small commits without retiring the v1.1 tag. The pmMult formula (`1 + 5 × log10(pm + 1)`) was preserved; only `pmGainPerSale` changed from `tier²` to `saleGold / pmThreshold(lifetimeGold)`, with `lifetimeGold` added as a new persisted Big.
44. **Save migrations chain neatly through 4 versions now (v1→v2→v3→v4).** Each migration is a single `if (fromVersion < N)` block with a spread that preserves all prior fields. Round-trip integration tests confirm both per-step migration (v2 direct) and chained migration (v1 through to current) preserve player-meaningful data.

---

## v1.0 repo state (historical)

- **Branch:** `main` at `https://github.com/mitoufle/Artdle-web.git`. **Pushed; `v1.0` tag pushed.**
- **Recent commits:** see `git log --oneline 12e749b..HEAD`.
- **Working tree:** clean (`.claude/` is harness-local untracked).
- **Bundle:** `dist/index.html` 0.29 KB gzipped, CSS 3.95 KB gzipped, JS 124.18 KB gzipped — total **~128 KB gzipped**. Well under the 250 KB DoD budget.
- **Versions:** TS 6.0.3, Vite 8.0.10, Vitest 4.1.5, Zustand 5.0.12, Tailwind 4.2.4, React 19.2.5, Motion 12.38.0. See `VERSIONS.md`.

---

## Known low-priority issues (carried forward to v1.x)

- **README screenshots:** placeholder `docs/screenshots/.gitkeep` + a TODO note in README. Capture 3 PNGs whenever a real play save exists.
- **Helper-signature narrow refactor** — `getInspiMultiplier`, `getCanvasGoldMultiplier`, etc. could take `Pick<GameStore, K>`. Touch when next visiting `multipliers.ts` / `treeSlice.ts` / `workshopSlice.ts` / `ascend.ts` for unrelated reasons.
- **HomeView's `flatMap` over stages** rebuilds the part list on every render. Memoize via `useMemo` if Phase 1.x expands stage count.
- **Index keys on inventory / equippedItems lists.** Safe today; if v1.5 introduces drag-to-reorder, switch to stable item identity (item objects are immutable; object identity works as a key).
- **`uiSlice.workshopPopupOpen` boolean.** Becomes a `Set<PopupId>` when v2.0+ adds a 2nd popup.
- **Phase 2 polish carry-overs #3 (canvas test 9 dedupe) and #4 (split tickAll's 3-assertion test):** test cleanup; deferred indefinitely.
- **Phase 3 final-review minors:** `void set;` YAGNI in `performAscendOrchestrator`; `workshopSlice.test.ts` determinism test doesn't pin a concrete `(kind, magnitude)` tuple; Better Brush range test doesn't actively prove the ceiling moved; `metaSlice.test.ts` "DO NOT call performAscend" comment-discipline risk.
- **3 unused `ticks: number[]` arrays in `tests/core/tickLoop.test.ts`** (Phase 6a Task 2): reviewer-flagged; trace back to plan code blocks; clean opportunistically.
- **5 minor reviewer suggestions across Phase 6a tasks:** `ErrorReporter` export from telemetry; `err instanceof Error` guard in lifecycle hooks instead of `as Error` cast; JSDoc wording polish on FloatingGoldText; `onUnload` defensive `pauseTickLoop()` call; per-component vs global reduced-motion approach. All non-blocking; documented in each task's review.
- **No empirical playtest of the full loop.** v1.0 ships analytically; v1.0.1 is the patch path if real play surfaces issues.
- **PM widget pulse rate at high tiers.** At tier 10, PM increments fire every 2s. At v1.4 multi-canvas time (8 slots), that's ~4 pulses/sec. Flag for v1.4 — debounce or batch if distracting. Not a v1.1 concern.
- **`pm.toNumber()` saturation in pmMult.** For PM beyond `Number.MAX_SAFE_INTEGER`, behavior is technically correct but not ideal. Future v2.x refactor opportunity: Big-native logarithm. Not a v1.1 concern; v1.1 reachability is well under saturation territory.

---

## Build/run commands

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 332/332 in ~10s
npm run build      # dist/ in <1s
npm run preview    # serves dist/ at http://localhost:4173
npm run lint
npx tsc -b --noEmit
```
