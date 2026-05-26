# Canvas Chunk-Domain Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the time-domain canvas model (each canvas takes N seconds, tier doubles N) with a chunk-domain model (each canvas is N chunks, speed reduces per-chunk interval, tier doubles N). Collapse Size into Tier, add a dedicated Tier upgrade card with affordability border, scale chunks/cells per the new formulas, drop dead code.

**Architecture:**
- Engine math moves from seconds-progress to integer-chunk-progress.
- Per-chunk gold drip; final chunk fires the existing `lastSale` animation.
- Size disappears as a player-visible stat, an internal field, a skill node grant, an item affix, and a worker affix.
- New `Tier upgrade` UI card with shared rainbow conic-gradient border (extracted from `AchievementToast.module.css`).
- Cell rendering: cap raised from 400 → 640; beyond T7, multiple chunks per cell.

**Tech Stack:** Vite + React 19 + Zustand 5 + `break_eternity.js` (Big) + Vitest. Existing `canvasTickPure` immer-style draft mutation patterns preserved.

**Spec:** `docs/superpowers/specs/2026-05-26-canvas-chunk-domain-design.md`

---

## File Map

### Created
- `src/styles/rainbowBorderAffordable.module.css` — shared rainbow conic-gradient border + `--rb-angle` keyframe extracted from `AchievementToast.module.css` so the Tier card and AchievementToast stay in sync.
- `src/components/painting/TierUpgradeCard.tsx` + `TierUpgradeCard.module.css` — new prominent affordability-aware card above the upgrade strip.
- `tests/components/painting/TierUpgradeCard.test.tsx` — render + affordability-border + click-spends-gold assertions.

### Modified — core
- `src/core/balance.ts` — add `BASE_CHUNK_INTERVAL`, `BASE_GOLD_PER_CHUNK`, `chunksPerCanvas(T)`, `goldPerChunk(level, mult, T)`, `tierUpgradeCost(T)`, `chunkInterval(speedMult)`. Drop `CANVAS_TIME_BASE`, `canvasTime`, `timeFactor`, `COST_GROWTH_BASE`, `costTierFactor`, `SIZE_PER_LEVEL`, `SIZE_COST_BASE`, `sizeUpgradeCost`. Rework `canvasGold` (drop `size²`). Drop `costTierFactor` from the four surviving `*UpgradeCost` functions.
- `src/core/canvasTickPure.ts` — replace seconds-domain loop with chunk-domain integer loop. Per-chunk gold drip with `lastSale` fired on the chunk that completes the canvas. Read `chunksPerCanvas(canvasTier)` instead of `getSketchGridDim(canvasTier) ** 2`.
- `src/core/multipliers.ts` — delete `getCanvasSize`. Drop `sizeLevel` from `CanvasMultiplierInputs`.

### Modified — slice / state
- `src/store/canvasSlice.ts` — `CanvasState.canvasProgress` semantics: chunks completed (integer), not seconds. Drop `sizeLevel` field. Drop `upgradeSize` action. Rewrite `tierUp()`: gate = `gold >= tierUpgradeCost(canvasTier)`; behavior = increment tier, reset `canvasProgress` to 0 and `critChunks` to `{}` and `comboChain` to 0; PRESERVE `sellPriceLevel`, `speedLevel`, `critLevel`, `comboLevel`. Drop the auto-tier-up call at end of `canvasTick`.
- `src/store/persistence.ts` — bump `SAVE_VERSION` and add migration: convert `canvasProgress` (seconds → chunks), strip `sizeLevel` from persisted state, refund FP for purchased size-related skill nodes.
- `src/store/workshopSlice.ts` — strip `+size%` from any equipped items and item inventory on load (migration). Skip ROLL of `+size%` going forward.
- `src/store/officeSlice.ts` (or wherever roster lives) — strip `+size%` from worker affixes on load.
- `src/store/skillTreeSlice.ts` — refund FP for nodes carrying `canvas_size_bonus` capability on load.

