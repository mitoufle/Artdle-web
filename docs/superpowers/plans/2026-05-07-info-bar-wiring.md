# Info Bar Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the bottom `<InfoPanel>` (currently inert) so every interactive surface in the game pushes contextual information on hover — costs, formulas, breakdowns, unlock chains.

**Architecture:** All hover wiring goes through the existing `<Hoverable>` widget at `src/ui/widgets/Hoverable.tsx`, which pushes to `hoverInfoSlice`. Static text uses string props; live values (costs, multipliers, probabilities) use factory callbacks `() => string | ReactNode` that resolve at hover time inside the mouseEnter handler — this satisfies the I-1 view-subscription rule (the wrapped component does not re-render on every state change).

**Tech Stack:** Existing `<Hoverable>` + `hoverInfoSlice` (no new infra). Tests use Vitest + RTL `fireEvent.mouseEnter` and assert on `useGameStore.getState().hoverTitle / hoverBody`.

---

## File Structure

**Modify (no new files):**
- `src/components/painting/WorkshopRoom.tsx` — craft button, level header, inventory items, equipped slots
- `src/components/painting/CanvasUpgradesStrip.tsx` or `TierCard.tsx` — tier upgrade hover
- `src/components/painting/CanvasStage.tsx` — sell/canvas hover
- `src/components/tree/UpgradeRow.tsx` — per-part hover
- `src/components/tree/StagePanel.tsx` — stage advancement hover
- `src/components/constellation/NodeCard.tsx` — selected node hover preview
- `src/components/constellation/StarCanvas.tsx` — FAME hub hover (and possibly per-node hover if not already there)
- `src/components/shell/CurrencyChip.tsx` — Gold / Inspi / Fame hover
- `src/routes/AscensionRoute.tsx` — Step Through button hover
- `src/components/ascension/ThresholdPanel.tsx` — curve preview hover

**Tests added (mirror src structure):**
- `tests/components/painting/WorkshopRoom.hover.test.tsx`
- `tests/components/painting/CanvasUpgrades.hover.test.tsx` (or TierCard.hover)
- `tests/components/painting/CanvasStage.hover.test.tsx`
- `tests/components/tree/UpgradeRow.hover.test.tsx`
- `tests/components/tree/StagePanel.hover.test.tsx`
- `tests/components/constellation/NodeCard.hover.test.tsx`
- `tests/components/constellation/StarCanvas.hover.test.tsx`
- `tests/components/shell/CurrencyChip.hover.test.tsx`
- `tests/routes/AscensionRoute.hover.test.tsx`
- `tests/components/ascension/ThresholdPanel.hover.test.tsx`

## Conventions

- **Use factory props for live data.** Costs, probabilities, formula breakdowns must call selectors at hover time, not capture stale closures: `<Hoverable title="Craft" body={() => formatBody(useGameStore.getState())}>`. Static labels can be plain strings.
- **`as` prop:** default is `"span"` (inline). Use `as="div"` only when wrapping block-level children (the wrapped element forwards `onMouseEnter`/`Leave` — wrapping a `<button>` inside `<span>` is fine).
- **Test pattern:**
  ```ts
  fireEvent.mouseEnter(screen.getByTestId("..."));
  expect(useGameStore.getState().hoverTitle).toBe("...");
  expect(useGameStore.getState().hoverBody).toMatch(/.../);
  ```
  When body is a ReactNode tree, render it via `render(<>{useGameStore.getState().hoverBody}</>)` then query.
- **Copy style:** title in Title Case, body uses short bullet-style lines. Numbers formatted with `formatBig` for currencies, plain numbers for counts/percentages, percentages as `XX.X%` (one decimal max).

---

## Task 1: Workshop — Craft Button hover

**Files:**
- Modify: `src/components/painting/WorkshopRoom.tsx`
- Test: `tests/components/painting/WorkshopRoom.hover.test.tsx`

**Title:** `"Craft Item"`
**Body factory:** Reads `workshopLevel` from store, calls `craftCost(level)` and `computeTierProbabilities(level)`. Returns:
```
Cost: <formatBig(cost)> g
─────
Normal:    XX.X%
Magic:     XX.X%   (unlocks Lv 5)
Rare:       X.XX%   (unlocks Lv 15)
Epic:       X.XX%   (unlocks Lv 35)
Legendary:  X.XX%   (unlocks Lv 70)
```
Tiers below their unlock level render as `—` instead of a percent.

