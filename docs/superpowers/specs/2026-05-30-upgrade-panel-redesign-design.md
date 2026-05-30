# Upgrade Panel Redesign (compact pills + stroke-cycle border) — design

**Date:** 2026-05-30
**Status:** Approved (brainstorm) → ready for plan

## Problem

The canvas upgrade panel looks clunky now that it floats over the canvas: four tall,
gold-bordered vertical cards inside an already-bordered translucent panel (double-framing),
each repeating an uppercase label, "Level N", a full effect sentence, and a cost button —
plus an empty 5th grid cell. The Speed card alone carries the player's sub-stroke timing as
a background wipe.

## Goals

1. **Compact pills.** Each upgrade becomes a single pill that *is* the buy button: affix-colored
   icon · name · level · gold cost. Effect/next-cost details move to **hover** (InfoPanel).
2. **Kill the double-framing.** Pills are frameless and sit directly on the overlay panel; the
   panel is the only frame. 2×2 compact grid (not a long thin row).
3. **Promote the stroke indicator** from the Speed card to a **clockwise golden border that sweeps
   around the whole panel**, driven by the player's stroke cycle.

Non-goals (YAGNI): no new upgrade tracks, no atelier texture/theme, no per-pill effect text
(moves to hover), no change to the upgrade math or which tracks exist.

## 1. Pill (`TrackCard`) redesign

`src/components/painting/TrackCard.tsx` + `.module.css`.

- The card becomes a **single `<button>` pill** (the whole pill is clickable to buy), wrapped in
  the existing `Hoverable` so hovering pushes the breakdown to the InfoPanel.
- **Visible content (one row):** affix-colored icon (`AFFIX_SYMBOL`/`AFFIX_COLOR`, or
  `iconOverride`/`colorOverride`) · name · a small level chip `L{level}` · cost
  (`<CurrencyAmount kind="gold" value={costLabel} />`).
- **States:**
  - affordable → gold-accented, enabled.
  - can't afford → dimmed + `disabled` (no buy).
  - locked → shows `Locked` instead of cost, dimmed, `disabled`.
  - maxed (`level >= maxLevel`) → shows `MAX` instead of cost, `disabled`.
- **Hover breakdown (unchanged data, via Hoverable → InfoPanel):** title
  `{label} — Level {level}` / `… — Locked` / `… — MAX`; body = current effect line + next-level
  cost, and — when `rateLine` is provided — the live rate (e.g. `0.40 strokes/s`); footer = the
  locked hint when locked.
- **Remove** the old `cycleProgressPct` prop and `.cycleFill` element (stroke indicator → panel
  border). **Keep** the `rateLine?` prop but render it ONLY inside the hover body (no visible
  `.rate` line). Remove the now-unused `track-card-cycle-fill-*` and `track-card-rate-*` testids.
- **Keep** `data-testid="track-card-upgrade-${trackId}"` on the pill button and `data-track-id`
  on the pill (tests rely on these).

Pill CSS sketch: a flex row, `gap` small, frameless (`background: transparent; border: none`),
rounded, with a subtle hover/affordable highlight; `disabled` dims to `--ink-3`. Sized to fit
two-per-row in the overlay.

## 2. `CanvasUpgradesStrip`

`src/components/painting/CanvasUpgradesStrip.module.css` (+ minor `.tsx`).