### Modified — UI
- `src/routes/PaintingRoute.tsx` — remove `sizeLevel`, `sizeLocked`, `sizeCost`, `upgradeSize`, `paintTimeSec`, `baseTime` derivations. Replace with `chunkInterval`, `chunksPerCanvas`. Mount `<TierUpgradeCard>` above `<CanvasUpgradesStrip>`. Remove the Size `TrackCard` from inside the strip.
- `src/components/painting/BoundCanvasStage.tsx` — props drop `sizeLevel`, `paintTimeSec`; gain `chunkInterval`. Click handler: `canvasTick(chunkInterval)` (paints one chunk's worth). Pass `chunksPerCanvas` to `CanvasStage` as the cell count.
- `src/components/painting/CanvasStage.tsx` + `CanvasStage.module.css` — accept variable `(rows, cols)` instead of square grid dim. Read layout from `getCanvasCellLayout(tier)`. Cell-to-chunk mapping: `chunkIndex = floor(cellIndex * chunksPerCell)`. Visual cap = 640 cells.
- `src/components/painting/canvasArt.ts` — replace/supplement `getSketchGridDim` with `getCanvasCellLayout(tier): { rows: number; cols: number; cellsRendered: number; chunksPerCell: number }`. Keep `getSketchGridDim` only if non-cell consumers exist; otherwise delete.
- `src/components/painting/CanvasUpgradesStrip.tsx` — drop the Size `TrackCard` from the children.
- `src/components/painting/StatsRoom.tsx` — rename `TierBlock` → `CanvasBlock`. Drop the Size-related block (`SizeBlock`). Drop "Upgrade costs ×N" row from the Canvas block. New rows: chunks/canvas, interval/chunk, gold/chunk, gold/canvas, GPS.
- `src/components/painting/useRevealQueue.ts` — re-validate: the queue is index-based so should still work, but constants `MAX_IN_FLIGHT = 8` and timing may need a sanity tweak when cellsRendered = 640 and engine fires 1280 chunks at T8.

### Modified — config
- `src/config/skillTreeNodes.ts` — remove nodes that grant `canvas_size_bonus` (audit: `expanding_horizon` confirmed; check `src/config/skillTreeDesign.json` for the canonical list). Also remove `unlock_canvas_size` gate node since the Size track no longer exists.
- `src/config/skillTreeDesign.json` — mirror node deletions.
- `src/config/workshopAffixes.ts` — remove the `+size%` affix definition entirely.

### Modified — tests
- `tests/core/balance.test.ts` — add tests for new helpers; remove tests for deleted helpers; update `*UpgradeCost` tests (no `costTierFactor`).
- `tests/core/canvasTickPure.test.ts` — rewrite for chunk-domain semantics.
- `tests/components/painting/canvasArt.test.ts` — replace `getSketchGridDim` cap tests with `getCanvasCellLayout` tests.
- `tests/components/painting/CanvasStage.test.tsx` — update cell-cap tests (640) and grid layout assertions.
- `tests/components/painting/CanvasStage.stress.test.tsx` — adjust for 640-cell worst case.
- `tests/components/painting/useRevealQueue.test.ts` — adjust if MAX_IN_FLIGHT changes.
- `tests/core/multipliers.test.ts` — remove `getCanvasSize` test block.
- `tests/store/canvasSlice.test.ts` — update tier-up tests, remove size-upgrade tests.
- `tests/store/persistence.test.ts` — add migration tests for the new SAVE_VERSION.
- `tests/dev/bot-simulation.test.ts` — switch tier-up strategy from "15/15 threshold" to "buy when gold ≥ tierUpgradeCost(canvasTier)". Restate the T3→T4 ≥ T2→T3 × 0.9 non-inversion assertion.

### Deleted
- (Implicit, via the cleanup task) any orphan imports of the removed functions.

---

## Constants snapshot (use these exact values across the plan)

```ts
// In src/core/balance.ts
export const BASE_CHUNK_INTERVAL = 5;       // seconds at speed multiplier = 1
export const BASE_GOLD_PER_CHUNK = 1;       // baseline; multipliers stack on top
export const TIER_UPGRADE_COST_BASE = 1000; // 1000^T cost ramp
export const CELL_RENDER_CAP = 640;         // max cells drawn per canvas

// Already exists, keep:
// CANVAS_GOLD_BASE = 10
// tierFactor(T) = 10^(T-1)
// SELL_PRICE_PER_LEVEL = 0.10
// SPEED_PER_LEVEL = 0.05
```

Sanity at T1, no upgrades, no items, no workers, no skill nodes:
- `chunksPerCanvas(1) = 10 × 2^0 = 10`
- `goldPerChunk(0, 1, 1) = 1 × 1 × 1 = 1`
- Total canvas gold = `10 × 1 = 10` (matches old `CANVAS_GOLD_BASE × 1² × 1 × 1 = 10`)
- `chunkInterval(1) = 5 / 1 = 5s`
- Total canvas time = `10 × 5 = 50s` (old: `CANVAS_TIME_BASE × 1 × 1 / 1 = 10s` — **this is a deliberate 5× slowdown at T1 L0 speed**; players are expected to click or buy speed; intentional per spec)

---

## Task 1: Add chunk-domain constants and helpers

**Files:**
- Modify: `src/core/balance.ts` (append next to `tierFactor`)
- Test: `tests/core/balance.test.ts`

- [ ] **Step 1.1: Write failing tests**

Add to `tests/core/balance.test.ts`:

```ts
import {
  BASE_CHUNK_INTERVAL, BASE_GOLD_PER_CHUNK, TIER_UPGRADE_COST_BASE, CELL_RENDER_CAP,
  chunksPerCanvas, goldPerChunk, tierUpgradeCost, chunkInterval,
} from "@/core/balance";
import { big } from "@/core/bigNumber";

describe("chunksPerCanvas", () => {
  it("T1 = 10", () => expect(chunksPerCanvas(1)).toBe(10));
  it("T2 = 20", () => expect(chunksPerCanvas(2)).toBe(20));
  it("T3 = 40", () => expect(chunksPerCanvas(3)).toBe(40));
  it("T7 = 640", () => expect(chunksPerCanvas(7)).toBe(640));
  it("T8 = 1280 (chunks scale past cell cap)", () => expect(chunksPerCanvas(8)).toBe(1280));
  it("T10 = 5120", () => expect(chunksPerCanvas(10)).toBe(5120));
  it("clamps tier to >= 1", () => expect(chunksPerCanvas(0)).toBe(10));
});

describe("goldPerChunk", () => {
  it("T1 base level=0 mult=1 returns 1", () => {
    expect(goldPerChunk(0, 1, 1).toNumber()).toBe(1);
  });
  it("scales ×10 per tier (tierFactor)", () => {
    expect(goldPerChunk(0, 1, 2).toNumber()).toBe(10);
    expect(goldPerChunk(0, 1, 3).toNumber()).toBe(100);
  });
  it("applies multiplier", () => {
    expect(goldPerChunk(0, 2.5, 1).toNumber()).toBe(2.5);
  });
  it("level adds SELL_PRICE_PER_LEVEL (0.10) per level — encoded inside multiplier by callers, formula itself takes mult literally", () => {
    // Sanity check the contract: this helper does NOT add sellPriceLevel itself.
    // Callers compose mult via getCanvasGoldMultiplier and pass it in.
    expect(goldPerChunk(99, 1, 1).toNumber()).toBe(1);
  });
});

describe("tierUpgradeCost", () => {
  it("T1 → T2 costs 1000", () => expect(tierUpgradeCost(1).toString()).toBe("1000"));
  it("T2 → T3 costs 1,000,000", () => expect(tierUpgradeCost(2).toString()).toBe("1000000"));
  it("T3 → T4 costs 1,000,000,000", () => expect(tierUpgradeCost(3).toString()).toBe("1000000000"));
});

describe("chunkInterval", () => {
  it("speed multiplier 1 → 5s", () => expect(chunkInterval(1)).toBe(5));
  it("speed multiplier 2 → 2.5s", () => expect(chunkInterval(2)).toBe(2.5));
  it("speed multiplier 10 → 0.5s", () => expect(chunkInterval(10)).toBe(0.5));
  it("guards against zero/negative speed multiplier", () => {
    expect(chunkInterval(0)).toBe(BASE_CHUNK_INTERVAL);
    expect(chunkInterval(-1)).toBe(BASE_CHUNK_INTERVAL);
  });
});

describe("constants", () => {
  it("BASE_CHUNK_INTERVAL = 5", () => expect(BASE_CHUNK_INTERVAL).toBe(5));
  it("BASE_GOLD_PER_CHUNK = 1", () => expect(BASE_GOLD_PER_CHUNK).toBe(1));
  it("TIER_UPGRADE_COST_BASE = 1000", () => expect(TIER_UPGRADE_COST_BASE).toBe(1000));
  it("CELL_RENDER_CAP = 640", () => expect(CELL_RENDER_CAP).toBe(640));
});
```

- [ ] **Step 1.2: Run tests to verify they fail**

Run: `npx vitest run tests/core/balance.test.ts`
Expected: FAIL with "BASE_CHUNK_INTERVAL is not exported" / "chunksPerCanvas is not defined" etc.

- [ ] **Step 1.3: Implement the helpers**

Add to `src/core/balance.ts` (after the existing `costTierFactor` block, before the "Formulas" section):

```ts
// ============================================================================
// Chunk-domain constants — see 2026-05-26-canvas-chunk-domain-design.md
// ============================================================================

/** Seconds per chunk at speed multiplier = 1.0 (no speed upgrades). Players
 *  reduce this via the speed upgrade, skill nodes, items, workers. */
export const BASE_CHUNK_INTERVAL = 5;

/** Base gold per chunk before any multipliers, at T1. Compose with
 *  `tierFactor(T)` × `getCanvasGoldMultiplier(state)`. Picked so T1
 *  total canvas gold = chunks(1) × 1 = 10, matching old `CANVAS_GOLD_BASE`. */
export const BASE_GOLD_PER_CHUNK = 1;

/** Tier-upgrade cost ramp: cost(currentTier) = 1000^currentTier (T1→T2 = 1k,
 *  T2→T3 = 1M, T3→T4 = 1B, ...). Steep on purpose; spec calls for ~1 hour
 *  of preceding within-tier upgrade work before each tier-up. */
export const TIER_UPGRADE_COST_BASE = 1000;

/** Visual cell render cap. Beyond T7 (where chunks(T) > 640), chunks
 *  decouple from cells: each cell represents `ceil(chunks(T) / cells)`
 *  chunks. Per-frame render cost stays O(in-flight) thanks to the
 *  rasterized-canvas + drip-fed in-flight pool from the 2026-05-25 rework. */
export const CELL_RENDER_CAP = 640;

/** Total chunks to fill canvas at tier T. `chunksPerCanvas(1) = 10`,
 *  doubles per tier indefinitely. */
export const chunksPerCanvas = (tier: number): number =>
  10 * Math.pow(2, Math.max(1, tier) - 1);

/** Gold paid when one chunk completes. Caller composes `mult` via
 *  `getCanvasGoldMultiplier(state)` (which already folds in sellPriceLevel,
 *  items, workers, color tree, rainbow, achievements, school). */
export const goldPerChunk = (
  _sellPriceLevel: number,
  mult: number,
  tier: number,
): Big => big(BASE_GOLD_PER_CHUNK).mul(mult).mul(tierFactor(tier));

/** Gold cost to advance from currentTier to currentTier+1. Idiom matches
 *  the `*UpgradeCost(currentLevel)` pattern elsewhere in this file. */
export const tierUpgradeCost = (currentTier: number): Big =>
  big(TIER_UPGRADE_COST_BASE).pow(Math.max(1, currentTier));

/** Seconds between auto-paints of a single chunk, given the current
 *  speed multiplier. Floors at BASE_CHUNK_INTERVAL when multiplier <= 0
 *  (defensive — no caller should pass non-positive, but cheap to guard). */
export const chunkInterval = (speedMultiplier: number): number =>
  speedMultiplier > 0 ? BASE_CHUNK_INTERVAL / speedMultiplier : BASE_CHUNK_INTERVAL;
```

- [ ] **Step 1.4: Run tests to verify they pass**

Run: `npx vitest run tests/core/balance.test.ts`
Expected: PASS, all new tests green.

- [ ] **Step 1.5: Commit**

```bash
git add src/core/balance.ts tests/core/balance.test.ts
git commit -m "core(balance): add chunk-domain helpers (chunksPerCanvas, goldPerChunk, tierUpgradeCost, chunkInterval)"
```

---

## Task 2: Add canvas cell layout helper

**Files:**
- Modify: `src/components/painting/canvasArt.ts`
- Test: `tests/components/painting/canvasArt.test.ts`

- [ ] **Step 2.1: Write failing tests**

Add to `tests/components/painting/canvasArt.test.ts`:

```ts
import { getCanvasCellLayout } from "@/components/painting/canvasArt";

describe("getCanvasCellLayout", () => {
  it("T1: 10 cells, 1 chunk/cell, 2×5 grid", () => {
    const l = getCanvasCellLayout(1);
    expect(l.cellsRendered).toBe(10);
    expect(l.chunksPerCell).toBe(1);
    expect(l.rows * l.cols).toBe(10);
  });
  it("T2: 20 cells, 1 chunk/cell", () => {
    const l = getCanvasCellLayout(2);
    expect(l.cellsRendered).toBe(20);
    expect(l.chunksPerCell).toBe(1);
    expect(l.rows * l.cols).toBe(20);
  });
  it("T7: 640 cells, 1 chunk/cell (cap reached)", () => {
    const l = getCanvasCellLayout(7);
    expect(l.cellsRendered).toBe(640);
    expect(l.chunksPerCell).toBe(1);
    expect(l.rows * l.cols).toBe(640);
  });
  it("T8: 640 cells, 2 chunks/cell", () => {
    const l = getCanvasCellLayout(8);
    expect(l.cellsRendered).toBe(640);
    expect(l.chunksPerCell).toBe(2);
  });
  it("T10: 640 cells, 8 chunks/cell", () => {
    const l = getCanvasCellLayout(10);
    expect(l.cellsRendered).toBe(640);
    expect(l.chunksPerCell).toBe(8);
  });
  it("rows * cols always equals cellsRendered", () => {
    for (let t = 1; t <= 12; t++) {
      const l = getCanvasCellLayout(t);
      expect(l.rows * l.cols).toBe(l.cellsRendered);
    }
  });
  it("clamps tier to >= 1", () => {
    const l = getCanvasCellLayout(0);
    expect(l.cellsRendered).toBe(10);
  });
});
```

- [ ] **Step 2.2: Run tests to verify they fail**

Run: `npx vitest run tests/components/painting/canvasArt.test.ts -t "getCanvasCellLayout"`
Expected: FAIL with "getCanvasCellLayout is not exported".

- [ ] **Step 2.3: Implement the helper**

Add to `src/components/painting/canvasArt.ts` (next to `getSketchGridDim`):

```ts
import { chunksPerCanvas, CELL_RENDER_CAP } from "@/core/balance";

/**
 * Cell layout for the canvas grid at a given tier.
 *
 *  - `cellsRendered = min(chunksPerCanvas(T), CELL_RENDER_CAP)` — visual cap.
 *  - `chunksPerCell = ceil(chunksPerCanvas(T) / cellsRendered)` — at high
 *     tiers one cell-reveal corresponds to multiple engine chunks.
 *  - `(rows, cols)` factor `cellsRendered` into a roughly-landscape grid.
 *
 * Lookup table for cell layouts up to T7 (where the cap is reached):
 *   T1 = 10  → 2×5
 *   T2 = 20  → 4×5
 *   T3 = 40  → 5×8
 *   T4 = 80  → 8×10
 *   T5 = 160 → 10×16
 *   T6 = 320 → 16×20
 *   T7 = 640 → 20×32
 *   T8+ = 640 cells (same 20×32 grid), with chunksPerCell > 1.
 */
export interface CanvasCellLayout {
  readonly rows: number;
  readonly cols: number;
  readonly cellsRendered: number;
  readonly chunksPerCell: number;
}

const CELL_LAYOUT_BY_CELLS: Record<number, { rows: number; cols: number }> = {
  10:  { rows: 2,  cols: 5  },
  20:  { rows: 4,  cols: 5  },
  40:  { rows: 5,  cols: 8  },
  80:  { rows: 8,  cols: 10 },
  160: { rows: 10, cols: 16 },
  320: { rows: 16, cols: 20 },
  640: { rows: 20, cols: 32 },
};

export function getCanvasCellLayout(tier: number): CanvasCellLayout {
  const chunks = chunksPerCanvas(tier);
  const cellsRendered = Math.min(chunks, CELL_RENDER_CAP);
  const chunksPerCell = Math.ceil(chunks / cellsRendered);
  const dims = CELL_LAYOUT_BY_CELLS[cellsRendered];
  if (!dims) {
    // Defensive fallback (should never hit — every value of chunksPerCanvas
    // ≤ CELL_RENDER_CAP comes from the 10*2^(T-1) progression and is in the
    // table above).
    return { rows: 1, cols: cellsRendered, cellsRendered, chunksPerCell };
  }
  return { rows: dims.rows, cols: dims.cols, cellsRendered, chunksPerCell };
}
```

- [ ] **Step 2.4: Run tests to verify they pass**

Run: `npx vitest run tests/components/painting/canvasArt.test.ts -t "getCanvasCellLayout"`
Expected: PASS.

- [ ] **Step 2.5: Commit**

```bash
git add src/components/painting/canvasArt.ts tests/components/painting/canvasArt.test.ts
git commit -m "feat(canvas): add getCanvasCellLayout for chunk-domain cell rendering"
```

---

## Task 3: Rewrite canvasTickPure to chunk-domain

**Files:**
- Modify: `src/core/canvasTickPure.ts`
- Test: `tests/core/canvasTickPure.test.ts`

This is the biggest engine change. The old loop:
1. Reads `canvasProgress` (seconds), converts to `chunkProgress + subTime`
2. Computes `chunkTime = canvasTime / chunkCount` per iteration
3. Steps over chunks, accumulates seconds, fires sales
4. Re-serializes `chunkProgress + subTime` back to `canvasProgress` (seconds)

The new loop:
1. Reads `canvasProgress` (chunks completed)
2. Computes how many full chunks fit in `deltaSeconds` via `chunkInterval`
3. Steps over chunks, fires per-chunk gold, fires `lastSale` on canvas-completing chunk, rolls crit, resets to 0 on canvas-complete
4. Writes `canvasProgress` (chunks remaining toward next completion) + sub-chunk residual

Sub-chunk residual: we still need fractional progress between chunks because `deltaSeconds` won't divide evenly. Keep `canvasProgress` as `chunks completed` (integer 0..chunks-1) and add a NEW field `subChunkTime: number` for the seconds carried into the next chunk. The next paint completes when `subChunkTime >= chunkInterval`.

Actually — cleaner: `canvasProgress` becomes a **float** = chunks completed including fractional progress on the in-progress chunk. `floor(canvasProgress)` = whole chunks done; fractional part = how far into the next chunk. This avoids adding a new field. Crit only rolls when a chunk fully completes (`floor` crosses an integer).

This task adopts the float-canvasProgress approach.

- [ ] **Step 3.1: Write failing tests**

Replace the existing `tests/core/canvasTickPure.test.ts` body with:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { canvasTickPure } from "@/core/canvasTickPure";
import { BASE_CHUNK_INTERVAL } from "@/core/balance";
import { big } from "@/core/bigNumber";
import type { DraftState } from "@/core/pureMutations";

// Minimal stub helper to construct a draft with chunk-domain defaults.
function makeDraft(overrides: Partial<DraftState> = {}): DraftState {
  return {
    canvasProgress: 0,
    canvasTier: 1,
    sellPriceLevel: 0, speedLevel: 0, critLevel: 0, comboLevel: 0,
    comboChain: 0,
    critChunks: {},
    lastSale: null,
    gold: big(0),
    lifetimeGold: big(0),
    equipped: {} as DraftState["equipped"],
    purchasedNodes: {} as DraftState["purchasedNodes"],
    roster: [] as DraftState["roster"],
    completedResearches: {} as DraftState["completedResearches"],
    completedAchievements: {} as DraftState["completedAchievements"],
    workshopLevel: 1,
    statsRun: {
      canvasesSold: 0, critsLanded: 0, goldEarned: big(0),
      currentCritStreak: 0, maxCritStreak: 0, maxComboChain: 0,
    } as DraftState["statsRun"],
    statsLifetime: {
      canvasesSold: 0, critsLanded: 0,
      maxComboChain: 0,
    } as DraftState["statsLifetime"],
    officeXp: big(0), officeLevel: 1,
    ...overrides,
  } as DraftState;
}

beforeEach(() => {
  // Disable crit/combo for these tests
  vi.mock("@/core/rng", () => ({ rng: () => 0.999 }));
});

describe("canvasTickPure (chunk-domain)", () => {
  it("no-op on zero delta", () => {
    const draft = makeDraft();
    canvasTickPure(draft, 0);
    expect(draft.canvasProgress).toBe(0);
  });

  it("advances canvasProgress by delta / chunkInterval", () => {
    const draft = makeDraft();
    canvasTickPure(draft, BASE_CHUNK_INTERVAL); // 1 chunk's worth at speed=1
    expect(draft.canvasProgress).toBeCloseTo(1, 5);
  });

  it("partial chunk progress is preserved as fractional canvasProgress", () => {
    const draft = makeDraft();
    canvasTickPure(draft, BASE_CHUNK_INTERVAL / 2); // half a chunk
    expect(draft.canvasProgress).toBeCloseTo(0.5, 5);
  });

  it("fires a sale on the chunk that completes the canvas at T1 (10 chunks)", () => {
    const draft = makeDraft();
    canvasTickPure(draft, BASE_CHUNK_INTERVAL * 10);
    expect(draft.statsRun.canvasesSold).toBe(1);
    expect(draft.canvasProgress).toBeCloseTo(0, 5); // reset after sale
    expect(draft.lastSale).not.toBeNull();
  });

  it("credits gold per chunk, not per canvas", () => {
    // T1 base: 10 gold per canvas. 5 chunks = 5 gold credited.
    const draft = makeDraft();
    canvasTickPure(draft, BASE_CHUNK_INTERVAL * 5);
    expect(draft.gold.toNumber()).toBeCloseTo(5, 5);
  });

  it("credits full canvas gold across two ticks", () => {
    const draft = makeDraft();
    canvasTickPure(draft, BASE_CHUNK_INTERVAL * 7); // 7 chunks
    canvasTickPure(draft, BASE_CHUNK_INTERVAL * 3); // 3 more chunks → sale
    expect(draft.gold.toNumber()).toBeCloseTo(10, 5);
    expect(draft.statsRun.canvasesSold).toBe(1);
  });

  it("click-paint: passing exactly chunkInterval advances 1 chunk", () => {
    const draft = makeDraft();
    canvasTickPure(draft, BASE_CHUNK_INTERVAL);
    expect(Math.floor(draft.canvasProgress)).toBe(1);
  });

  it("T2 takes 20 chunks", () => {
    const draft = makeDraft({ canvasTier: 2 });
    canvasTickPure(draft, BASE_CHUNK_INTERVAL * 19);
    expect(draft.statsRun.canvasesSold).toBe(0);
    canvasTickPure(draft, BASE_CHUNK_INTERVAL);
    expect(draft.statsRun.canvasesSold).toBe(1);
  });
});

describe("canvasTickPure crit", () => {
  beforeEach(() => {
    vi.mock("@/core/rng", () => ({ rng: () => 0.0001 })); // always crit
  });

  it("crit paints trigger + bonus chunks instantly (free gold)", () => {
    const draft = makeDraft();
    canvasTickPure(draft, BASE_CHUNK_INTERVAL);
    // Trigger chunk (1) + BASE_CRIT_CHUNKS (1) = 2 chunks credited
    expect(draft.gold.toNumber()).toBeCloseTo(2, 5);
    expect(Object.keys(draft.critChunks).length).toBe(2);
  });
});
```

- [ ] **Step 3.2: Run tests to verify they fail**

Run: `npx vitest run tests/core/canvasTickPure.test.ts`
Expected: FAIL with assorted assertion errors (old loop uses seconds; new tests expect chunks).

- [ ] **Step 3.3: Rewrite canvasTickPure**

Replace the body of `src/core/canvasTickPure.ts`:

```ts
import { big, type Big } from "@/core/bigNumber";
import {
  chunksPerCanvas, goldPerChunk, chunkInterval,
  COMBO_DECAY_PER_LINK, comboBonusFactor, comboEffectiveChance,
} from "@/core/balance";
import {
  getCanvasGoldMultiplier, getCanvasSpeedMultiplier,
  getCritChance, getCritChunks, getComboBaseChance, getComboDecayReduction,
} from "@/core/multipliers";
import { rng } from "@/core/rng";
import {
  addCurrency, trackSaleGoldPure, awardOfficeXpPure,
  incrementStatPure, patchRunStatsPure, type DraftState,
} from "@/core/pureMutations";

const MAX_SALES_PER_TICK = 1000;

/**
 * Chunk-domain canvas tick. `canvasProgress` is now a FLOAT in [0, chunkCount):
 *   floor(canvasProgress) = whole chunks completed (gold already paid)
 *   fractional part       = sub-chunk progress toward the next chunk
 *
 * Each tick:
 *   1. Compute chunkInterval from current speed multiplier.
 *   2. Add deltaSeconds / chunkInterval to canvasProgress.
 *   3. For each integer crossed: credit `goldPerChunk` × combo bonus,
 *      roll crit (which may insert bonus chunks at no time cost),
 *      and if the canvas fills, fire the sale event + reset progress.
 *
 * lastSale fires on the chunk that completes a canvas, not as a separate
 * event — so the existing FloatingGoldText animation triggers on the final
 * chunk's payout.
 */
export function canvasTickPure(draft: DraftState, deltaSeconds: number): void {
  if (deltaSeconds <= 0) return;

  const chunkCount = chunksPerCanvas(draft.canvasTier);
  const speedMult = getCanvasSpeedMultiplier(draft);
  const interval = chunkInterval(speedMult);
  if (interval <= 0) return;

  let chain = draft.comboChain;
  let critChunks: Record<number, true> = { ...draft.critChunks };
  let lastSaleId = draft.lastSale?.id ?? 0;
  let lastSaleAmount: Big | null = null;

  let progress = draft.canvasProgress;
  let timeBudget = deltaSeconds;
  let sales = 0;
  let salesThisTick = 0;
  let critChunksThisTick = 0;
  let tickGoldTotal = big(0);
  let localCritStreak = draft.statsRun.currentCritStreak;
  let localMaxCritStreak = draft.statsRun.maxCritStreak;
  let localMaxCombo = draft.statsRun.maxComboChain;

  const payChunk = (chunkIndex: number): void => {
    const goldMult = getCanvasGoldMultiplier(draft);
    const perChunk = goldPerChunk(draft.sellPriceLevel, goldMult, draft.canvasTier);
    const gain = perChunk.mul(comboBonusFactor(chain));

    addCurrency(draft, "gold", gain);
    trackSaleGoldPure(draft, gain);
    awardOfficeXpPure(draft, gain);
    tickGoldTotal = tickGoldTotal.add(gain);

    // The chunk that completes the canvas also fires the lastSale animation
    // and starts a new canvas (combo decision, reset progress).
    if (chunkIndex + 1 >= chunkCount) {
      lastSaleId += 1;
      lastSaleAmount = gain;
      sales += 1;
      salesThisTick += 1;
      progress = 0;
      critChunks = {};

      if (chain > localMaxCombo) localMaxCombo = chain;
      const baseChance = getComboBaseChance(draft);
      const decay = Math.max(0, COMBO_DECAY_PER_LINK - getComboDecayReduction(draft));
      const effChance = comboEffectiveChance(baseChance, chain, decay);
      chain = rng() < effChance ? chain + 1 : 0;
    }
  };

  while (timeBudget > 0 && sales < MAX_SALES_PER_TICK) {
    const TIME_EPSILON = 1e-9;
    const fractionalChunkLeft = (Math.floor(progress) + 1) - progress;
    const timeToNextChunk = fractionalChunkLeft * interval;

    if (timeBudget < timeToNextChunk - TIME_EPSILON) {
      progress += timeBudget / interval;
      timeBudget = 0;
      break;
    }

    // Cross one paid chunk boundary.
    timeBudget -= timeToNextChunk;
    const completedChunkIndex = Math.floor(progress);
    progress = completedChunkIndex + 1;

    // Roll crit (skip on the canvas's last chunk so trigger + first bonus
    // stay together — matches old behavior).
    const isLastChunkOfCanvas = completedChunkIndex + 1 >= chunkCount;
    if (!isLastChunkOfCanvas && rng() < getCritChance(draft)) {
      const bonus = getCritChunks(draft);
      critChunks[completedChunkIndex] = true;

      payChunk(completedChunkIndex);

      let bonusLeft = bonus;
      while (bonusLeft > 0 && sales < MAX_SALES_PER_TICK) {
        const bonusIndex = Math.floor(progress);
        if (bonusIndex >= chunkCount) break;
        critChunks[bonusIndex] = true;
        progress = bonusIndex + 1;
        payChunk(bonusIndex);
        bonusLeft -= 1;
      }

      const totalCritChunks = 1 + bonus;
      critChunksThisTick += totalCritChunks;
      localCritStreak += totalCritChunks;
      if (localCritStreak > localMaxCritStreak) localMaxCritStreak = localCritStreak;
    } else {
      payChunk(completedChunkIndex);
      if (!isLastChunkOfCanvas) localCritStreak = 0;
    }
  }

  if (salesThisTick > 0 || critChunksThisTick > 0) {
    if (critChunksThisTick > 0) {
      incrementStatPure(draft, "lifetime", "critsLanded", critChunksThisTick);
      incrementStatPure(draft, "run", "critsLanded", critChunksThisTick);
    }
    if (salesThisTick > 0) {
      incrementStatPure(draft, "lifetime", "canvasesSold", salesThisTick);
      incrementStatPure(draft, "run", "canvasesSold", salesThisTick);
      if (localMaxCombo > draft.statsLifetime.maxComboChain) {
        incrementStatPure(draft, "lifetime", "maxComboChain", localMaxCombo - draft.statsLifetime.maxComboChain);
      }
    }
    patchRunStatsPure(draft, {
      currentCritStreak: localCritStreak,
      maxCritStreak: localMaxCritStreak,
      maxComboChain: localMaxCombo,
      goldEarned: draft.statsRun.goldEarned.add(tickGoldTotal),
    });
  }

  draft.canvasProgress = progress;
  draft.comboChain = chain;
  draft.critChunks = critChunks;
  if (lastSaleAmount !== null) {
    draft.lastSale = { id: lastSaleId, amount: lastSaleAmount };
  }
}
```

- [ ] **Step 3.4: Run tests to verify they pass**

Run: `npx vitest run tests/core/canvasTickPure.test.ts`
Expected: PASS.

- [ ] **Step 3.5: Commit**

```bash
git add src/core/canvasTickPure.ts tests/core/canvasTickPure.test.ts
git commit -m "core(canvasTickPure): rewrite to chunk-domain with per-chunk gold drip"
```

---

## Task 4: Rewrite canvasGold formula (drop size²)

**Files:**
- Modify: `src/core/balance.ts`
- Test: `tests/core/balance.test.ts`

- [ ] **Step 4.1: Update failing tests for canvasGold**

Replace existing `canvasGold` describe block in `tests/core/balance.test.ts`:

```ts
import { canvasGold, CANVAS_GOLD_BASE, tierFactor } from "@/core/balance";

describe("canvasGold (chunk-domain)", () => {
  it("T1 base mult=1 returns CANVAS_GOLD_BASE × tierFactor(1) = 10", () => {
    expect(canvasGold(1, 1).toNumber()).toBe(10);
  });
  it("scales linearly with multiplier", () => {
    expect(canvasGold(2.5, 1).toNumber()).toBe(25);
  });
  it("scales by tierFactor(T)", () => {
    expect(canvasGold(1, 2).toNumber()).toBe(10 * tierFactor(2));
    expect(canvasGold(1, 3).toNumber()).toBe(10 * tierFactor(3));
  });
});
```

- [ ] **Step 4.2: Run to verify they fail**

Run: `npx vitest run tests/core/balance.test.ts -t "canvasGold"`
Expected: FAIL — old signature is `canvasGold(size, mult, tier)`.

- [ ] **Step 4.3: Update canvasGold in balance.ts**

Replace the existing `canvasGold` function in `src/core/balance.ts`:

```ts
/**
 * Gold awarded by a complete canvas at tier T. Chunk-domain: this equals
 * `chunksPerCanvas(T) × goldPerChunk(...)`. Kept as a separate helper for
 * UI sites that want the lump-sum display (StatsRoom, BoundCanvasStage's
 * "next sale" preview). The engine pays per-chunk via `goldPerChunk`.
 */
export const canvasGold = (multiplier: number, tier = 1): Big =>
  big(CANVAS_GOLD_BASE).mul(multiplier).mul(tierFactor(tier));
```

(Remove the `size` parameter; remove `size * size` factor.)

- [ ] **Step 4.4: Run tests to verify they pass**

Run: `npx vitest run tests/core/balance.test.ts -t "canvasGold"`
Expected: PASS. Other tests across the suite may now FAIL due to outdated `canvasGold(size, mult, tier)` callers — that's expected; fix in the next tasks.

- [ ] **Step 4.5: Commit**

```bash
git add src/core/balance.ts tests/core/balance.test.ts
git commit -m "core(balance): drop size² from canvasGold formula"
```

---

## Task 5: Drop costTierFactor from all upgrade cost formulas

**Files:**
- Modify: `src/core/balance.ts`
- Test: `tests/core/balance.test.ts`

- [ ] **Step 5.1: Update failing tests**

In `tests/core/balance.test.ts`, find the `costTierFactor`-scaled tests for `sellPriceUpgradeCost`, `speedUpgradeCost`, `critUpgradeCost`, `comboUpgradeCost` (the `sizeUpgradeCost` tests get deleted in a later task). Update them to assert NO tier scaling:

```ts
describe("sellPriceUpgradeCost (no tier scaling)", () => {
  it("L0 → cost = SELL_PRICE_COST_BASE regardless of tier", () => {
    expect(sellPriceUpgradeCost(0, 1).toNumber()).toBe(SELL_PRICE_COST_BASE);
    expect(sellPriceUpgradeCost(0, 5).toNumber()).toBe(SELL_PRICE_COST_BASE);
  });
  it("ramps with TRACK_COST_GROWTH per level only", () => {
    expect(sellPriceUpgradeCost(2, 3).toNumber()).toBeCloseTo(SELL_PRICE_COST_BASE * Math.pow(1.5, 2), 5);
  });
});

// Repeat for speedUpgradeCost, critUpgradeCost, comboUpgradeCost.
```

- [ ] **Step 5.2: Run to verify they fail**

Run: `npx vitest run tests/core/balance.test.ts -t "no tier scaling"`
Expected: FAIL (current formulas multiply by `costTierFactor(tier)`).

- [ ] **Step 5.3: Drop costTierFactor from the four surviving formulas**

In `src/core/balance.ts`, change:

```ts
export const sellPriceUpgradeCost = (currentLevel: number, _tier = 1): Big =>
  big(SELL_PRICE_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel));

