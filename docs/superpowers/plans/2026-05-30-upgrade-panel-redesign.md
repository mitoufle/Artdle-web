# Upgrade Panel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the boxy upgrade cards with compact frameless pills (icon · name · level · cost; details on hover) in a 2-column panel, and promote the player's stroke-cycle indicator from the Speed card to a clockwise golden border sweeping around the whole panel.

**Architecture:** `TrackCard` becomes a single clickable pill. A new leaf `StrokeCycleBorder` self-subscribes to the player's `painterClocks[PLAYER_ID]` and drives a conic-gradient masked-to-border (so the panel sweeps every tick without re-rendering the pills). `BoundSpeedTrackCard` is deleted; Speed becomes a plain `TrackCard` whose rate moves to the hover breakdown.

**Tech Stack:** React 19 + TS strict, CSS Modules, Vitest + Testing Library, `@/` = `src/`. Conic-gradient + border-box mask for the sweep; inline `--fill` custom property.

**Spec:** `docs/superpowers/specs/2026-05-30-upgrade-panel-redesign-design.md`

---

## File Structure

- `src/components/painting/StrokeCycleBorder.tsx` + `.module.css` — new animated-border leaf.
- `src/components/painting/TrackCard.tsx` + `.module.css` — pill redesign.
- `src/components/painting/CanvasUpgradesStrip.tsx` + `.module.css` — 2-col frameless grid.
- `src/routes/PaintingRoute.tsx` — wiring (Speed → plain TrackCard; add border).
- Delete `src/components/painting/BoundSpeedTrackCard.tsx` + `tests/components/painting/BoundSpeedTrackCard.test.tsx`.
- Tests: new `StrokeCycleBorder.test.tsx`; update `TrackCard.test.tsx`, `CanvasUpgradesStrip.test.tsx`.

`.upgradesOverlay` styling already lives in `PaintingRoute.module.css` (absolute, `border-radius: var(--r-md)`); the border leaf overlays it at `inset:0`.

---

## Task 1: StrokeCycleBorder leaf

**Files:**
- Create: `src/components/painting/StrokeCycleBorder.tsx`, `src/components/painting/StrokeCycleBorder.module.css`
- Test: `tests/components/painting/StrokeCycleBorder.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/painting/StrokeCycleBorder.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useGameStore } from "@/store";
import { PLAYER_ID } from "@/core/canvasTickPure";
import { StrokeCycleBorder } from "@/components/painting/StrokeCycleBorder";

afterEach(cleanup);

describe("StrokeCycleBorder", () => {
  it("sets --fill to the player's clock / interval", () => {
    useGameStore.setState({ painterClocks: { [PLAYER_ID]: 2.5 } });
    const { getByTestId } = render(<StrokeCycleBorder interval={5} />);
    expect(getByTestId("stroke-cycle-border").style.getPropertyValue("--fill")).toBe("0.5");
  });

  it("clamps to 1 when the clock exceeds the interval", () => {
    useGameStore.setState({ painterClocks: { [PLAYER_ID]: 9 } });
    const { getByTestId } = render(<StrokeCycleBorder interval={5} />);
    expect(getByTestId("stroke-cycle-border").style.getPropertyValue("--fill")).toBe("1");
  });

  it("is 0 when interval is 0 (no divide-by-zero)", () => {
    useGameStore.setState({ painterClocks: { [PLAYER_ID]: 3 } });
    const { getByTestId } = render(<StrokeCycleBorder interval={0} />);
    expect(getByTestId("stroke-cycle-border").style.getPropertyValue("--fill")).toBe("0");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/components/painting/StrokeCycleBorder.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the component**

Create `src/components/painting/StrokeCycleBorder.tsx`:

```tsx
import type { JSX, CSSProperties } from "react";
import { useGameStore } from "@/store";
import { PLAYER_ID } from "@/core/canvasTickPure";
import styles from "./StrokeCycleBorder.module.css";

interface Props {
  /** Player seconds-per-stroke (chunkInterval(speedMult)). Low-frequency. */
  interval: number;
}