**Footer:** `"Craft consumes gold + 1 XP."` (static)

- [ ] **Step 1: Write the failing test**

```ts
// tests/components/painting/WorkshopRoom.hover.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkshopRoom } from "@/components/painting/WorkshopRoom";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

describe("WorkshopRoom hover wiring", () => {
  beforeEach(() => {
    useGameStore.setState({
      workshopLevel: 1, workshopXp: 0,
      gold: big(0), inventory: [], equipped: {},
      purchasedNodes: {},
      hoverTitle: "", hoverBody: "", hoverFooter: "",
    });
  });

  it("Craft button hover pushes title 'Craft Item' and body with cost + Normal probability", () => {
    render(<WorkshopRoom />);
    fireEvent.mouseEnter(screen.getByTestId("craft-button"));
    expect(useGameStore.getState().hoverTitle).toBe("Craft Item");
    const bodyText = String(useGameStore.getState().hoverBody);
    expect(bodyText).toMatch(/Cost:/);
    expect(bodyText).toMatch(/Normal/);
  });

  it("Craft button hover at Lv 1 shows '—' for locked tiers (Magic, Rare, Epic, Legendary)", () => {
    render(<WorkshopRoom />);
    fireEvent.mouseEnter(screen.getByTestId("craft-button"));
    const bodyText = String(useGameStore.getState().hoverBody);
    expect(bodyText).toMatch(/Magic[^\n]*—/);
    expect(bodyText).toMatch(/Legendary[^\n]*—/);
  });

  it("Craft button hover at Lv 70 shows non-zero probability for all tiers", () => {
    useGameStore.setState({ workshopLevel: 70 });
    render(<WorkshopRoom />);
    fireEvent.mouseEnter(screen.getByTestId("craft-button"));
    const bodyText = String(useGameStore.getState().hoverBody);
    expect(bodyText).toMatch(/Legendary[^\n]*\d+\.\d+%/);
  });

  it("Mouse leave clears hoverTitle", () => {
    render(<WorkshopRoom />);
    fireEvent.mouseEnter(screen.getByTestId("craft-button"));
    fireEvent.mouseLeave(screen.getByTestId("craft-button"));
    expect(useGameStore.getState().hoverTitle).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

`npx vitest run tests/components/painting/WorkshopRoom.hover.test.tsx` — expect 4 failures with empty `hoverTitle`.

- [ ] **Step 3: Implement the wiring in WorkshopRoom.tsx**

Add a helper `craftHoverBody(state)` next to `WorkshopRoom`. Wrap the existing `<button data-testid="craft-button">` in `<Hoverable>`:

```tsx
import { Hoverable } from "@/ui/widgets/Hoverable";
import { computeTierProbabilities, ALL_ITEM_TIERS, TIER_UNLOCK_LEVEL } from "@/core/workshopRoll";

function craftHoverBody(): JSX.Element {
  const s = useGameStore.getState();
  const level = s.workshopLevel;
  const cost = craftCost(level);
  const probs = computeTierProbabilities(level);
  return (
    <>
      <div>Cost: {formatBig(cost)} g</div>
      <div>───</div>
      {ALL_ITEM_TIERS.map((t) => {
        const unlock = TIER_UNLOCK_LEVEL[t];
        const locked = level < unlock;
        return (
          <div key={t}>
            {TIER_LABEL[t]}: {locked ? "—" : (probs[t] * 100).toFixed(2) + "%"}
            {locked ? `  (unlocks Lv ${unlock})` : ""}
          </div>
        );
      })}
    </>
  );
}

// in the JSX:
<Hoverable title="Craft Item" body={() => craftHoverBody()} footer="Craft consumes gold + 1 XP.">
  <button type="button" className={styles.craftBtn} disabled={!canCraft} onClick={() => craft()} data-testid="craft-button">
    Craft · {formatBig(cost)} g
  </button>
</Hoverable>
```

- [ ] **Step 4: Run tests, verify pass**

`npx vitest run tests/components/painting/WorkshopRoom.hover.test.tsx` — 4/4 pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/painting/WorkshopRoom.tsx tests/components/painting/WorkshopRoom.hover.test.tsx
git commit -m "ui(workshop): hover info on craft button — cost + tier probability table"
```