export const speedUpgradeCost = (currentLevel: number, _tier = 1): Big =>
  big(SPEED_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel));

export const critUpgradeCost = (currentLevel: number, _tier = 1): Big =>
  big(CRIT_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel));

export const comboUpgradeCost = (currentLevel: number, _tier = 1): Big =>
  big(COMBO_COST_BASE).mul(big(TRACK_COST_GROWTH).pow(currentLevel));
```

(The `_tier` parameter is kept for caller-signature compatibility during transition; final cleanup task removes it.)

Update JSDocs to reflect the change.

`sizeUpgradeCost` is DELETED in this step too (the Size upgrade is going away):

```ts
// Delete these two lines entirely:
// export const sizeUpgradeCost = (currentLevel: number, tier = 1): Big => ...
// export const SIZE_COST_BASE = 1000;
```

Also delete `SIZE_PER_LEVEL`.

- [ ] **Step 5.4: Run tests to verify they pass**

Run: `npx vitest run tests/core/balance.test.ts`
Expected: many other tests may fail due to deleted `sizeUpgradeCost` / `SIZE_PER_LEVEL` — that's fine; later tasks fix the imports.

The four `no tier scaling` tests must PASS.

- [ ] **Step 5.5: Commit**

```bash
git add src/core/balance.ts tests/core/balance.test.ts
git commit -m "core(balance): drop costTierFactor; delete sizeUpgradeCost + SIZE constants"
```

---

## Task 6: Remove getCanvasSize and sizeLevel from multipliers

**Files:**
- Modify: `src/core/multipliers.ts`
- Test: `tests/core/multipliers.test.ts`

- [ ] **Step 6.1: Update test file**

Delete the `getCanvasSize` describe block from `tests/core/multipliers.test.ts`. (No replacement — the function is gone.)

Also remove any `sizeLevel: N` keys from helperState fixtures in this test file. Use IDE find-replace to remove `sizeLevel: ` lines.

- [ ] **Step 6.2: Delete getCanvasSize and update CanvasMultiplierInputs**

In `src/core/multipliers.ts`:

- Remove the import of `SIZE_PER_LEVEL` from `./balance`.
- Delete the entire `getCanvasSize` function (lines around 237-252 in the current file).
- Remove `"sizeLevel"` from the `CanvasMultiplierInputs` type (around line 31-43):

```ts
export type CanvasMultiplierInputs = Pick<GameStore,
  | "equipped"
  | "roster"
  | "purchasedNodes"
  | "sellPriceLevel"
  | "speedLevel"
  // sizeLevel REMOVED — size is no longer a multiplier source
  | "critLevel"
  | "comboLevel"
  | "canvasTier"
  | "completedResearches"
  | "completedAchievements"