/**
 * Golden border around the upgrade panel that sweeps clockwise with the PLAYER's
 * stroke cycle. SELF-SUBSCRIBES to the player's `painterClocks` entry (high-freq)
 * so the panel + pills don't re-render every tick. Decorative + click-through.
 */
export function StrokeCycleBorder({ interval }: Props): JSX.Element {
  const clock = useGameStore((s) => s.painterClocks[PLAYER_ID] ?? 0);
  const fillPct = interval > 0 ? Math.max(0, Math.min(1, clock / interval)) : 0;
  return (
    <div
      className={styles.border}
      data-testid="stroke-cycle-border"
      aria-hidden="true"
      style={{ "--fill": fillPct } as CSSProperties}
    />
  );
}
```

- [ ] **Step 4: Create the CSS**

Create `src/components/painting/StrokeCycleBorder.module.css`:

```css
/* Conic-gradient masked to a thin border ring; --fill (0..1) set inline per tick.
 * Sweeps clockwise from 12 o'clock over a faint static track, snapping to 0 on
 * each player stroke. Click-through so the pills underneath stay interactive. */
.border {
  position: absolute;
  inset: 0;
  border-radius: var(--r-md);
  pointer-events: none;
  padding: 2px;
  background: conic-gradient(var(--gold) calc(var(--fill, 0) * 1turn), rgba(168, 127, 58, 0.18) 0);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  filter: drop-shadow(0 0 3px rgba(232, 176, 58, 0.4));
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/components/painting/StrokeCycleBorder.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/painting/StrokeCycleBorder.tsx src/components/painting/StrokeCycleBorder.module.css tests/components/painting/StrokeCycleBorder.test.tsx
git commit -m "ui(painting): add StrokeCycleBorder (player stroke cycle as a sweeping gold border)"
```

---

## Task 2: TrackCard → compact pill

**Files:**
- Rewrite: `src/components/painting/TrackCard.tsx`, `src/components/painting/TrackCard.module.css`
- Modify: `tests/components/painting/TrackCard.test.tsx` (first test only)

- [ ] **Step 1: Update the one failing test**

In `tests/components/painting/TrackCard.test.tsx`, the first test (`"renders track name + level + cost label when unlocked"`) asserts the now-hidden effect line and `Level 3`. Replace its body assertions (lines ~21–24) with:

```tsx
    expect(screen.getByText(/Sell Price/i)).toBeInTheDocument();
    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.getByText(/150g/)).toBeInTheDocument();
    // effect text is no longer always-visible — it moved to the hover breakdown
    expect(screen.queryByText(/\+30% gold per sale/i)).toBeNull();
```

(Leave every other test in the file unchanged — locked/MAX/disabled/click and both hover tests still hold with the new pill, which keeps `Hoverable` wrapping the button, the `track-card-upgrade-${trackId}` testid, "Locked"/"MAX" text, and the `Current effect:` + cost hover body.)

- [ ] **Step 2: Run to verify the first test fails**

Run: `npx vitest run tests/components/painting/TrackCard.test.tsx`
Expected: FAIL on the first test (`L3` / effect assertions) — the others still pass against the old card.

- [ ] **Step 3: Rewrite `TrackCard.tsx` as a pill**

Replace the entire file with:

```tsx
import type { JSX } from "react";
import styles from "./TrackCard.module.css";
import type { CanvasTrackId } from "@/store/skillTreeSlice";
import type { AffixKind } from "@/config/workshopAffixes";
import { AFFIX_SYMBOL, AFFIX_COLOR, AFFIX_SYMBOL_SCALE } from "@/config/workshopAffixes";
import { Hoverable } from "@/ui/widgets/Hoverable";
import { CurrencyAmount } from "@/ui/widgets/CurrencyAmount";

