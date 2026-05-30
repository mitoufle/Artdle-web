# Painting Stage Redesign (canvas widen + worker avatars) — design

**Date:** 2026-05-30
**Status:** Approved (brainstorm) → ready for plan

## Problem

The Painter's-Office / painting view isn't visually appealing. First pass at improving it:
- The canvas scene is cramped — the upgrade cards sit in a separate row *below* it, eating vertical space.
- Worker avatars are small, identical-looking, and stacked off in the right gutter.
- The per-worker bar shows stroke-cycle timing; there's no at-a-glance XP sense.

## Goals (this pass)

1. **Widen the canvas** by reclaiming the upgrades row (canvas fills the full left-column height; the aspect-locked image grows with it).
2. **Overlay the upgrade cards** on the canvas instead of below it. Reposition only — card visual redesign is explicitly deferred.
3. **Move worker avatars to flank the canvas**, larger: avatars **2 & 3 on the left edge**, **1 & 4 on the right edge**.
4. Per worker:
   - **Teal XP bar** below the portrait, wired to `worker.xp / workerXpToNext(worker.level)` (replaces the gold stroke-cycle bar).
   - **Gold stroke-cycle ring**: a thin ring around the portrait that fills **clockwise** with the stroke clock and snaps back on each stroke.
   - **Shake + tilt** animation that fires each time the worker lands a stroke.

Non-goals (YAGNI / deferred): upgrade-card visual redesign, narrowing the room panel, animating the canvas itself, name labels on the canvas avatars, configurable avatar positions.

## 1. Layout — widen canvas, overlay upgrades

`src/routes/PaintingRoute.module.css` + `src/routes/PaintingRoute.tsx`.

Current grid:
```css
grid-template-columns: 1fr 368px 64px;
grid-template-rows: 1fr auto;
grid-template-areas:
  "stage room rail"
  "upgrades room rail";
```

New grid — drop the upgrades row; stage owns the full height:
```css
grid-template-columns: 1fr 368px 64px;
grid-template-rows: 1fr;
grid-template-areas: "stage room rail";
```

In `PaintingRoute.tsx`, move the `CanvasUpgradesStrip` (the 4 `TrackCard`s) **inside** `.stageArea`, after `<WorkerAvatars />`, wrapped in a new `.upgradesOverlay` element. Remove the separate `.upgradesArea` div.

`.upgradesOverlay` styling:
```css
.upgradesOverlay {
  position: absolute;
  left: 50%;
  bottom: var(--s-3);
  transform: translateX(-50%);
  z-index: 4;                /* above canvas HUD (z 2) and avatars */
  max-width: calc(100% - 220px); /* leave the flanking avatar columns clear */
  background: rgba(10, 8, 14, 0.62);
  border: var(--border-subtle);
  border-radius: var(--r-md);
  padding: var(--s-2);
  backdrop-filter: blur(2px);
}
```
The canvas's own bottom HUD (`.progress` at `bottom:34px`, `.bottomRow` at `bottom:var(--s-3)` in `CanvasStage.module.css`) would collide with the overlay. Nudge both up so they clear it: raise `.progress` to `bottom: 96px` and `.bottomRow` to `bottom: 72px` (values tuned during impl; the intent is "HUD sits just above the upgrades overlay"). This is a CSS-only tweak in `CanvasStage.module.css`.

## 2. WorkerAvatars rewrite

`src/components/painting/WorkerAvatars.tsx` + `.module.css`. The component already self-subscribes to `roster` + `painterClocks` and is a `pointer-events:none`, `aria-hidden` overlay inside the relative `.stageArea`. Keep all of that.

### Layout: two flanking columns
- Split the roster into **left** = workers whose `avatar ∈ {2, 3}`, **right** = `avatar ∈ {1, 4}`.
- Render two absolutely-positioned columns: `.columnLeft` pinned to the stage's left edge, `.columnRight` to the right edge, each vertically centered, stacking its workers with a gap. Workers sharing an avatar number simply stack on that side.
- Portrait size **~80px** (from 48px).

### Per-worker portrait
Each worker renders (inside a `.avatar` wrapper, `data-testid="worker-avatar"`):
1. **`.ringWrap`** — a remount-keyed wrapper (see stroke detection) holding the portrait + ring; the shake/tilt animation lives here.
2. **`.portrait`** — the avatar image (`WORKER_AVATARS[w.avatar - 1]` as inline `backgroundImage`, `data-testid="worker-portrait"`), ~80px, pixelated.
3. **`.ring`** — the gold stroke-cycle ring overlaying the portrait (see below).
4. **`.xpBar` > `.xpFill`** — teal XP bar below the portrait.