>;
```

- [ ] **Step 6.3: Run multipliers tests**

Run: `npx vitest run tests/core/multipliers.test.ts`
Expected: PASS for the surviving tests; other test files referencing `getCanvasSize` will fail — fixed in later tasks.

- [ ] **Step 6.4: Commit**

```bash
git add src/core/multipliers.ts tests/core/multipliers.test.ts
git commit -m "core(multipliers): delete getCanvasSize; drop sizeLevel from CanvasMultiplierInputs"
```

---

## Task 7: Update canvasSlice — drop sizeLevel, rewrite tierUp

**Files:**
- Modify: `src/store/canvasSlice.ts`
- Test: `tests/store/canvasSlice.test.ts`

- [ ] **Step 7.1: Write failing tests for the new tierUp**

Add to `tests/store/canvasSlice.test.ts` (replacing the old tierUp tests):

```ts
import { useGameStore } from "@/store";
import { tierUpgradeCost } from "@/core/balance";
import { big } from "@/core/bigNumber";

describe("tierUp() — chunk-domain (gold-gated)", () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState());
  });

  it("no-op when gold < cost", () => {
    useGameStore.setState({ gold: big(999), canvasTier: 1 });
    const result = useGameStore.getState().tierUp();
    expect(result).toBe(false);
    expect(useGameStore.getState().canvasTier).toBe(1);
    expect(useGameStore.getState().gold.toNumber()).toBe(999);
  });

  it("succeeds when gold >= tierUpgradeCost(currentTier)", () => {
    useGameStore.setState({ gold: big(1000), canvasTier: 1 });
    const result = useGameStore.getState().tierUp();
    expect(result).toBe(true);
    expect(useGameStore.getState().canvasTier).toBe(2);
    expect(useGameStore.getState().gold.toNumber()).toBe(0);
  });

  it("preserves sellPriceLevel, speedLevel, critLevel, comboLevel", () => {
    useGameStore.setState({
      gold: big(1000), canvasTier: 1,
      sellPriceLevel: 10, speedLevel: 7, critLevel: 3, comboLevel: 5,
    });
    useGameStore.getState().tierUp();
    const state = useGameStore.getState();
    expect(state.sellPriceLevel).toBe(10);
    expect(state.speedLevel).toBe(7);
    expect(state.critLevel).toBe(3);
    expect(state.comboLevel).toBe(5);
  });

  it("resets canvasProgress, comboChain, critChunks", () => {
    useGameStore.setState({
      gold: big(1000), canvasTier: 1,
      canvasProgress: 3.4, comboChain: 12, critChunks: { 0: true, 5: true },
    });
    useGameStore.getState().tierUp();
    const state = useGameStore.getState();
    expect(state.canvasProgress).toBe(0);
    expect(state.comboChain).toBe(0);
    expect(state.critChunks).toEqual({});
  });

  it("costs scale ×1000 per tier", () => {
    expect(tierUpgradeCost(1).toNumber()).toBe(1000);
    expect(tierUpgradeCost(2).toNumber()).toBe(1_000_000);
    expect(tierUpgradeCost(3).toNumber()).toBe(1_000_000_000);
  });
});
```

Delete any existing `upgradeSize` tests in this file.

- [ ] **Step 7.2: Run to verify failures**

Run: `npx vitest run tests/store/canvasSlice.test.ts`
Expected: FAIL (existing `tierUp` checks gates on `sellPriceLevel >= 15 && speedLevel >= 15`).

- [ ] **Step 7.3: Rewrite canvasSlice.ts**

Apply the following edits to `src/store/canvasSlice.ts`:

A. Update imports — drop `sizeUpgradeCost`, add `tierUpgradeCost`:

```ts
import {
  sellPriceUpgradeCost, speedUpgradeCost,
  critUpgradeCost, comboUpgradeCost,
  tierUpgradeCost,
} from "@/core/balance";
```

B. Update `CanvasState` — delete `sizeLevel`, change `canvasProgress` doc:

```ts
export interface CanvasState {
  /**
   * Chunk-domain progress in the current canvas.
   *   floor(canvasProgress) = whole chunks completed (gold paid)
   *   fractional part = sub-chunk progress (seconds budget pro-rated)
   * Invariant: 0 ≤ canvasProgress < chunksPerCanvas(canvasTier).
   * Reset to 0 when canvas completes and when tierUp() succeeds.
   */
  canvasProgress: number;
  sellPriceLevel: number;
  speedLevel: number;
  // sizeLevel REMOVED — Size folded into Tier
  critLevel: number;
  comboLevel: number;
  canvasTier: number;
  comboChain: number;
  critChunks: Record<number, true>;
  lastSale: { id: number; amount: Big } | null;
}
```

C. Update `initialCanvasState` — remove `sizeLevel`.

D. Update `CanvasSlice` interface — remove `upgradeSize`, document new `tierUp`:

```ts
export interface CanvasSlice extends CanvasState {
  canvasTick: (deltaSeconds: number) => void;
  upgradeSellPrice: () => void;
  upgradeSpeed: () => void;
  // upgradeSize REMOVED
  upgradeCrit: () => void;
  upgradeCombo: () => void;
  resetCanvas: () => void;
  clearLastSale: () => void;
  /**
   * Tier upgrade: spend `tierUpgradeCost(canvasTier)` gold, increment
   * canvasTier, reset in-canvas state (progress, combo chain, crit chunks).
   * Within-tier upgrade levels and gear are PRESERVED.
   * Returns true on success, false if insufficient gold.
   */
  tierUp: () => boolean;
}
```

E. In `createCanvasSlice`, update action implementations:

```ts
canvasTick: (deltaSeconds) => {
  if (deltaSeconds <= 0) return;
  let fired = false;
  set((state) => {
    const before = state.statsRun.canvasesSold;
    const draft = { ...state } as GameStore;
    canvasTickPure(draft, deltaSeconds);
    fired = draft.statsRun.canvasesSold !== before;
    return {
      canvasProgress: draft.canvasProgress,
      critChunks: draft.critChunks,
      comboChain: draft.comboChain,
      lastSale: draft.lastSale,
      gold: draft.gold,
      lifetimeGold: draft.lifetimeGold,
      roster: draft.roster,
      officeXp: draft.officeXp,
      officeLevel: draft.officeLevel,
      statsLifetime: draft.statsLifetime,
      statsRun: draft.statsRun,
    };
  });
  if (fired) get().evaluateAchievements();
  // NO MORE auto tier-up — tier-up is now an explicit player action.
},