interface Props {
  trackId: CanvasTrackId;
  label: string;
  /** If iconOverride is set, affixKind is ignored for icon/color lookup. */
  affixKind?: AffixKind;
  iconOverride?: string;
  colorOverride?: string;
  level: number;
  /** If set, the pill shows "MAX" and is disabled when level >= maxLevel. */
  maxLevel?: number;
  effectLine: string;
  /** Optional live-rate string (e.g. "0.40 strokes/s") — shown in the hover body only. */
  rateLine?: string;
  costLabel: string;
  canAfford: boolean;
  locked: boolean;
  onUpgrade: () => void;
}

/**
 * Compact upgrade pill: the whole pill is the buy button (icon · name · level ·
 * cost). Effect / next-level cost / live rate live in the hover breakdown
 * (InfoPanel via Hoverable). The stroke-cycle indicator lives on the panel
 * border now (StrokeCycleBorder), not here.
 */
export function TrackCard({
  trackId, label, affixKind, iconOverride, colorOverride,
  level, maxLevel, effectLine, rateLine,
  costLabel, canAfford, locked, onUpgrade,
}: Props): JSX.Element {
  const isMaxed = typeof maxLevel === "number" && level >= maxLevel;
  const disabled = locked || !canAfford || isMaxed;
  const symbol = iconOverride ?? (affixKind ? AFFIX_SYMBOL[affixKind] : "?");
  const color = colorOverride ?? (affixKind ? AFFIX_COLOR[affixKind] : "var(--ink-2)");
  const scale = affixKind ? AFFIX_SYMBOL_SCALE[affixKind] : 1.0;
  return (
    <Hoverable
      as="div"
      title={() => locked ? `${label} — Locked` : isMaxed ? `${label} — MAX` : `${label} — Level ${level}`}
      body={() => (
        locked ? (
          <div>Unlocks via the canvas skill-tree node.</div>
        ) : isMaxed ? (
          <div>This track is at the level cap ({maxLevel}).</div>
        ) : (
          <>
            <div>Current effect:  {effectLine}</div>
            <div>Next-level cost: <CurrencyAmount kind="gold" value={costLabel} size={13} /></div>
            {rateLine ? <div>Rate: {rateLine}</div> : null}
          </>
        )
      )}
      footer={() => locked ? "Visit the constellation to purchase the unlock node." : ""}
    >
      <button
        type="button"
        className={`${styles.pill} ${locked ? styles.locked : ""}`}
        data-track-id={trackId}
        disabled={disabled}
        onClick={!disabled ? onUpgrade : undefined}
        data-testid={`track-card-upgrade-${trackId}`}
      >
        <span className={styles.symbol} style={{ color, fontSize: `${16 * scale}px` }}>{symbol}</span>
        <span className={styles.name}>{label}</span>
        <span className={styles.level}>L{level}</span>
        <span className={styles.cost}>
          {locked ? "Locked" : isMaxed ? "MAX" : <CurrencyAmount kind="gold" value={costLabel} />}
        </span>
      </button>
    </Hoverable>
  );
}
```

- [ ] **Step 4: Rewrite `TrackCard.module.css` as a pill**

Replace the entire file with:

```css
.pill {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  width: 100%;
  padding: var(--s-2) var(--s-3);
  border: 1px solid transparent;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  font-family: var(--mono);
  font-size: 11px;
  color: var(--ink-1);
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease, opacity 120ms ease;
}

.pill:hover:not(:disabled) {
  background: rgba(230, 182, 103, 0.12);
  border-color: var(--gold-d);
}

.pill:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.symbol {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  flex-shrink: 0;
  line-height: 1;
}

.name {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 600;
  color: var(--ink-0);
  white-space: nowrap;
}

.level {
  font-size: 10px;
  font-weight: 700;
  color: var(--teal);
  letter-spacing: 0.04em;
}

.cost {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-weight: 600;
  color: var(--gold);
  white-space: nowrap;
}

.locked .cost {
  color: var(--ink-3);
}
```

- [ ] **Step 5: Run the test to verify all pass**

Run: `npx vitest run tests/components/painting/TrackCard.test.tsx`
Expected: PASS (all — the first test now sees `L3` + hidden effect, the rest unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/components/painting/TrackCard.tsx src/components/painting/TrackCard.module.css tests/components/painting/TrackCard.test.tsx
git commit -m "ui(painting): redesign TrackCard as a compact pill (details on hover)"
```