---

## Task 2: Workshop — Level header hover (XP + tier-unlock milestones)

**Files:**
- Modify: `src/components/painting/WorkshopRoom.tsx`
- Test: append cases to `tests/components/painting/WorkshopRoom.hover.test.tsx`

**Title:** `"Workshop Lv {level}"`
**Body factory:**
```
XP: <xp> / <xpToNext(level)>
─────
Tier unlocks:
  Magic at Lv 5     (✓ if level ≥ 5, ⋯ otherwise)
  Rare at Lv 15
  Epic at Lv 35
  Legendary at Lv 70
```
**Footer:** `"+1 XP per craft."`

The level header is the `<header>` block at lines ~43-54. Wrap it with `as="div"` since it contains block-level elements.

- [ ] **Step 1: Write failing test**

```ts
it("Workshop level header hover shows current XP and tier unlock list", () => {
  useGameStore.setState({ workshopLevel: 7, workshopXp: 12 });
  render(<WorkshopRoom />);
  fireEvent.mouseEnter(screen.getByTestId("workshop-level-header"));
  expect(useGameStore.getState().hoverTitle).toBe("Workshop Lv 7");
  const body = String(useGameStore.getState().hoverBody);
  expect(body).toMatch(/XP:/);
  expect(body).toMatch(/Magic.*5/);
  expect(body).toMatch(/Legendary.*70/);
});
```

- [ ] **Step 2: Verify test fails** — `getByTestId("workshop-level-header")` won't exist yet.

- [ ] **Step 3: Implement**

Wrap the `<header className={styles.header}>` block in `<Hoverable as="div" title={...} body={...} footer={...}>` and add `data-testid="workshop-level-header"` to a child element. Build a helper `levelHoverBody()` that reads `workshopLevel`/`workshopXp` from the store at hover time.