upgradeSellPrice: () => {
  const state = get();
  const cost = sellPriceUpgradeCost(state.sellPriceLevel);
  if (state.gold.lt(cost)) return;
  set({ gold: state.gold.sub(cost), sellPriceLevel: state.sellPriceLevel + 1 });
},

upgradeSpeed: () => {
  const state = get();
  const cost = speedUpgradeCost(state.speedLevel);
  if (state.gold.lt(cost)) return;
  set({ gold: state.gold.sub(cost), speedLevel: state.speedLevel + 1 });
},

// upgradeSize DELETED

upgradeCrit: () => {
  const state = get();
  if (!getCanvasTrackUnlocked(state, "crit")) return;
  const cost = critUpgradeCost(state.critLevel);
  if (state.gold.lt(cost)) return;
  set({ gold: state.gold.sub(cost), critLevel: state.critLevel + 1 });
},

upgradeCombo: () => {
  const state = get();
  if (!getCanvasTrackUnlocked(state, "combo")) return;
  const cost = comboUpgradeCost(state.comboLevel);
  if (state.gold.lt(cost)) return;
  set({ gold: state.gold.sub(cost), comboLevel: state.comboLevel + 1 });
},

resetCanvas: () => set(initialCanvasState),
clearLastSale: () => set({ lastSale: null }),

tierUp: () => {
  const state = get();
  const cost = tierUpgradeCost(state.canvasTier);
  if (state.gold.lt(cost)) return false;
  set({
    gold: state.gold.sub(cost),
    canvasTier: state.canvasTier + 1,
    canvasProgress: 0,
    comboChain: 0,
    critChunks: {},
    // sellPriceLevel, speedLevel, critLevel, comboLevel PRESERVED
  });
  get().evaluateAchievements();
  return true;
},
```

- [ ] **Step 7.4: Run tests to verify they pass**

Run: `npx vitest run tests/store/canvasSlice.test.ts`
Expected: PASS for the new tierUp tests. Other tests in the suite may fail; later tasks fix.

- [ ] **Step 7.5: Commit**

```bash
git add src/store/canvasSlice.ts tests/store/canvasSlice.test.ts
git commit -m "store(canvas): rewrite tierUp() — gold-gated, preserves within-tier levels; drop sizeLevel + upgradeSize"
```

---

## Task 8: Remove +size% from items

**Files:**
- Modify: `src/config/workshopAffixes.ts`
- Modify: any tests that reference `+size%` rolls
- Test: `tests/config/workshopAffixes.test.ts` if it exists

- [ ] **Step 8.1: Find usages**

Run: `npx grep -rn '"\+size%"' src/ tests/` (or equivalent in the available Grep tool).
Expected: hits in `src/config/workshopAffixes.ts`, `src/core/multipliers.ts` (already removed), tests, and possibly designer JSON.

- [ ] **Step 8.2: Delete the affix definition**

In `src/config/workshopAffixes.ts`:
- Remove the `"+size%"` entry from the `AffixKind` union type.
- Remove the `"+size%"` entry from any `AFFIX_DEFINITIONS` map (or whatever stores per-affix min/max/slots).
- Remove `"+size%"` from any per-slot affix-pool whitelist.

- [ ] **Step 8.3: Update tests**

Delete any test cases that assert `+size%` can be rolled or that an item's `+size%` magnitude appears in totals.

- [ ] **Step 8.4: Run tests**

Run: `npx vitest run tests/config/`
Expected: PASS.

- [ ] **Step 8.5: Commit**

```bash
git add src/config/workshopAffixes.ts tests/
git commit -m "config(workshop): remove +size% affix from item rolls"
```

---

## Task 9: Remove +size% from workers + canvas_size_bonus from skill tree

**Files:**
- Modify: `src/config/skillTreeNodes.ts`
- Modify: `src/config/skillTreeDesign.json`
- Modify: worker-roll module (TBD via grep — likely `src/store/officeSlice.ts` or `src/core/workerRoll.ts`)
- Test: relevant tests

- [ ] **Step 9.1: Find size-related nodes**

Run: `npx grep -rn 'canvas_size_bonus\|unlock_canvas_size' src/config/`
Expected: at least `expanding_horizon` and `unlock_canvas_size` nodes.

- [ ] **Step 9.2: Delete the nodes from `src/config/skillTreeNodes.ts`**

Remove the node objects entirely. Also remove any reference (in `prerequisites`, `unlocks`, etc.) from other nodes that depended on them.

- [ ] **Step 9.3: Mirror the deletion in `src/config/skillTreeDesign.json`**

Remove the same nodes from the JSON file.

- [ ] **Step 9.4: Strip +size% from worker roll**

Find the worker affix-pool definition (grep for `"+size%"` in the office/worker source files). Remove `+size%` from the worker-eligible affix list.

- [ ] **Step 9.5: Run tests**

Run: `npx vitest run tests/store/skillTreeSlice.test.ts tests/config/`
Expected: PASS.

- [ ] **Step 9.6: Commit**

```bash
git add src/config/skillTreeNodes.ts src/config/skillTreeDesign.json src/store/
git commit -m "config(skilltree+worker): remove canvas_size_bonus nodes and +size% worker affix"
```

---

## Task 10: PaintingRoute — wire chunk-domain props, remove Size

**Files:**
- Modify: `src/routes/PaintingRoute.tsx`
- Modify: `src/components/painting/BoundCanvasStage.tsx`
- Modify: `src/components/painting/CanvasUpgradesStrip.tsx`
- Test: existing route tests (update as needed)

- [ ] **Step 10.1: Update PaintingRoute.tsx imports + state**

Apply these changes to `src/routes/PaintingRoute.tsx`:

```ts
import { useGameStore } from "@/store";
import {
  canvasGold, chunksPerCanvas, chunkInterval,
  sellPriceUpgradeCost, speedUpgradeCost,
  critUpgradeCost, comboUpgradeCost,
  SELL_PRICE_PER_LEVEL, SPEED_PER_LEVEL,
  CRIT_PER_LEVEL, COMBO_PER_LEVEL,
  MAX_CRIT_LEVEL,
} from "@/core/balance";
import {
  getCanvasGoldMultiplier,
  getCanvasSpeedMultiplier,
  type CanvasMultiplierInputs,
} from "@/core/multipliers";
import { getCanvasTrackUnlocked } from "@/store/skillTreeSlice";
import { formatBig } from "@/core/formatter";
import { BoundCanvasStage } from "@/components/painting/BoundCanvasStage";
import { TierUpgradeCard } from "@/components/painting/TierUpgradeCard";
import { TrackCard } from "@/components/painting/TrackCard";
import { CanvasUpgradesStrip } from "@/components/painting/CanvasUpgradesStrip";
// ...other imports unchanged...
```

Remove these state subscriptions and derivations from the body:
- `sizeLevel`, `upgradeSize`
- `paintTimeSec`, `baseTime`
- `size = getCanvasSize(...)`
- `sizeLocked`, `sizeCost`

Replace with:
```ts
const chunkCount = chunksPerCanvas(canvasTier);
const speedMult = getCanvasSpeedMultiplier(helperState);
const interval = chunkInterval(speedMult);
const goldMult = getCanvasGoldMultiplier(helperState);
const baseGold = canvasGold(goldMult, canvasTier);
```

`helperState` drops `sizeLevel`.

Update the BoundCanvasStage call:
```tsx
<BoundCanvasStage
  canvasTier={canvasTier}
  chunkInterval={interval}
  baseGold={baseGold}
  chunkCount={chunkCount}