### Gold stroke-cycle ring (clockwise)
A circular element layered over the portrait, filled by a conic gradient whose swept angle = the stroke-cycle fraction `clock/interval` (the existing `fillPct`, 0..1), masked to a thin annulus:
```css
.ring {
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  background: conic-gradient(var(--gold) calc(var(--fill) * 1turn), rgba(168,127,58,0.18) 0);
  -webkit-mask: radial-gradient(closest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
          mask: radial-gradient(closest-side, transparent calc(100% - 3px), #000 calc(100% - 3px));
  filter: drop-shadow(0 0 3px rgba(232,176,58,0.5));
}
```
`--fill` is set inline per render: `style={{ "--fill": fillPct }}`. Conic gradients sweep clockwise from 12 o'clock by default → matches "fills clockwise". No CSS transition on the angle (it advances each tick like the old cooldown fill).

### Teal XP bar
```css
.xpBar { width: 64px; height: 4px; border-radius: 2px; background: rgba(45,212,191,0.18); overflow: hidden; }
.xpFill { height: 100%; background: var(--teal); transition: width 200ms ease; }
```
Add `--teal: #2dd4bf;` to the palette in `src/styles/tokens.css` (where `--gold`, `--inspi`, etc. are defined). Fill width = `clamp(0,1, worker.xp.div(workerXpToNext(worker.level)).toNumber()) * 100%`.

### Shake + tilt on stroke proc
A worker "strokes" exactly when its `painterClocks[id]` **drops** (resets toward 0 after firing). Detection without extra renders (the component already re-renders every tick):
- Keep `const prevClocks = useRef<Record<string, number>>({})` and `const procNonce = useRef<Record<string, number>>({})`.
- During render, for each worker: if `clock < (prevClocks.current[id] ?? 0)`, increment `procNonce.current[id]`. Then store `prevClocks.current[id] = clock`.
- Use the nonce in the `.ringWrap` React `key`: `key={`${w.id}:${procNonce.current[w.id] ?? 0}`}`. Each stroke changes the key → React remounts `.ringWrap` → its CSS `animation` replays once.

```css
.ringWrap { animation: strokeProc 360ms ease-out; transform-origin: center bottom; }
@keyframes strokeProc {
  0%   { transform: rotate(0deg) translateX(0); }
  20%  { transform: rotate(-6deg) translateX(-2px); }
  45%  { transform: rotate(5deg) translateX(2px); }
  70%  { transform: rotate(-3deg) translateX(-1px); }
  100% { transform: rotate(0deg) translateX(0); }
}
```
(First mount also plays the animation once — harmless.)

## Files touched

- `src/routes/PaintingRoute.tsx` — move upgrades into `.stageArea`, remove `.upgradesArea`.
- `src/routes/PaintingRoute.module.css` — grid (drop upgrades row), add `.upgradesOverlay`.
- `src/components/painting/CanvasStage.module.css` — raise `.progress` / `.bottomRow` to clear the overlay.
- `src/components/painting/WorkerAvatars.tsx` — flanking columns, ring, teal XP bar, stroke-proc remount-key.
- `src/components/painting/WorkerAvatars.module.css` — columns, larger portrait, ring, xp bar, strokeProc keyframe.
- theme tokens file — add `--teal`.
- `tests/components/painting/WorkerAvatars.test.tsx` — update for the new structure.

## Testing

Unit (Vitest + RTL):
- Empty roster → renders `null` (unchanged).
- One `.avatar` per worker (unchanged count).
- The overlay layer keeps `pointer-events: none` (unchanged).
- Each portrait's `backgroundImage` matches its `worker_{avatar}` (unchanged).
- **New:** a worker with `avatar` 2 or 3 renders inside `.columnLeft` (`data-testid="worker-column-left"`); `avatar` 1 or 4 inside `.columnRight` (`data-testid="worker-column-right"`).
- **New:** XP fill width reflects `xp/xpToNext` — set `xp` to half of `workerXpToNext(level)` and assert the fill element's inline width ≈ `50%` (or expose it via a `data-testid="worker-xp-fill"`).

Visual / eyeball (dev server): canvas is visibly larger; upgrades float at bottom-center; avatars flank left/right and are larger; gold ring sweeps clockwise and resets per stroke; XP bar is teal; a shake+tilt fires on each stroke. Ring angle and stroke-proc timing are inherently visual — not asserted in unit tests.