---

## Task 3: CanvasUpgradesStrip → 2-column frameless grid

**Files:**
- Modify: `src/components/painting/CanvasUpgradesStrip.tsx` (the `data-cells` attribute), `src/components/painting/CanvasUpgradesStrip.module.css`
- Modify: `tests/components/painting/CanvasUpgradesStrip.test.tsx` (the 5-column test)

- [ ] **Step 1: Update the grid test**

In `tests/components/painting/CanvasUpgradesStrip.test.tsx`, replace the third test (`"uses a 5-column grid layout …"`) with:

```tsx
  it("uses a 2-column grid layout (CSS), confirmed via attribute on container", () => {
    const { container } = render(<CanvasUpgradesStrip />);
    const strip = container.firstChild as HTMLElement;
    expect(strip).toHaveAttribute("data-cols", "2");
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/components/painting/CanvasUpgradesStrip.test.tsx`
Expected: FAIL — container still has `data-cells="5"`, not `data-cols="2"`.

- [ ] **Step 3: Update the strip attribute**

In `src/components/painting/CanvasUpgradesStrip.tsx`, change `data-cells="5"` to `data-cols="2"`.

- [ ] **Step 4: Make the grid 2-column + frameless**

Replace the entire contents of `src/components/painting/CanvasUpgradesStrip.module.css` with:

```css
/* Frameless — the .upgradesOverlay panel is the only frame (and carries the
 * sweeping StrokeCycleBorder). Two compact pill columns. */
.strip {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--s-2);
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/components/painting/CanvasUpgradesStrip.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/painting/CanvasUpgradesStrip.tsx src/components/painting/CanvasUpgradesStrip.module.css tests/components/painting/CanvasUpgradesStrip.test.tsx
git commit -m "ui(painting): 2-column frameless upgrade strip"
```

---

## Task 4: Wire PaintingRoute + delete BoundSpeedTrackCard

**Files:**
- Modify: `src/routes/PaintingRoute.tsx`
- Delete: `src/components/painting/BoundSpeedTrackCard.tsx`, `tests/components/painting/BoundSpeedTrackCard.test.tsx`

- [ ] **Step 1: Swap the import**

In `src/routes/PaintingRoute.tsx`, replace the import line
`import { BoundSpeedTrackCard } from "@/components/painting/BoundSpeedTrackCard";`
with:
```tsx
import { StrokeCycleBorder } from "@/components/painting/StrokeCycleBorder";
```

- [ ] **Step 2: Add the border + convert Speed to a plain TrackCard**

In the `.upgradesOverlay` block, add `<StrokeCycleBorder interval={interval} />` as the first child (before `<CanvasUpgradesStrip>`), and replace the `<BoundSpeedTrackCard … />` element with a plain `TrackCard`:

```tsx
        <div className={styles.upgradesOverlay}>
          <StrokeCycleBorder interval={interval} />
          <CanvasUpgradesStrip>
            <TrackCard
              trackId="sell_price"
              label="Sell Price"
              affixKind="+sell_price%"
              level={sellPriceLevel}
              effectLine={`+${fmtPct(SELL_PRICE_PER_LEVEL, 0)} gold/level`}
              costLabel={`${formatBig(sellCost)}`}
              canAfford={gold.gte(sellCost)}
              locked={false}
              onUpgrade={upgradeSellPrice}
            />
            <TrackCard
              trackId="speed"
              label="Speed"
              affixKind="+speed%"
              level={speedLevel}
              effectLine={`+${fmtPct(SPEED_PER_LEVEL, 0)} speed/level`}
              rateLine={`${(interval > 0 ? 1 / interval : 0).toFixed(2)} strokes/s`}
              costLabel={`${formatBig(speedCost)}`}
              canAfford={gold.gte(speedCost)}
              locked={false}
              onUpgrade={upgradeSpeed}
            />
            <TrackCard
              trackId="crit"
              label="Crit Chance"
              iconOverride="✦"
              colorOverride="#e85c5c"
              level={critLevel}
              maxLevel={MAX_CRIT_LEVEL}
              effectLine={critLocked ? "—" : `+${fmtPct(CRIT_PER_LEVEL, 0)} crit chance/level (max L${MAX_CRIT_LEVEL})`}
              costLabel={critLocked ? "—" : `${formatBig(critCost)}`}
              canAfford={gold.gte(critCost)}
              locked={critLocked}
              onUpgrade={upgradeCrit}
            />
            <TrackCard
              trackId="combo"
              label="Combo"
              affixKind="+combo_chance%"
              level={comboLevel}
              effectLine={comboLocked ? "—" : `+${fmtPct(COMBO_PER_LEVEL, 0)} chain chance/level`}
              costLabel={comboLocked ? "—" : `${formatBig(comboCost)}`}
              canAfford={gold.gte(comboCost)}
              locked={comboLocked}
              onUpgrade={upgradeCombo}
            />
          </CanvasUpgradesStrip>
        </div>
```

- [ ] **Step 3: Delete the obsolete component + test**

```bash
git rm src/components/painting/BoundSpeedTrackCard.tsx tests/components/painting/BoundSpeedTrackCard.test.tsx
```

- [ ] **Step 4: Verify the painting suite + typecheck of touched files**

Run: `npx vitest run tests/components/painting/`
Expected: PASS — no remaining references to `BoundSpeedTrackCard` (its test is gone), and PaintingRoute still compiles (the `interval` const already exists in PaintingRoute and is passed to BoundCanvasStage; we reuse it).

- [ ] **Step 5: Commit**

```bash
git add src/routes/PaintingRoute.tsx
git commit -m "ui(painting): wire stroke-cycle border + plain Speed pill; drop BoundSpeedTrackCard"
```

---

## Task 5: Full verification + eyeball

**Files:** none (verification only)

- [ ] **Step 1: Run the painting test suite**

Run: `npx vitest run tests/components/painting/`
Expected: PASS (all). If anything else references `BoundSpeedTrackCard` or the old testids (`track-card-cycle-fill-*`, `track-card-rate-*`), fix it to the new structure.

- [ ] **Step 2: Eyeball on the dev server (`localhost:5173`, `/painting`)**

Confirm:
- The upgrade panel shows four compact pills (icon · name · `L{level}` · cost) in a 2×2 grid, frameless on the translucent panel (no double border).
- Hovering a pill shows the effect + next-level cost (and the strokes/s rate for Speed) in the InfoPanel strip.
- The panel's golden border sweeps clockwise as the player paints and snaps back on each stroke.
- Locked tracks (Crit/Combo when locked) show "Locked" and are non-clickable; MAX shows "MAX".

- [ ] **Step 3: Final confirmation**

No commit (task steps committed their own work). Report results; deploy is a separate user-approved step.

---

## Self-Review

- **Spec coverage:** compact pills (T2) ✓; frameless + 2-col (T3) ✓; effect/cost/rate on hover (T2) ✓; stroke-cycle golden border on the panel, player-driven, isolated leaf (T1, wired T4) ✓; Speed → plain TrackCard, BoundSpeedTrackCard deleted (T4) ✓; tests (T1–T4) + eyeball (T5) ✓.
- **Placeholders:** none — every step has concrete code/commands.
- **Type consistency:** `StrokeCycleBorder` prop `interval: number` defined T1, passed T4; `TrackCard` keeps `rateLine?: string` (T2) and PaintingRoute passes it for Speed (T4); `data-testid="track-card-upgrade-${trackId}"` and `data-track-id` preserved on the pill (T2) so existing tests hold; `stroke-cycle-border` testid consistent T1↔tests; `--fill` set inline (T1) consumed by `.border` CSS (T1).
- **Isolation:** the per-tick subscription is confined to `StrokeCycleBorder` (T1); the pills receive only low-frequency props, so they don't re-render each tick.