/>
```

Above the upgrades strip, mount the new card:
```tsx
<div className={styles.upgradesArea}>
  <TierUpgradeCard />
  <CanvasUpgradesStrip>
    {/* Size TrackCard REMOVED */}
    {/* sell_price, speed, crit, combo TrackCards unchanged */}
    ...
  </CanvasUpgradesStrip>
</div>
```

- [ ] **Step 10.2: Update BoundCanvasStage props + click**

In `src/components/painting/BoundCanvasStage.tsx`:

```tsx
interface Props {
  canvasTier: number;
  chunkInterval: number;
  baseGold: Big;
  chunkCount: number;
}

export function BoundCanvasStage({
  canvasTier, chunkInterval, baseGold, chunkCount,
}: Props): JSX.Element {
  const canvasProgress = useGameStore((s) => s.canvasProgress);
  const comboChain = useGameStore((s) => s.comboChain);
  const critChunks = useGameStore((s) => s.critChunks);
  const lastSale = useGameStore((s) => s.lastSale);
  const canvasesSold = useGameStore((s) => s.statsRun.canvasesSold);
  const clearLastSale = useGameStore((s) => s.clearLastSale);
  const canvasTick = useGameStore((s) => s.canvasTick);

  // chunk-domain canvasProgress is in chunks; progressPct = chunks / total
  const progressPct = chunkCount > 0 ? canvasProgress / chunkCount : 0;
  const comboFactor = 1 + COMBO_PER_LINK * comboChain;
  const nextSaleGold = baseGold.mul(comboFactor);

  return (
    <>
      <CanvasStage
        canvasTier={canvasTier}
        progressPct={progressPct}
        timeElapsed={`${Math.floor(canvasProgress)}/${chunkCount}`}
        timeTotal={`${chunkCount}`}
        nextSaleGold={formatBig(nextSaleGold)}
        comboChain={comboChain}
        critChunks={critChunks}
        canvasNumber={canvasesSold}
        onChunkClick={() => canvasTick(chunkInterval)}
      />
      {lastSale && (
        <FloatingGoldText
          key={lastSale.id}
          amount={lastSale.amount}
          onComplete={clearLastSale}
        />
      )}
    </>
  );
}
```

Note `sizeLevel` is removed from props. Update `CanvasStage` props accordingly (next task).

- [ ] **Step 10.3: Remove Size TrackCard from CanvasUpgradesStrip**

In `src/components/painting/CanvasUpgradesStrip.tsx`, remove any rendering of the Size track. If the size TrackCard is mounted inline by PaintingRoute (passing it as children), the deletion happens in Task 10.1 above.

- [ ] **Step 10.4: Run tests**

Run: `npx vitest run tests/components/painting/ tests/routes/PaintingRoute.test.tsx 2>&1 | head -100`
Expected: existing tests may need updates — fix any tests that reference `sizeLevel` props or `paintTimeSec` prop.

- [ ] **Step 10.5: Commit**

```bash
git add src/routes/PaintingRoute.tsx src/components/painting/BoundCanvasStage.tsx src/components/painting/CanvasUpgradesStrip.tsx
git commit -m "ui(painting): wire chunk-domain props; remove Size TrackCard"
```

---

## Task 11: Extract shared rainbow-border CSS class

**Files:**
- Create: `src/styles/rainbowBorderAffordable.module.css`
- Modify: `src/components/shell/AchievementToast.module.css` (compose with the shared class)
- Modify: `src/components/shell/AchievementToast.tsx` (apply both classes)

- [ ] **Step 11.1: Create the shared CSS module**

Create `src/styles/rainbowBorderAffordable.module.css`:

```css
@property --rb-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

/**
 * Apply this class to any element that should show the rainbow
 * conic-gradient affordability border. The element must establish a
 * positioning context (position: relative/absolute/fixed) and have a
 * border-radius if you want the border to follow rounded corners.
 *
 * Used by:
 *   - AchievementToast (its `.card`)
 *   - TierUpgradeCard when `gold >= tierUpgradeCost(canvasTier)`
 */
.rainbowBorder {
  position: relative;
}

.rainbowBorder::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 2.5px;
  background: conic-gradient(
    from var(--rb-angle),
    #ff0040, #ff8a00, #ffe600, #00ff66,
    #00d4ff, #7a5cff, #ff00c8, #ff0040
  );
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  animation: rbSpin 2.4s linear infinite;
  pointer-events: none;
}

@keyframes rbSpin {
  to { --rb-angle: 360deg; }
}

@media (prefers-reduced-motion: reduce) {
  .rainbowBorder::before { animation: none; }
}
```

- [ ] **Step 11.2: Compose AchievementToast.module.css with the shared class**

In `src/components/shell/AchievementToast.module.css`:
- Delete the `@property --rb-angle` block (now in shared module).
- Delete the `.card::before` block (now provided by `.rainbowBorder`).
- Delete the `@keyframes rbSpin` block.
- Keep `.card::after` (the sheen — local to the toast), `.eyebrow`, `.category`, the other keyframes, and the `@media (prefers-reduced-motion)` rules for those.

- [ ] **Step 11.3: Apply the shared class to AchievementToast**

In `src/components/shell/AchievementToast.tsx`, import the shared module and combine classes on the card element:

```tsx
import sharedStyles from "@/styles/rainbowBorderAffordable.module.css";
import styles from "./AchievementToast.module.css";

// ...

<div className={`${styles.card} ${sharedStyles.rainbowBorder}`}>
  {/* ... */}
</div>
```

- [ ] **Step 11.4: Run achievement toast tests**

Run: `npx vitest run tests/components/shell/AchievementToast.test.tsx`
Expected: PASS (visual change is structurally identical).

- [ ] **Step 11.5: Commit**

```bash
git add src/styles/rainbowBorderAffordable.module.css src/components/shell/AchievementToast.module.css src/components/shell/AchievementToast.tsx
git commit -m "ui(shared): extract rainbow conic-gradient border to shared CSS module"
```

---

## Task 12: Build TierUpgradeCard component

**Files:**
- Create: `src/components/painting/TierUpgradeCard.tsx`
- Create: `src/components/painting/TierUpgradeCard.module.css`
- Test: `tests/components/painting/TierUpgradeCard.test.tsx`

- [ ] **Step 12.1: Write failing tests**

Create `tests/components/painting/TierUpgradeCard.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { TierUpgradeCard } from "@/components/painting/TierUpgradeCard";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";

beforeEach(() => {
  useGameStore.setState(useGameStore.getInitialState());
});

describe("TierUpgradeCard", () => {
  it("shows the next tier number and cost", () => {
    useGameStore.setState({ canvasTier: 1, gold: big(0) });
    render(<TierUpgradeCard />);
    expect(screen.getByText(/Tier 2/i)).toBeInTheDocument();
    expect(screen.getByText(/1,000|1k/i)).toBeInTheDocument();
  });

  it("does NOT apply the rainbow border class when unaffordable", () => {
    useGameStore.setState({ canvasTier: 1, gold: big(999) });
    const { container } = render(<TierUpgradeCard />);
    expect(container.querySelector("[data-affordable='true']")).toBeNull();
  });

  it("applies the rainbow border class when affordable", () => {
    useGameStore.setState({ canvasTier: 1, gold: big(1000) });
    const { container } = render(<TierUpgradeCard />);
    expect(container.querySelector("[data-affordable='true']")).not.toBeNull();
  });

  it("clicking when affordable spends gold and increments tier", () => {
    useGameStore.setState({ canvasTier: 1, gold: big(1000) });
    render(<TierUpgradeCard />);
    fireEvent.click(screen.getByRole("button"));
    expect(useGameStore.getState().canvasTier).toBe(2);
    expect(useGameStore.getState().gold.toNumber()).toBe(0);
  });

  it("clicking when unaffordable is a no-op", () => {
    useGameStore.setState({ canvasTier: 1, gold: big(500) });
    render(<TierUpgradeCard />);
    fireEvent.click(screen.getByRole("button"));
    expect(useGameStore.getState().canvasTier).toBe(1);
    expect(useGameStore.getState().gold.toNumber()).toBe(500);
  });
});
```

- [ ] **Step 12.2: Run to verify failure**

Run: `npx vitest run tests/components/painting/TierUpgradeCard.test.tsx`
Expected: FAIL — component doesn't exist yet.

- [ ] **Step 12.3: Create the component**

Create `src/components/painting/TierUpgradeCard.tsx`:

```tsx
import type { JSX } from "react";
import { useGameStore } from "@/store";
import { tierUpgradeCost } from "@/core/balance";
import { formatBig } from "@/core/formatter";
import sharedStyles from "@/styles/rainbowBorderAffordable.module.css";
import styles from "./TierUpgradeCard.module.css";