- 5-col grid → **2-column grid** (`grid-template-columns: repeat(2, 1fr)`), small gap, frameless
  (drop the strip's own `background`/`border`/`padding` — the `.upgradesOverlay` is the frame).
- Always renders the 4 pills (Crit/Combo render as `Locked` pills when locked); no empty 5th cell.
- Keep `role="group"`, `aria-label="Canvas upgrades"`.

## 3. `StrokeCycleBorder` (new leaf)

`src/components/painting/StrokeCycleBorder.tsx` + `.module.css`.

- **Props:** `interval: number` (player seconds-per-stroke = `chunkInterval(speedMult)`, low-freq,
  from PaintingRoute).
- **Subscribes (high-freq, isolated):** `const clock = useGameStore((s) => s.painterClocks[PLAYER_ID] ?? 0)`
  (`PLAYER_ID` from `@/core/canvasTickPure`). `fillPct = interval > 0 ? clamp01(clock / interval) : 0`.
- Renders one absolutely-positioned, `pointer-events:none`, `aria-hidden` element filling the
  panel, a conic-gradient masked to the border ring, with `--fill` set inline:

```css
.border {
  position: absolute;
  inset: 0;
  border-radius: var(--r-md);   /* match .upgradesOverlay */
  pointer-events: none;
  padding: 2px;                 /* border thickness */
  background: conic-gradient(var(--gold) calc(var(--fill, 0) * 1turn), rgba(168, 127, 58, 0.18) 0);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  filter: drop-shadow(0 0 3px rgba(232, 176, 58, 0.4));
}
```

The conic sweep grows **clockwise from 12 o'clock** as the player's stroke clock advances, over a
faint static track, snapping to 0 on each stroke. `--fill` set as
`style={{ "--fill": fillPct } as CSSProperties}`.

**Why a leaf:** the panel re-renders every tick to advance the sweep, but isolating that to this
one element keeps the 4 pills (low-frequency level/cost) from re-rendering 60×/sec — matching the
existing `BoundSpeedTrackCard`/`BoundCanvasStage` subscription-isolation pattern.

## 4. PaintingRoute wiring

`src/routes/PaintingRoute.tsx` + `.module.css`.

- Inside `.upgradesOverlay`, render `<StrokeCycleBorder interval={interval} />` then the
  `<CanvasUpgradesStrip>` with **four plain `TrackCard`s** (Sell, Speed, Crit, Combo).
- **Speed becomes a plain `TrackCard`** (no longer `BoundSpeedTrackCard`): pass the computed
  `rateLine={\`${(interval > 0 ? 1 / interval : 0).toFixed(2)} strokes/s\`}` so the rate shows on
  hover.
- `.upgradesOverlay` stays absolutely positioned (it already establishes a containing block for the
  `inset:0` border child); keep its `border-radius: var(--r-md)`. Its static `border` can stay as a
  faint base under the animated arc, or be removed in favor of the border element — decide in impl
  (default: keep a faint base border).
- **Delete `BoundSpeedTrackCard.tsx`** and its import.

## Files touched

- `src/components/painting/TrackCard.tsx` + `.module.css` — pill redesign.
- `src/components/painting/CanvasUpgradesStrip.module.css` (+ `.tsx`) — 2×2 frameless grid.
- `src/components/painting/StrokeCycleBorder.tsx` + `.module.css` — new animated border leaf.
- `src/routes/PaintingRoute.tsx` + `.module.css` — wiring; Speed → plain TrackCard.
- Delete `src/components/painting/BoundSpeedTrackCard.tsx`.
- Tests: TrackCard (pill states), StrokeCycleBorder (fill from clock/interval), CanvasUpgradesStrip
  (renders pills); remove/replace BoundSpeedTrackCard test.

## Testing

Unit (Vitest + RTL):
- `TrackCard`: renders icon/name/level/cost; affordable pill is enabled and calls `onUpgrade` on
  click; unaffordable is `disabled`; locked shows `Locked` + disabled; maxed shows `MAX` + disabled;
  `track-card-upgrade-${trackId}` present; no `cycleFill` element.
- `StrokeCycleBorder`: with `interval=5` and `painterClocks[PLAYER_ID]=2.5`, the border element's
  inline `--fill` ≈ `0.5`; with `interval=0`, `--fill` = `0` (no divide-by-zero).
- `CanvasUpgradesStrip`: renders its children in a 2-col group.

Visual / eyeball (dev server): pills are compact and frameless on the panel; hovering a pill shows
the effect + next cost (and rate for Speed) in the InfoPanel; the panel's golden border sweeps
clockwise with the player's stroke cycle and snaps back per stroke. Border sweep + exact pill
spacing are visual — eyeballed, not asserted.