- [ ] **Step 4: Verify pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "ui(workshop): hover info on level header — XP + tier unlocks"
```

---

## Task 3: Workshop — Inventory item card hover (full affix breakdown)

**Files:**
- Modify: `src/components/painting/WorkshopRoom.tsx`
- Test: append to existing hover test file

**Title:** `"{Tier} {slot}"` (e.g., "Rare brush")
**Body factory:** For each affix, render a line spelling out the effect:
- `+canvas_gold%` → `"+X% canvas gold"`
- `-paint_time%` → `"-X% paint time"`
- (extend mapping as new affix kinds land)

**Footer:** `"Click to equip."` (or `"Click to unequip."` for the equipped variant — see Task 4)

- [ ] **Step 1: Write failing test**

```ts
it("Inventory item hover shows tier + slot in title and affix effects in body", () => {
  useGameStore.setState({
    inventory: [{
      id: "test-1", slot: "brush", tier: "rare",
      affixes: [
        { kind: "+canvas_gold%", magnitude: 12 },
        { kind: "-paint_time%", magnitude: 8 },
      ],
    }],
  });
  render(<WorkshopRoom />);
  fireEvent.mouseEnter(screen.getByTestId("inventory-equip-test-1"));
  expect(useGameStore.getState().hoverTitle).toBe("Rare brush");
  const body = String(useGameStore.getState().hoverBody);
  expect(body).toMatch(/\+12% canvas gold/);
  expect(body).toMatch(/-8% paint time/);
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement**

In `WorkshopRoom.tsx`, refactor the inventory `<button>` to be wrapped in `<Hoverable>`. Add a helper `affixHoverBody(item)` that maps affix kinds to plain-English strings.

```tsx
const AFFIX_LABEL: Record<AffixKind, (m: number) => string> = {
  "+canvas_gold%": (m) => `+${m}% canvas gold`,
  "-paint_time%": (m) => `-${m}% paint time`,
};

function affixHoverBody(affixes: ReadonlyArray<Affix>): JSX.Element {
  return <>{affixes.map((a, i) => <div key={i}>{AFFIX_LABEL[a.kind](a.magnitude)}</div>)}</>;
}
```

- [ ] **Step 4: Verify pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "ui(workshop): hover info on inventory items — affix effects spelled out"
```

---

## Task 4: Workshop — Equipped slot hover (current contribution)

**Files:**
- Modify: `src/components/painting/WorkshopRoom.tsx`
- Test: append to hover test file

**Title:** `"{Tier} {slot} — equipped"`
**Body factory:** Same affix list as Task 3 but using the equipped item.
**Footer:** `"Click to unequip."`

For the empty-slot case, use a simpler hover: title `"{slot} (empty)"`, body `"Equip an item from your inventory."`.

- [ ] **Step 1: Write failing test**

```ts
it("Equipped slot hover shows item details and 'Click to unequip' footer", () => {
  useGameStore.setState({
    purchasedNodes: { gear_up: 1 },
    equipped: {
      brush: { id: "eq-1", slot: "brush", tier: "magic",
               affixes: [{ kind: "+canvas_gold%", magnitude: 5 }] },
    },
  });
  render(<WorkshopRoom />);
  fireEvent.mouseEnter(screen.getByTestId("slot-unequip-brush"));
  expect(useGameStore.getState().hoverTitle).toBe("Magic brush — equipped");
  expect(String(useGameStore.getState().hoverFooter)).toMatch(/unequip/i);
});

it("Empty slot hover shows '(empty)' title", () => {
  useGameStore.setState({ purchasedNodes: { gear_up: 1 }, equipped: {} });
  render(<WorkshopRoom />);
  fireEvent.mouseEnter(screen.getByTestId("slot-brush"));
  expect(useGameStore.getState().hoverTitle).toBe("brush (empty)");
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement** — wrap both branches of the equipped-slot ternary in `<Hoverable>`.

- [ ] **Step 4: Verify pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "ui(workshop): hover info on equipped slots — item details + empty hint"
```

---

## Task 5: Painting — Tier upgrade button hover

**Files:**
- Modify: `src/components/painting/TierCard.tsx` (or `CanvasUpgradesStrip.tsx` — read first to confirm)
- Test: `tests/components/painting/CanvasUpgrades.hover.test.tsx`

**Title:** `"Upgrade to Tier {tier+1}"`
**Body factory:** Reads `canvasTier` from store. Computes:
- Cost (from `tierUpgradeCost(currentTier)`)
- Current paint time (`canvasTime(currentTier)` seconds)
- Next paint time (`canvasTime(currentTier+1)`)
- Current gold/canvas at mult=1 (`canvasGold(currentTier, 1)`)
- Next gold/canvas at mult=1 (`canvasGold(currentTier+1, 1)`)

```
Cost: <formatBig(cost)> g
─────
Paint time:  <a>s → <b>s
Gold/canvas: <c> → <d>
```

**Footer:** `"Tier 10 is the cap (v1.1)."` if at MAX_TIER-1, otherwise empty.

Same TDD steps (write test → fail → implement → pass → commit).

- [ ] **Step 1: Write failing test** (assert title, cost text, paint-time arrow)
- [ ] **Step 2: Verify failure**
- [ ] **Step 3: Implement** — wrap upgrade button in `<Hoverable>`
- [ ] **Step 4: Verify pass**
- [ ] **Step 5: Commit** `ui(painting): hover info on tier upgrade button — cost + before/after stats`

---

## Task 6: Painting — Sell/canvas hover (gold breakdown)

**Files:**
- Modify: `src/components/painting/CanvasStage.tsx` (find sell button or canvas element)
- Test: `tests/components/painting/CanvasStage.hover.test.tsx`

**Title:** `"Sell Canvas"`
**Body factory:** Reads canvas tier + multipliers. Renders the gold formula step by step:
```
Base × tier²:     10 × <tier>² = <X>
Color skill:      ×<getCanvasGoldMultiplier without rainbow>
Rainbow:          ×<rainbow factor>
Items:            ×<item bonus>
Paint Mastery:    ×<pmMult>
─────
Total:            <X total> g per canvas
```

(Compute by stepping through `multipliers.ts` — call `getCanvasGoldMultiplier(state)` once for the aggregate; show major contributors using `getNodeLevel` × known constants.)

- [ ] **Step 1: Write failing test** (assert "Sell Canvas" title, "Total:" line in body)
- [ ] **Step 2: Verify failure**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Verify pass**
- [ ] **Step 5: Commit** `ui(painting): hover info on sell/canvas — gold formula breakdown`

---

## Task 7: Tree — UpgradeRow hover (per tree part)

**Files:**
- Modify: `src/components/tree/UpgradeRow.tsx`
- Test: `tests/components/tree/UpgradeRow.hover.test.tsx`

**Title:** `"{Part name}"` (e.g., `"Spark"`, `"Bud"`)
**Body factory:**
```
Level: <level>
Next cost: <formatBig(treePartCost(level, baseCost) × bargainMult)> g
Contribution: +<level × rate × inspiMult> inspi/sec
```

- [ ] **Step 1: Write failing test**
- [ ] **Step 2: Verify failure**
- [ ] **Step 3: Implement** — wrap the row's button/area
- [ ] **Step 4: Verify pass**
- [ ] **Step 5: Commit** `ui(tree): hover info on upgrade rows — level + cost + contribution`

---

## Task 8: Tree — StagePanel hover (advancement requirements)

**Files:**
- Modify: `src/components/tree/StagePanel.tsx`
- Test: `tests/components/tree/StagePanel.hover.test.tsx`

**Title:** `"Stage {currentStage} → {nextStage}"`
**Body factory:** Reads stage requirements (likely from `src/config/treeStages.ts`). Lists each requirement with current vs. needed (e.g., `"Spark Lv 5 / 10"`). Final line: total inspi-cost summary.

- [ ] **Step 1: Write failing test**
- [ ] **Step 2: Verify failure**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Verify pass**
- [ ] **Step 5: Commit** `ui(tree): hover info on stage panel — advancement requirements`

---

## Task 9: Constellation — NodeCard hover preview

**Files:**
- Modify: `src/components/constellation/NodeCard.tsx`
- Test: `tests/components/constellation/NodeCard.hover.test.tsx`

The selected node's NodeCard is already info-dense (it's the selected-node detail panel). Hover wiring on the NodeCard's *Acquire* button is the high-value surface here.

**Title:** `"Acquire {node.name}"`
**Body factory:**
```
Cost: <node.costs[currentLevel]> fame
Level: <currentLevel> / <maxLevel>
─────
{node.description}
```
If the next-level cost exceeds player's fame, append `"Need <gap> more fame."` to body.
If a parent has level 0, append `"Locked: requires {parentName} Lv 1+"`.

**Footer:** `node.numericEffect` (raw effect string).

- [ ] **Step 1: Write failing test** (assert title contains node name, body has cost line)
- [ ] **Step 2: Verify failure**
- [ ] **Step 3: Implement** — wrap the Acquire button (`data-testid="node-acquire-{id}"`)
- [ ] **Step 4: Verify pass**
- [ ] **Step 5: Commit** `ui(constellation): hover info on Acquire — cost, level, locked-by hint`

---

## Task 10: Constellation — FAME hub hover

**Files:**
- Modify: `src/components/constellation/StarCanvas.tsx` (look for `data-testid="fame-hub"`)
- Test: `tests/components/constellation/StarCanvas.hover.test.tsx`

**Title:** `"FAME"`
**Body factory:**
```
To spend: <state.fame>
Lifetime earned: <sum of pastRuns.fame + state.fame>
Ascends: <state.ascendCount>
```

- [ ] **Step 1: Write failing test**
- [ ] **Step 2: Verify failure**
- [ ] **Step 3: Implement** — wrap the FAME hub's `<g data-testid="fame-hub">` with `<Hoverable as="div">` (SVG-aware: may need to attach `onMouseEnter`/`Leave` directly on the `<g>` instead of via Hoverable wrapper if SVG-in-span causes issues — investigate during impl).
- [ ] **Step 4: Verify pass**
- [ ] **Step 5: Commit** `ui(constellation): hover info on FAME hub — totals and ascend count`

---

## Task 11: TopBar — CurrencyChip hover (Gold / Inspi / Fame)

**Files:**
- Modify: `src/components/shell/CurrencyChip.tsx`
- Test: `tests/components/shell/CurrencyChip.hover.test.tsx`

**Per-currency content:**
- **Gold**
  - Title: `"Gold"`
  - Body: `Current: <formatBig>`, `Per canvas: <canvasGold(tier, mult)>`, `Lifetime: <lifetimeGold>`
  - Footer: `"Spent on tree upgrades and tier upgrades."`
- **Inspiration**
  - Title: `"Inspiration"`
  - Body: `Current: <inspi>`, `Per second: <inspiPerSec>`, `Threshold: 10,000 (gates ascend)`
  - Footer: `"Convert via Ascend → Fame."`
- **Fame**
  - Title: `"Fame"`
  - Body: `Current: <fame>`, `Total earned: <pastRuns.fame sum + fame>`, `Spent: <difference>`
  - Footer: `"Permanent currency. Spent in the Constellation."`

- [ ] **Step 1: Write failing test** (3 cases, one per currency)
- [ ] **Step 2: Verify failure**
- [ ] **Step 3: Implement** — extend `CurrencyChip` with optional `kind: "gold" | "inspi" | "fame"` prop driving the hover content, or pass `hoverTitle/Body/Footer` props directly from `TopBar.tsx`.
- [ ] **Step 4: Verify pass**
- [ ] **Step 5: Commit** `ui(shell): hover info on currency chips — current value + composition + role`

---

## Task 12: Ascension — Step Through button hover

**Files:**
- Modify: `src/routes/AscensionRoute.tsx`
- Test: `tests/routes/AscensionRoute.hover.test.tsx`

**Title:** `"Ascend"`
**Body factory:**
- If `canAscend` is false: `"Need 10,000 inspiration to gain your first fame point."`
- Else:
  ```
  Current inspi: <formatBig(inspi)>
  Fame gain: +<fameOnAscend(inspi)>
  ─────
  Formula: max(1, ⌊(log₁₀(inspi)−4)⁵ × 3.2⌋)
  Next milestones:
    100k inspi → 3 fame
    1M inspi → 102 fame
    1B inspi → 10,000 fame
  ```

**Footer:** `"Ascending resets gold, inspi, tree, canvas, workshop. Fame and skill tree persist."`

- [ ] **Step 1: Write failing test** (one for blocked state, one for ready state)
- [ ] **Step 2: Verify failure**
- [ ] **Step 3: Implement** — wrap the existing `<button className={styles.stepThroughBtn}>`
- [ ] **Step 4: Verify pass**
- [ ] **Step 5: Commit** `ui(ascension): hover info on Step Through — fame formula + milestones`

---

## Task 13: Ascension — ThresholdPanel hover

**Files:**
- Modify: `src/components/ascension/ThresholdPanel.tsx`
- Test: `tests/components/ascension/ThresholdPanel.hover.test.tsx`

**Title:** `"Inspiration → Fame"`
**Body:** Static table:
```
9,999     → 0 (blocked)
10,000    → 1
100,000   → 3
1,000,000 → 102
1B        → 10,000
```
**Footer:** `"max(1, ⌊(log₁₀(inspi)−4)⁵ × 3.2⌋) above the gate."`

- [ ] **Step 1: Write failing test**
- [ ] **Step 2: Verify failure**
- [ ] **Step 3: Implement** — wrap the panel with `<Hoverable as="div">`
- [ ] **Step 4: Verify pass**
- [ ] **Step 5: Commit** `ui(ascension): hover info on threshold panel — fame curve table`

---

---

## Task 14: ScalingMathPanel — persistent reference card on the right of InfoPanel

**Files:**
- Create: `src/components/shell/ScalingMathPanel.tsx`
- Create: `src/components/shell/ScalingMathPanel.module.css`
- Modify: `src/components/shell/InfoPanel.tsx` (split into 2-column layout: hover info on the left, ScalingMathPanel on the right)
- Modify: `src/components/shell/InfoPanel.module.css` (grid layout `1fr 320px`)
- Test: `tests/components/shell/ScalingMathPanel.test.tsx`

**Why:** The InfoPanel's left side now shows hover info (Tasks 1-13). The right side becomes a persistent "scaling reference card" — a compact mono-font cheat sheet of the key formulas with current values plugged in. Updates as state changes. Read-only.

**Content (rendered with monospace, condensed lines):**

```
SCALING

Inspi/sec
  Σ(part.level × rate) × <inspiMult>×

Canvas Gold
  10 × tier² × <goldMult>×
  (colors + items) × rainbow × PM

Paint Time
  tier × 2s ÷ <speedMult>×

Craft Cost (workshop Lv <L>)
  100 × 1.05^min(4,L-1) × 1.20^max(0,L-5)
  = <formatBig(craftCost(L))> g

Tier Upgrade Cost (current tier <T>)
  100 × 2.78^(T-1) = <formatBig(tierUpgradeCost(T))> g

Tree Part Cost (level n)
  base × 1.15^n × <bargainMult>×

Fame on Ascend
  max(1, ⌊(log₁₀(inspi)-4)⁵ × 3.2⌋)
  10k→1 · 100k→3 · 1M→102 · 1B→10,000
```

Section headings in Cinzel, formulas in mono. Use existing tokens.css design tokens for colors. Wrap each section in a `<section data-testid="scaling-{key}">` so tests can target individual rows.

- [ ] **Step 1: Write failing tests**

```ts
// tests/components/shell/ScalingMathPanel.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScalingMathPanel } from "@/components/shell/ScalingMathPanel";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

describe("ScalingMathPanel", () => {
  beforeEach(() => {
    useGameStore.setState({
      workshopLevel: 1,
      canvasTier: 1,
      purchasedNodes: {},
      paintMastery: big(0),
      partLevels: { spark: 0, bud: 0, leaf: 0, branch: 0 },
    });
  });

  it("renders a SCALING heading and a Fame on Ascend section", () => {
    render(<ScalingMathPanel />);
    expect(screen.getByText(/SCALING/i)).toBeInTheDocument();
    expect(screen.getByTestId("scaling-fame")).toBeInTheDocument();
  });

  it("Fame on Ascend section includes the milestone table", () => {
    render(<ScalingMathPanel />);
    const section = screen.getByTestId("scaling-fame");
    expect(section.textContent).toMatch(/10k.*1/);
    expect(section.textContent).toMatch(/1M.*102/);
    expect(section.textContent).toMatch(/1B.*10,000/);
  });

  it("Craft Cost section reflects the current workshop level", () => {
    useGameStore.setState({ workshopLevel: 10 });
    render(<ScalingMathPanel />);
    const section = screen.getByTestId("scaling-craft-cost");
    expect(section.textContent).toMatch(/Lv 10/);
  });

  it("Tier Upgrade Cost section reflects the current canvas tier", () => {
    useGameStore.setState({ canvasTier: 5 });
    render(<ScalingMathPanel />);
    const section = screen.getByTestId("scaling-tier-cost");
    expect(section.textContent).toMatch(/tier 5/i);
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

`npx vitest run tests/components/shell/ScalingMathPanel.test.tsx` — expect "Cannot find module" / "ScalingMathPanel not exported".

- [ ] **Step 3: Implement ScalingMathPanel**

Create `src/components/shell/ScalingMathPanel.tsx`:

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import { formatBig } from "@/core/formatter";
import { craftCost, tierUpgradeCost } from "@/core/balance";
import { getCanvasGoldMultiplier, getCanvasSpeedMultiplier, getInspiMultiplier, getTreeUpgradeCostMultiplier } from "@/core/multipliers";
import styles from "./ScalingMathPanel.module.css";

export function ScalingMathPanel(): JSX.Element {
  const workshopLevel = useGameStore((s) => s.workshopLevel);
  const canvasTier = useGameStore((s) => s.canvasTier);
  // Read other state via getState() for one-shot computations on render — these
  // are already invalidated by the subscriptions above, plus the multiplier
  // selectors are stable enough that a hover is the relevant updateability.
  const state = useGameStore.getState();

  const inspiMult = getInspiMultiplier(state);
  const goldMult = getCanvasGoldMultiplier(state);
  const speedMult = getCanvasSpeedMultiplier(state);
  const bargain = getTreeUpgradeCostMultiplier(state);

  return (
    <aside className={styles.panel} aria-label="Scaling reference">
      <div className={styles.heading}>SCALING</div>

      <section className={styles.section} data-testid="scaling-inspi">
        <div className={styles.label}>Inspi/sec</div>
        <div className={styles.formula}>Σ(level × rate) × {inspiMult.toFixed(2)}×</div>
      </section>

      <section className={styles.section} data-testid="scaling-gold">
        <div className={styles.label}>Canvas Gold</div>
        <div className={styles.formula}>10 × tier² × {goldMult.toFixed(2)}×</div>
        <div className={styles.note}>colors + items, × rainbow, × PM</div>
      </section>

      <section className={styles.section} data-testid="scaling-paint">
        <div className={styles.label}>Paint Time</div>
        <div className={styles.formula}>tier × 2s ÷ {speedMult.toFixed(2)}×</div>
      </section>

      <section className={styles.section} data-testid="scaling-craft-cost">
        <div className={styles.label}>Craft Cost (workshop Lv {workshopLevel})</div>
        <div className={styles.formula}>= {formatBig(craftCost(workshopLevel))} g</div>
      </section>

      <section className={styles.section} data-testid="scaling-tier-cost">
        <div className={styles.label}>Tier Upgrade Cost (tier {canvasTier})</div>
        <div className={styles.formula}>= {formatBig(tierUpgradeCost(canvasTier))} g</div>
      </section>

      <section className={styles.section} data-testid="scaling-tree-cost">
        <div className={styles.label}>Tree Part Cost</div>
        <div className={styles.formula}>base × 1.15^n × {bargain.toFixed(2)}×</div>
      </section>

      <section className={styles.section} data-testid="scaling-fame">
        <div className={styles.label}>Fame on Ascend</div>
        <div className={styles.formula}>max(1, ⌊(log₁₀(inspi)−4)⁵ × 3.2⌋)</div>
        <div className={styles.note}>10k→1 · 100k→3 · 1M→102 · 1B→10,000</div>
      </section>
    </aside>
  );
}
```

CSS (`ScalingMathPanel.module.css`):

```css
.panel {
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1.4;
  color: var(--ink-2);
  padding: var(--s-2) var(--s-3);
  border-left: var(--border-subtle);
  overflow-y: auto;
}
.heading {
  font-family: var(--serif);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--ink-1);
  margin-bottom: var(--s-2);
}
.section { margin-bottom: var(--s-2); }
.label { color: var(--ink-1); font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
.formula { color: var(--ink-0); }
.note { color: var(--ink-3); font-size: 10px; }
```

- [ ] **Step 4: Modify InfoPanel.tsx and InfoPanel.module.css to split into 2 columns**

```tsx
// InfoPanel.tsx
import { ScalingMathPanel } from "./ScalingMathPanel";

export function InfoPanel(): JSX.Element {
  const title = useGameStore((s) => s.hoverTitle);
  const body = useGameStore((s) => s.hoverBody);
  const footer = useGameStore((s) => s.hoverFooter);

  return (
    <aside className={styles.panel} role="complementary">
      <div className={styles.hoverColumn}>
        {title && <div className={styles.title}>{title}</div>}
        {body && <div className={styles.body}>{body}</div>}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
      <ScalingMathPanel />
    </aside>
  );
}
```

```css
/* InfoPanel.module.css — add grid layout */
.panel {
  display: grid;
  grid-template-columns: 1fr 320px;
  /* keep existing height/padding */
}
.hoverColumn { /* current content styles */ }
```

- [ ] **Step 5: Run tests, verify pass**

`npx vitest run tests/components/shell/ScalingMathPanel.test.tsx` — 4/4 pass.

Also re-run the full suite to ensure InfoPanel layout split didn't break existing tests:
`npx vitest run --reporter=dot`. All passing.

- [ ] **Step 6: Commit**

```bash
git add src/components/shell/ScalingMathPanel.tsx src/components/shell/ScalingMathPanel.module.css src/components/shell/InfoPanel.tsx src/components/shell/InfoPanel.module.css tests/components/shell/ScalingMathPanel.test.tsx
git commit -m "ui(shell): scaling-math reference panel on the right of the info bar"
```

---

## Final verification

After Task 14:

- [ ] Run full test suite: `npx vitest run --reporter=dot`. Expect ≥ 600 tests passing (583 baseline + ~17 new tests across hover wiring + ScalingMathPanel).
- [ ] Run typecheck: `npx tsc --noEmit`. Zero errors.
- [ ] Run lint: `npx eslint src tests`. Zero errors (the existing main.tsx warning may persist).
- [ ] Manually load `http://localhost:5173/` and hover each surface; confirm InfoPanel updates and clears, and the scaling-math panel updates as state changes.

## Out of scope (this plan)

- Visual styling of the InfoPanel (e.g., bullet glyphs, color-coded headings) — keep current minimal style, polish in a follow-up.
- Hover for SVG nodes inside `StarCanvas` (covered partially by FAME hub task; per-node SVG hover may need a different approach via existing `data-testid="node-{id}"` attachments — defer if it's nontrivial).
- Hover for the dev-only "↻ reset" button (not worth the surface).
- Mobile/touch fallback (no-op on touch is acceptable for v1).