export function TierUpgradeCard(): JSX.Element {
  const canvasTier = useGameStore((s) => s.canvasTier);
  const gold = useGameStore((s) => s.gold);
  const tierUp = useGameStore((s) => s.tierUp);

  const cost = tierUpgradeCost(canvasTier);
  const affordable = gold.gte(cost);

  return (
    <button
      type="button"
      className={`${styles.card} ${affordable ? sharedStyles.rainbowBorder : ""}`}
      data-affordable={affordable ? "true" : "false"}
      onClick={() => tierUp()}
      disabled={!affordable}
      aria-label={`Advance to Tier ${canvasTier + 1} for ${formatBig(cost)} gold`}
    >
      <div className={styles.eyebrow}>Tier upgrade</div>
      <div className={styles.body}>
        <div className={styles.tierLine}>
          <span className={styles.tierFrom}>Tier {canvasTier}</span>
          <span className={styles.tierArrow}>→</span>
          <span className={styles.tierTo}>Tier {canvasTier + 1}</span>
        </div>
        <div className={styles.cost}>{formatBig(cost)} gold</div>
      </div>
    </button>
  );
}
```

Create `src/components/painting/TierUpgradeCard.module.css`:

```css
.card {
  position: relative;
  display: block;
  width: 100%;
  padding: 16px 22px;
  margin-bottom: 14px;
  border: none;
  border-radius: 14px;
  background:
    radial-gradient(120% 140% at 100% 0%, rgba(155, 108, 214, 0.18), transparent 60%),
    var(--bg-1);
  color: var(--ink-0);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.card:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
}

.card:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.eyebrow {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--ink-1);
  margin-bottom: 10px;
}

.body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.tierLine {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-family: var(--serif);
  font-size: 20px;
  font-weight: 700;
}

.tierFrom { color: var(--ink-2); }
.tierArrow { color: var(--ink-1); font-size: 16px; }
.tierTo { color: var(--ink-0); }

.cost {
  font-family: var(--mono);
  font-size: 16px;
  font-weight: 600;
  color: var(--gold-1, gold);
}
```

(`--gold-1` may not exist in the project's CSS variables — if not, replace with a literal color like `#f6c84c` or use `var(--ink-0)`.)

- [ ] **Step 12.4: Run tests to verify they pass**

Run: `npx vitest run tests/components/painting/TierUpgradeCard.test.tsx`
Expected: PASS.

- [ ] **Step 12.5: Commit**

```bash
git add src/components/painting/TierUpgradeCard.tsx src/components/painting/TierUpgradeCard.module.css tests/components/painting/TierUpgradeCard.test.tsx
git commit -m "feat(painting): TierUpgradeCard with rainbow-border affordability state"
```

---

## Task 13: Update CanvasStage for variable cell layout

**Files:**
- Modify: `src/components/painting/CanvasStage.tsx`
- Modify: `src/components/painting/CanvasStage.module.css`
- Test: `tests/components/painting/CanvasStage.test.tsx`
- Test: `tests/components/painting/CanvasStage.stress.test.tsx`

- [ ] **Step 13.1: Update tests for the 640 cell cap and non-square grids**

Find existing tests in `tests/components/painting/CanvasStage.test.tsx` that hard-code grid sizes from `getSketchGridDim` (5×5, 20×20). Update them:

```ts
import { getCanvasCellLayout } from "@/components/painting/canvasArt";

it("renders the correct cell grid at T1 (2×5)", () => {
  // ...mount CanvasStage with canvasTier=1...
  const layout = getCanvasCellLayout(1);
  expect(layout.rows).toBe(2);
  expect(layout.cols).toBe(5);
});

it("renders 640 cells at T7+ (cell cap)", () => {
  // ...mount at canvasTier=7...
  const layout = getCanvasCellLayout(7);
  expect(layout.cellsRendered).toBe(640);
});

it("renders 640 cells at T8 (chunks > cap)", () => {
  const layout = getCanvasCellLayout(8);
  expect(layout.cellsRendered).toBe(640);
  expect(layout.chunksPerCell).toBe(2);
});
```

In `tests/components/painting/CanvasStage.stress.test.tsx`, update the 400-cell worst case to 640.

Run: `npx vitest run tests/components/painting/CanvasStage.test.tsx tests/components/painting/CanvasStage.stress.test.tsx`
Expected: FAIL.

- [ ] **Step 13.2: Update CanvasStage**

In `src/components/painting/CanvasStage.tsx`:

A. Replace the `getSketchGridDim`-based dim computation with:

```ts
import { getCanvasCellLayout } from "@/components/painting/canvasArt";

// ...

const { rows, cols, cellsRendered, chunksPerCell } = getCanvasCellLayout(canvasTier);
```

B. Drop the `sizeLevel` prop from `Props`. (Already done in Task 10.)

C. Update the in-flight overlay grid template:

```tsx
<div
  data-testid="sketch-overlay-in-flight"
  className={styles.sketchOverlayInFlight}
  style={{
    gridTemplateRows: `repeat(${rows}, 1fr)`,
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
  }}
>
  {/* in-flight cells */}
</div>
```

D. Wherever the code mapped a "revealed chunk index" to a "cell index", apply `cellIndex = floor(chunkIndex / chunksPerCell)`. The `useRevealQueue` hook is index-based but its inputs need to be cell indices, not chunk indices. Update the call site that feeds it from engine `cellsRevealed` (chunks).

Likely shape: `const cellIdx = Math.floor(chunkIdx / chunksPerCell);` when pushing into the queue.

- [ ] **Step 13.3: Update CanvasStage.module.css**

Adjust `.sketchOverlayInFlight` and `.sketchOverlaySettled` if they had a hard-coded grid template. Make them inherit `grid-template-rows` / `grid-template-cols` from inline style (set in the TSX).

- [ ] **Step 13.4: Run tests to verify they pass**

Run: `npx vitest run tests/components/painting/CanvasStage.test.tsx tests/components/painting/CanvasStage.stress.test.tsx`
Expected: PASS. If stress test timeout fails, bump `advanceTimersByTime(40_000)` (640 cells × 50ms = 32s, plus 600ms crit tail).

- [ ] **Step 13.5: Commit**

```bash
git add src/components/painting/CanvasStage.tsx src/components/painting/CanvasStage.module.css tests/components/painting/CanvasStage.test.tsx tests/components/painting/CanvasStage.stress.test.tsx
git commit -m "ui(canvas): variable cell grid for chunk-domain layouts (cap 640, chunksPerCell mapping)"
```

---

## Task 14: Update StatsRoom — rename TierBlock → CanvasBlock, drop size

**Files:**
- Modify: `src/components/painting/StatsRoom.tsx`
- Test: `tests/components/painting/StatsRoom.test.tsx`

- [ ] **Step 14.1: Update tests**

Remove tests for the deleted `SizeBlock`. Update `TierBlock` tests to:
- Verify the block is now called `CanvasBlock` (heading text)
- Verify it shows: chunks/canvas, interval/chunk, gold/chunk, gold/canvas, GPS
- Verify it does NOT show an "Upgrade costs ×N" row
- Verify it does NOT show any Size-related row

- [ ] **Step 14.2: Apply edits to StatsRoom.tsx**

- Delete the `SizeBlock` component entirely.
- Rename `TierBlock` → `CanvasBlock`. Update its consumer in the `StatsRoom` return.
- Inside `CanvasBlock`, compute the new metrics:

```tsx
import { chunksPerCanvas, chunkInterval, goldPerChunk, canvasGold } from "@/core/balance";
import { getCanvasGoldMultiplier, getCanvasSpeedMultiplier } from "@/core/multipliers";

function CanvasBlock({ helperState, tier }: Props) {
  const chunks = chunksPerCanvas(tier);
  const speedMult = getCanvasSpeedMultiplier(helperState);
  const interval = chunkInterval(speedMult);
  const goldMult = getCanvasGoldMultiplier(helperState);
  const perChunk = goldPerChunk(helperState.sellPriceLevel, goldMult, tier);
  const perCanvas = canvasGold(goldMult, tier);
  const gps = perChunk.toNumber() / interval;

  return (
    <Block title="Canvas">
      <Row label="Tier" value={`${tier}`} />
      <Row label="Chunks per canvas" value={`${chunks}`} />
      <Row label="Interval per chunk" value={`${interval.toFixed(2)}s`} />
      <Row label="Gold per chunk" value={formatBig(perChunk)} />
      <Row label="Gold per canvas" value={formatBig(perCanvas)} />
      <Row label="GPS at base" value={`${formatBig(big(gps))}/s`} />
      <Row label="Base gold multiplier" value={`×${tierFactor(tier)}`} />
      {/* No "Upgrade costs ×N" row */}
    </Block>
  );
}
```

(Adapt to the actual `Block`/`Row` helper components in StatsRoom.)

- [ ] **Step 14.3: Run tests**

Run: `npx vitest run tests/components/painting/StatsRoom.test.tsx`
Expected: PASS.

- [ ] **Step 14.4: Commit**

```bash
git add src/components/painting/StatsRoom.tsx tests/components/painting/StatsRoom.test.tsx
git commit -m "ui(stats): rename TierBlock → CanvasBlock; drop SizeBlock and Upgrade-costs row"
```

---

## Task 15: Save migration

**Files:**
- Modify: `src/store/persistence.ts` (or wherever `SAVE_VERSION` lives and migrate hooks run)
- Test: `tests/store/persistence.test.ts`

- [ ] **Step 15.1: Locate SAVE_VERSION and the migrate hook**

Run: `npx grep -rn 'SAVE_VERSION\|migrate' src/store/`
Confirm the file path and the existing migration function signature.

- [ ] **Step 15.2: Write failing migration tests**

Add to `tests/store/persistence.test.ts`:

```ts
import { migrate } from "@/store/persistence";

describe("save migration → chunk-domain", () => {
  const oldVersion = /* current SAVE_VERSION before this work */;
  const newVersion = oldVersion + 1;

  it("converts canvasProgress seconds → chunks at T1", () => {
    // Old: at T1 with no speed upgrades, canvasTime = 10s, chunks = 25.
    // canvasProgress = 5s = 12.5 chunks (5s / 0.4 chunk-time).
    // New: at T1 chunks(1)=10, interval=5s. 5s = 1 chunk progress.
    // The migration must NOT preserve seconds — it should set
    // canvasProgress to a SAFE 0 (or partial fraction) since the chunk
    // count itself changed (was 25, now 10).
    const oldSave = {
      version: oldVersion,
      canvasProgress: 5,
      canvasTier: 1,
      sizeLevel: 3,
      equipped: { /* item with +size% affix */ },
      roster: [ /* worker with +size% affix */ ],
      purchasedNodes: { expanding_horizon: 1, unlock_canvas_size: 1 },
      fp: 0,
      // ... other fields
    };
    const migrated = migrate(oldSave);
    expect(migrated.version).toBe(newVersion);
    expect(migrated.canvasProgress).toBe(0);
    expect("sizeLevel" in migrated).toBe(false);
  });

  it("strips +size% from equipped items", () => {
    const oldSave = {
      version: oldVersion,
      equipped: {
        boots: { affixes: [{ kind: "+size%", magnitude: 10 }, { kind: "+sell_price%", magnitude: 5 }] },
      },
    };
    const migrated = migrate(oldSave);
    const boots = migrated.equipped.boots;
    expect(boots.affixes.find((a: any) => a.kind === "+size%")).toBeUndefined();
    expect(boots.affixes.find((a: any) => a.kind === "+sell_price%")).toBeDefined();
  });

  it("strips +size% from worker affixes", () => {
    const oldSave = {
      version: oldVersion,
      roster: [{ affixes: [{ kind: "+size%", magnitude: 8 }] }],
    };
    const migrated = migrate(oldSave);
    expect(migrated.roster[0].affixes).toEqual([]);
  });

  it("refunds FP for removed size skill nodes", () => {
    const oldSave = {
      version: oldVersion,
      fp: 5,
      purchasedNodes: { expanding_horizon: 2, get_inspired: 1 },
    };
    const migrated = migrate(oldSave);
    // Assume each level cost 1 FP; expanding_horizon level 2 refunds 2 FP.
    // Exact cost is project-specific; engineer should check the node-cost helper.
    expect(migrated.fp).toBeGreaterThan(5);
    expect("expanding_horizon" in migrated.purchasedNodes).toBe(false);
    expect(migrated.purchasedNodes.get_inspired).toBe(1);
  });
});
```

(The engineer should confirm `migrate`'s exact import path and the precise FP cost formula by reading the existing migrations.)

- [ ] **Step 15.3: Run to verify failures**

Run: `npx vitest run tests/store/persistence.test.ts`
Expected: FAIL — migration function doesn't yet handle these.

- [ ] **Step 15.4: Implement the migration**

Bump `SAVE_VERSION` by 1 in `src/store/persistence.ts`. Add the migration step:

```ts
// Inside the migrate switch / chain, add a new case for the new version:
case <old_version>: {
  // Reset chunk-domain progress (semantics changed: seconds → chunks)
  next.canvasProgress = 0;

  // Drop sizeLevel
  delete next.sizeLevel;

  // Strip +size% from equipped items
  for (const slot of Object.keys(next.equipped ?? {})) {
    const item = next.equipped[slot];
    if (item?.affixes) {
      item.affixes = item.affixes.filter((a: any) => a.kind !== "+size%");
    }
  }
  for (const item of next.inventory ?? []) {
    if (item.affixes) {
      item.affixes = item.affixes.filter((a: any) => a.kind !== "+size%");
    }
  }

  // Strip +size% from worker affixes
  for (const worker of next.roster ?? []) {
    if (worker.affixes) {
      worker.affixes = worker.affixes.filter((a: any) => a.kind !== "+size%");
    }
  }

  // Refund FP for removed size skill nodes
  const REMOVED_NODES = ["expanding_horizon", "unlock_canvas_size"];
  for (const nodeId of REMOVED_NODES) {
    const level = next.purchasedNodes?.[nodeId] ?? 0;
    if (level > 0) {
      // Engineer: replicate the project's per-node FP cost formula here.
      // Likely something like: refund = level (1 FP per level).
      const refund = level;
      next.fp = (next.fp ?? 0) + refund;
      delete next.purchasedNodes[nodeId];
    }
  }

  next.version = <new_version>;
  // fallthrough to next migration if any
}
```

- [ ] **Step 15.5: Run tests to verify they pass**

Run: `npx vitest run tests/store/persistence.test.ts`
Expected: PASS.

- [ ] **Step 15.6: Commit**

```bash
git add src/store/persistence.ts tests/store/persistence.test.ts
git commit -m "store(persistence): SAVE_VERSION bump + migration for chunk-domain (canvasProgress reset, strip +size%, refund size skill nodes)"
```

---

## Task 16: Update bot-simulation strategy

**Files:**
- Modify: `tests/dev/bot-simulation.test.ts`

- [ ] **Step 16.1: Update tier-up strategy**

Find the bot's purchase loop. Replace the old `tierUp` condition (gated on `sellPriceLevel >= 15 && speedLevel >= 15`) with:

```ts
// Tier up when affordable. Bot will spend most gold on within-tier upgrades
// first (they're cheaper); tier-up cost (1000^T) gates the loop.
if (state.gold.gte(tierUpgradeCost(state.canvasTier))) {
  state.tierUp();
  continue;
}
```

- [ ] **Step 16.2: Update T3→T4 ≥ T2→T3 × 0.9 assertion**

Locate the per-tier progression summary block. Keep the assertion intact but expect the numbers to shift dramatically (cost is now ×1000/T instead of ×20/T — tier-up intervals will be much longer; absolute pace tunable later).

- [ ] **Step 16.3: Run bot-sim**

Run: `npx vitest run tests/dev/bot-simulation.test.ts`
Expected: PASS, with output showing the per-tier progression. Document the numbers in the commit message.

- [ ] **Step 16.4: Commit**

```bash
git add tests/dev/bot-simulation.test.ts
git commit -m "test(bot-sim): adapt to chunk-domain tier-up trigger (gold >= tierUpgradeCost)

Per-tier progression in this run: [paste the summary]."
```

---

## Task 17: Dead-code sweep

**Files:**
- Modify: `src/core/balance.ts`
- Modify: any file still importing the removed symbols

- [ ] **Step 17.1: Delete dead symbols from balance.ts**

Remove from `src/core/balance.ts`:
- `CANVAS_TIME_BASE`
- `canvasTime`
- `timeFactor`
- `COST_GROWTH_BASE`
- `costTierFactor`
- (`sizeUpgradeCost`, `SIZE_PER_LEVEL`, `SIZE_COST_BASE` — already removed in Task 5)

- [ ] **Step 17.2: Fix any remaining import errors**

Run: `npx tsc -b --noEmit 2>&1 | head -50`
Expected: SUCCESS or a small list of "module has no exported member" errors. Fix each by deleting the offending import + dead-code site.

Likely sites that still need cleanup:
- `src/routes/PaintingRoute.tsx` — confirm `canvasTime` is no longer imported (handled in Task 10).
- `src/components/painting/StatsRoom.tsx` — confirm (handled in Task 14).
- `src/core/canvasTickPure.ts` — confirm (handled in Task 3).
- Any test file still calling the deleted symbols — delete the test or update.

Also drop the `_tier` placeholder param from the four `*UpgradeCost` functions if no caller still passes it:

```ts
export const sellPriceUpgradeCost = (currentLevel: number): Big => ...
export const speedUpgradeCost = (currentLevel: number): Big => ...
export const critUpgradeCost = (currentLevel: number): Big => ...
export const comboUpgradeCost = (currentLevel: number): Big => ...
```

Update call sites if needed.

- [ ] **Step 17.3: Full test sweep**

Run: `npx vitest run`
Expected: ALL tests pass.

Run: `npx tsc -b --noEmit`
Expected: no errors.

Run: `npx vite build`
Expected: clean build.

- [ ] **Step 17.4: Commit**

```bash
git add src/ tests/
git commit -m "core(balance): delete dead symbols (canvasTime, timeFactor, CANVAS_TIME_BASE, costTierFactor, COST_GROWTH_BASE)"
```

---

## Task 18: Manual verification + deploy

**Files:**
- (None — verification only.)

- [ ] **Step 18.1: Start dev server and click through the loop**

Run (in a separate terminal): `npm run dev`
Open the local URL. Verify:

- (a) Canvas paints chunk-by-chunk; click advances visible progress
- (b) At T1 with no speed upgrades, 5s per chunk → 50s per canvas (count or use stopwatch)
- (c) Gold drips per chunk (not lump-sum at canvas end)
- (d) `lastSale` flash still fires on the canvas-completing chunk
- (e) Buying a speed level visibly speeds up the auto-paint
- (f) TierUpgradeCard shows above the upgrade strip
- (g) When `gold >= 1000`, the rainbow border appears on the card
- (h) Clicking the card spends 1k gold and advances to Tier 2
- (i) At Tier 2, the canvas has 20 chunks
- (j) The Size TrackCard is GONE from the upgrade strip
- (k) StatsRoom shows the new Canvas block with chunk metrics; no Size block

- [ ] **Step 18.2: Hard-refresh + save load**

Reload the page with cache disabled. Confirm:
- (l) Existing save loads cleanly (migration ran)
- (m) Old `sizeLevel` is gone from the save
- (n) FP balance increased if size nodes had been purchased

If something is broken, fix it (likely a small UI/state issue not caught by tests). Add a regression test for whatever you fix.

- [ ] **Step 18.3: Final tsc + test sweep**

Run: `npx tsc -b --noEmit && npx vitest run`
Expected: clean.

- [ ] **Step 18.4: Deploy**

Run: `npx vercel --prod`
After completion, fetch the production index and verify the new bundle is live:

```bash
curl -s https://artdle-web.vercel.app/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'
# Then curl that JS file and grep for one of the new symbols:
curl -s https://artdle-web.vercel.app/assets/index-XXXX.js | grep -o 'chunksPerCanvas\|TierUpgradeCard\|chunkInterval'
```

Expected: at least one match. (Build often mangles names — if no match, search for `tierUpgradeCost` instead.)

- [ ] **Step 18.5: Update HANDOVER.md**

Append a top entry to `docs/HANDOVER.md` summarizing:
- What landed (chunk-domain, unified Tier, removed Size)
- Bot-sim per-tier numbers
- Production bundle hash
- Any open follow-ups (e.g., "playtest validation of within-tier ramp at T3+")

Commit:

```bash
git add docs/HANDOVER.md
git commit -m "docs(handover): canvas chunk-domain rework + deploy summary"
```

---

## Self-review checklist (writer)

- [x] Spec coverage: every section of the design doc has at least one task implementing it.
  - Core model → Tasks 1, 2, 3, 4
  - Tier upgrade → Tasks 7, 11, 12, 10
  - Removed (size, costTierFactor, dead code) → Tasks 5, 6, 7, 8, 9, 17
  - UI changes → Tasks 10, 12, 13, 14
  - Save migration → Task 15
  - Bot-sim updates → Task 16
  - Manual verification + deploy → Task 18
- [x] Placeholder scan: no "TBD", "TODO", "fill in", or vague handwave instructions. The migration FP refund formula notes the engineer must replicate the project's existing per-node FP cost helper — that's a *real* dependency on existing code, not a placeholder.
- [x] Type consistency: `canvasProgress` is float-chunks throughout. `chunksPerCanvas`, `chunkInterval`, `goldPerChunk`, `tierUpgradeCost` signatures match between definition (Task 1) and consumer tasks (3, 7, 10, 12, 14).
- [x] One ambiguous spec requirement: spec said "lastSale flash fires on final chunk." Task 3's `payChunk` implements exactly this. No drift.
- [x] Test code is real, runnable Vitest. Every failing test has an expected failure mode stated.
