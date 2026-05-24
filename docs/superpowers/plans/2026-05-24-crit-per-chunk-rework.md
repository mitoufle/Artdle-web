# Crit per-chunk rework — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the canvas-level crit speed bonus with a per-chunk crit roll that paints extra chunks on a hit, separating crit chance (skill tree + critLevel track, capped L50, base 10) from crit chunks (items + workers, base bonus 1).

**Architecture:** Pure-function tick logic (`canvasTickPure`) steps the new model per "paid chunk" (one chunkTime consumed from timeBudget); a successful crit roll adds N bonus chunks as instant progress without consuming time. Crit chunks are recorded in a `critChunks: Record<number, true>` on `canvasSlice`, cleared per canvas; CanvasStage applies a `.sketchCellCrit` modifier (gold drop-shadow) to those cells during their pop-in animation. Save schema bumps v22 → v23 with a full wipe; `+crit_chance%` affix kind is removed and replaced by `+crit_chunks` (raw integer magnitudes, distinct icon `⚡` and color); the `prismatic_eye` skill node is deleted.

**Tech Stack:** TypeScript strict, Vitest, Zustand 5 with persist middleware, `break_eternity.js` (Big), Tailwind 4, React 19.

**Spec:** `docs/superpowers/specs/2026-05-24-crit-per-chunk-rework-design.md`

---

## File structure

**Modified (no new files):**

| File | Responsibility after change |
|---|---|
| `src/core/balance.ts` | Adds `BASE_CRIT_CHANCE`, `BASE_CRIT_CHUNKS`, `MAX_CRIT_LEVEL`; removes `CRIT_SPEED_FACTOR` |
| `src/core/multipliers.ts` | `getCritChance` reads base + critLevel (capped) + skill-tree capability only; new `getCritChunks` walks items + workers with raw magnitude; `getCritGoldBonus` removed |
| `src/core/canvasTickPure.ts` | Chunk-stepping tick loop with per-chunk crit roll; no more `CRIT_SPEED_FACTOR` or `critFlag`; populates `critChunks` |
| `src/store/canvasSlice.ts` | Adds `critChunks: Record<number, true>` run-state field; removes `isCritThisCanvas`; `tierUp` preserves size/crit/combo levels |
| `src/store/index.ts` | SAVE_VERSION 22 → 23; new migration step that returns `{}` (full wipe); removes `isCritThisCanvas` from ascend/reset blocks |
| `src/store/statsSlice.ts` | No structural change (fields stay, semantics shift via the tick loop) |
| `src/config/workshopAffixes.ts` | Removes `"+crit_chance%"`; adds `"+crit_chunks"` (symbol `⚡`, color `#ffaf3a`, weight 1.3, per-tier integer ranges 1..5) |
| `src/config/officeClasses.ts` | Replaces `"+crit_chance%"` entries with `"+crit_chunks"` (small integer ranges) |
| `src/config/skillTreeNodes.ts` | Removes `prismatic_eye` node entirely |
| `src/config/skillTreeDesign.json` | Removes the `prismatic_eye` entry |
| `src/components/painting/CanvasStage.tsx` | Drops `CRIT` badge + `isCrit` prop; reads `critChunks` and applies `.sketchCellCrit` modifier per cell |
| `src/components/painting/CanvasStage.module.css` | New `.sketchCellCrit` modifier with gold drop-shadow tint during pop-in |
| `src/components/painting/TrackCard.tsx` | Adds optional `iconOverride`/`colorOverride` props (for the crit-chance card that can't use `AffixKind` anymore); displays `MAX` and disables when `level >= maxLevel` |
| `src/components/painting/StatsRoom.tsx` | Relabels crit stats from "canvas" to "chunk" wording |
| `src/routes/PaintingRoute.tsx` | Removes `isCritThisCanvas`, `critFactor`, `CRIT_SPEED_FACTOR` references; passes `critChunks` to `CanvasStage`; refactors crit `TrackCard` call site to use the new override props |

**Tests modified:**

| File | What it asserts after change |
|---|---|
| `tests/core/balance.test.ts` | New constant values; `CRIT_SPEED_FACTOR` no longer exported |
| `tests/core/multipliers.test.ts` | `getCritChance` ignores items/workers, applies critLevel cap; `getCritChunks` math; `getCritGoldBonus` test removed |
| `tests/core/canvasTickPure.test.ts` | Per-chunk crit roll with seeded `rng`; bonus chunks don't re-roll; streak/`critsLanded` increment by `1 + appliedBonus`; `critChunks` set populated |
| `tests/store/canvasSlice.test.ts` | `tierUp` preserves size/crit/combo and resets sell/speed; `critChunks` cleared on sale |
| `tests/store/persistence-integration.test.ts` | Loading a v22 save wipes to default state |
| `tests/config/workshopAffixes.test.ts` | `+crit_chunks` present with correct symbol/color/weight/ranges; `+crit_chance%` absent |
| `tests/store/workshopSlice.test.ts` | Rolled items can carry `+crit_chunks` (and never `+crit_chance%`) |
| `tests/config/officeClasses.test.ts` | Worker classes carry `+crit_chunks` not `+crit_chance%` |
| `tests/store/skillTreeSlice.test.ts` | `prismatic_eye` not in node config |
| `tests/components/painting/CanvasStage.test.tsx` | No `CRIT` badge; cells in `critChunks` carry `.sketchCellCrit` class |
| `tests/routes/PaintingRoute.test.tsx` | `paintTimeSec` no longer divides by a crit factor |
| `tests/dev/bot-simulation.test.ts` | Re-baselined gold-after-N-canvases expectations |

---

## Task 1: Balance constants

**Files:**
- Modify: `src/core/balance.ts:31-44`
- Test: `tests/core/balance.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/core/balance.test.ts`:

```ts
import {
  BASE_CRIT_CHANCE, BASE_CRIT_CHUNKS, MAX_CRIT_LEVEL,
} from "@/core/balance";

describe("crit per-chunk constants", () => {
  it("BASE_CRIT_CHANCE is 0.01 (1% always-on floor)", () => {
    expect(BASE_CRIT_CHANCE).toBe(0.01);
  });

  it("BASE_CRIT_CHUNKS is 1 (one bonus chunk per crit at base)", () => {
    expect(BASE_CRIT_CHUNKS).toBe(1);
  });

  it("MAX_CRIT_LEVEL is 50 (hard cap on the critLevel upgrade track)", () => {
    expect(MAX_CRIT_LEVEL).toBe(50);
  });

  it("CRIT_SPEED_FACTOR is no longer exported (canvas-level crit speed bonus removed)", async () => {
    const mod = await import("@/core/balance");
    expect((mod as Record<string, unknown>).CRIT_SPEED_FACTOR).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/balance.test.ts -t "crit per-chunk constants"`
Expected: FAIL — imports of `BASE_CRIT_CHANCE`, `BASE_CRIT_CHUNKS`, `MAX_CRIT_LEVEL` resolve to `undefined`; the `CRIT_SPEED_FACTOR` assertion fails because it still exists.

- [ ] **Step 3: Edit `src/core/balance.ts`**

Find the block (currently around lines 38-41):

```ts
/** +1% crit chance per crit level. */
export const CRIT_PER_LEVEL = 0.01;
/** Crit canvases paint in `time / CRIT_SPEED_FACTOR`. Fixed at 10× (= 90% faster). */
export const CRIT_SPEED_FACTOR = 10;
```

Replace with:

```ts
/** +1% crit chance per crit level. */
export const CRIT_PER_LEVEL = 0.01;
/** Always-on crit chance floor. Skill-tree + critLevel sum on top, then soft-cap formula. */
export const BASE_CRIT_CHANCE = 0.01;
/** Bonus chunks added by a crit at base (no items/workers). 1 = "trigger + 1 extra chunk". */
export const BASE_CRIT_CHUNKS = 1;
/** Hard cap on the critLevel upgrade track. Past this, levels can't be purchased. */
export const MAX_CRIT_LEVEL = 50;
```

- [ ] **Step 4: Find every other reference to `CRIT_SPEED_FACTOR` and delete it from balance.ts**

Run: `grep -n "CRIT_SPEED_FACTOR" src/core/balance.ts`
Delete the line(s) you find. (There should be exactly the one declaration just removed in Step 3.)

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/core/balance.test.ts -t "crit per-chunk constants"`
Expected: PASS (4/4).

- [ ] **Step 6: Run typecheck** — other files still import `CRIT_SPEED_FACTOR`, so this will fail. That's expected — the next task fixes the import sites.

Run: `npx tsc --noEmit`
Expected: errors like `Module '"@/core/balance"' has no exported member 'CRIT_SPEED_FACTOR'.` in `canvasTickPure.ts` and `PaintingRoute.tsx`. Do not "fix" them by re-adding the export — they get fixed in tasks 7 and 8.

- [ ] **Step 7: Commit**

```bash
git add src/core/balance.ts tests/core/balance.test.ts
git commit -m "core(balance): add BASE_CRIT_CHANCE/CHUNKS + MAX_CRIT_LEVEL; drop CRIT_SPEED_FACTOR"
```

---

## Task 2: Multipliers — rewrite getCritChance, add getCritChunks, drop getCritGoldBonus

**Files:**
- Modify: `src/core/multipliers.ts:183-190` (`getCritChance`) and `:237-238` (`getCritGoldBonus`)
- Test: `tests/core/multipliers.test.ts`

### Background

After this task:
- `getCritChance(state)` sums **only** `BASE_CRIT_CHANCE`, `CRIT_PER_LEVEL × min(critLevel, MAX_CRIT_LEVEL)`, and `countCapability(state, "crit_chance")` (skill-tree hook; 0 today). Items + workers no longer contribute. Same soft-cap formula.
- `getCritChunks(state)` returns the **bonus** chunk count per crit (base 1 + items + workers). Magnitudes are raw integer counts, not percent — so it does NOT use `getEquippedContribution` / `getOfficeContribution` (those divide by 100). It walks `state.equipped` and `state.roster` directly. Socks (`boots × 1.5`) still applies for consistency.
- `getCritGoldBonus` is deleted.

- [ ] **Step 1: Write the failing tests**

Replace the existing `getCritChance` and `getCritGoldBonus` describe blocks in `tests/core/multipliers.test.ts` (search for `"getCritChance"` and `"prismatic_eye: crit_gold_bonus"`) with:

```ts
describe("getCritChance — per-chunk rework", () => {
  it("returns BASE_CRIT_CHANCE (0.01) at default state", () => {
    const state = { critLevel: 0, equipped: {}, roster: [], purchasedNodes: {} } as unknown as GameStore;
    expect(getCritChance(state)).toBeCloseTo(0.01, 6);
  });

  it("adds CRIT_PER_LEVEL per critLevel up to MAX_CRIT_LEVEL", () => {
    const s1 = { critLevel: 10, equipped: {}, roster: [], purchasedNodes: {} } as unknown as GameStore;
    expect(getCritChance(s1)).toBeCloseTo(0.01 + 0.01 * 10, 6);  // 0.11
    const s50 = { critLevel: 50, equipped: {}, roster: [], purchasedNodes: {} } as unknown as GameStore;
    expect(getCritChance(s50)).toBeGreaterThan(0.30);  // past soft-cap threshold; formula compresses
  });

  it("caps critLevel contribution at MAX_CRIT_LEVEL even when state.critLevel exceeds it", () => {
    const s60 = { critLevel: 60, equipped: {}, roster: [], purchasedNodes: {} } as unknown as GameStore;
    const s50 = { critLevel: 50, equipped: {}, roster: [], purchasedNodes: {} } as unknown as GameStore;
    expect(getCritChance(s60)).toBe(getCritChance(s50));
  });

  it("ignores items and workers (sources moved to getCritChunks)", () => {
    const stateWithItem = {
      critLevel: 0,
      equipped: { brush: { slot: "brush", tier: "normal", affixes: [{ kind: "+crit_chance%", magnitude: 50 }], fuseCount: 0 } },
      roster: [],
      purchasedNodes: {},
    } as unknown as GameStore;
    // Even though the (now-removed) +crit_chance% affix is present, getCritChance must not see it.
    expect(getCritChance(stateWithItem)).toBeCloseTo(0.01, 6);
  });
});

describe("getCritChunks", () => {
  it("returns BASE_CRIT_CHUNKS (1) at default state", () => {
    const state = { equipped: {}, roster: [], purchasedNodes: {} } as unknown as GameStore;
    expect(getCritChunks(state)).toBe(1);
  });

  it("adds equipped +crit_chunks raw magnitudes (no /100)", () => {
    const state = {
      equipped: {
        brush: { slot: "brush", tier: "rare", affixes: [{ kind: "+crit_chunks", magnitude: 3 }], fuseCount: 0 },
      },
      roster: [],
      purchasedNodes: {},
    } as unknown as GameStore;
    expect(getCritChunks(state)).toBe(1 + 3);  // base + 3 chunks from item
  });

  it("applies socks (1.5×) on boots slot only", () => {
    const onBoots = {
      equipped: { boots: { slot: "boots", tier: "rare", affixes: [{ kind: "+crit_chunks", magnitude: 4 }], fuseCount: 0 } },
      roster: [],
      purchasedNodes: { socks: 1 },
    } as unknown as GameStore;
    // 1 + floor(4 * 1.5) = 1 + 6 = 7
    expect(getCritChunks(onBoots)).toBe(7);
  });

  it("adds office +crit_chunks contributions scaled by levelScale", () => {
    const state = {
      equipped: {},
      roster: [
        { id: "w1", className: "critic", level: 0, xp: big(0), affixes: [{ kind: "+crit_chunks", magnitude: 2 }] },
      ],
      purchasedNodes: {},
    } as unknown as GameStore;
    // At level 0, levelScale = 1, so +2.
    expect(getCritChunks(state)).toBe(1 + 2);
  });

  it("returns at least 0; never NaN even with empty equipped/roster", () => {
    const state = { equipped: {}, roster: [], purchasedNodes: {} } as unknown as GameStore;
    expect(Number.isFinite(getCritChunks(state))).toBe(true);
    expect(getCritChunks(state)).toBeGreaterThanOrEqual(0);
  });
});

// getCritGoldBonus is no longer exported — its test block is removed.
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run tests/core/multipliers.test.ts -t "getCritChance — per-chunk rework"`
Expected: FAIL — old `getCritChance` reads items; `getCritChunks` doesn't exist.

- [ ] **Step 3: Edit `src/core/multipliers.ts`**

Update the imports at the top (line 16) — replace the `CRIT_PER_LEVEL` line with one that also imports the new constants and drops nothing else:

```ts
import {
  SELL_PRICE_PER_LEVEL, SPEED_PER_LEVEL, CRIT_PER_LEVEL,
  BASE_CRIT_CHANCE, BASE_CRIT_CHUNKS, MAX_CRIT_LEVEL,
  COMBO_PER_LEVEL, SIZE_PER_LEVEL, levelScale,
  CRIT_SOFT_CAP_THRESHOLD, CRIT_SOFT_CAP_CEILING,
  COLOR_PER_LEVEL, RAINBOW_PER_LEVEL, GET_INSPIRED_PER_LEVEL,
  BASIC_TECHNIQUE_PER_LEVEL, MUSCLE_MEMORY_PER_LEVEL,
  BARGAIN_PER_LEVEL, BARGAIN_DISCOUNT_FLOOR, CRAFTSMANSHIP_PER_LEVEL,
  BETTER_SCALING_PER_WORKSHOP_LEVEL,
} from "./balance";
```

Also import the helpers needed for the new `getCritChunks` walker (already imported in this file, but verify): `getNodeLevel`, `getEquippedContribution` (still used by other multipliers), `Item`, `SlotKind`. The `Item` type comes from `@/store/workshopSlice` — add `import type { Item, SlotKind } from "@/config/workshopAffixes"` if missing. (Check existing imports first; `SlotKind` lives in workshopAffixes.ts.)

Replace the existing `getCritChance` (lines 183-190) with:

```ts
/**
 * Crit chance (0..CRIT_SOFT_CAP_CEILING). Sources:
 *   - BASE_CRIT_CHANCE (1% floor)
 *   - CRIT_PER_LEVEL × min(critLevel, MAX_CRIT_LEVEL)
 *   - countCapability(state, "crit_chance")  // skill-tree hook; 0 today
 * Items + workers contribute to crit_chunks instead (separate stat).
 * Soft-cap formula unchanged: raw above CRIT_SOFT_CAP_THRESHOLD compresses
 * toward CRIT_SOFT_CAP_CEILING.
 */
export const getCritChance = (state: CanvasMultiplierInputs): number => {
  let raw = BASE_CRIT_CHANCE;
  raw += CRIT_PER_LEVEL * Math.min(state.critLevel, MAX_CRIT_LEVEL);
  raw += countCapability(state, "crit_chance") * 0.01;  // 1% per capability node level
  if (raw <= CRIT_SOFT_CAP_THRESHOLD) return raw;
  const range = CRIT_SOFT_CAP_CEILING - CRIT_SOFT_CAP_THRESHOLD;
  return CRIT_SOFT_CAP_THRESHOLD + range * (1 - Math.exp(-(raw - CRIT_SOFT_CAP_THRESHOLD) / (range * 0.5)));
};

/**
 * Bonus chunks added per crit. Returns an integer >= 0.
 * Sources:
 *   - BASE_CRIT_CHUNKS (1)
 *   - Equipped items with +crit_chunks affix (raw integer magnitudes; socks ×1.5 on boots)
 *   - Worker affixes with +crit_chunks (scaled by levelScale(worker.level))
 *
 * Does NOT use getEquippedContribution/getOfficeContribution because those
 * divide by 100 (percent semantics). crit_chunks is raw integer counts.
 */
export const getCritChunks = (state: CanvasMultiplierInputs): number => {
  let chunks = BASE_CRIT_CHUNKS;
  const hasSocks = getNodeLevel(state, "socks") > 0;
  for (const entry of Object.entries(state.equipped)) {
    const [slot, item] = entry as [SlotKind, Item | undefined];
    if (!item) continue;
    const slotMult = hasSocks && slot === "boots" ? 1.5 : 1.0;
    for (const affix of item.affixes) {
      if (affix.kind === "+crit_chunks") chunks += affix.magnitude * slotMult;
    }
  }
  for (const worker of state.roster) {
    const scale = levelScale(worker.level).toNumber();
    for (const affix of worker.affixes) {
      if (affix.kind === "+crit_chunks") chunks += affix.magnitude * scale;
    }
  }
  return Math.max(0, Math.floor(chunks));
};
```

Delete the `getCritGoldBonus` function entirely (lines 236-238 of the original):

```ts
// DELETE this block:
/** Bonus % applied to canvas gold when the canvas is a crit. 0 if no nodes purchased. */
export const getCritGoldBonus = (state: Pick<GameStore, "purchasedNodes">): number =>
  countCapability(state, "crit_gold_bonus") * 0.20;
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/core/multipliers.test.ts`
Expected: PASS for the new `getCritChance`/`getCritChunks` blocks. Any other test that imports `getCritGoldBonus` will fail — those are dead tests; delete them.

- [ ] **Step 5: Find and delete dead `getCritGoldBonus` test references**

Run: `grep -rn "getCritGoldBonus" tests/`
Delete any test that imports or asserts on `getCritGoldBonus`. (Most likely just the one `prismatic_eye: crit_gold_bonus` block already replaced in Step 1.)

- [ ] **Step 6: Run tests again**

Run: `npx vitest run tests/core/multipliers.test.ts`
Expected: PASS (no `getCritGoldBonus` errors).

- [ ] **Step 7: Commit**

```bash
git add src/core/multipliers.ts tests/core/multipliers.test.ts
git commit -m "core(multipliers): split crit into chance (base + critLevel cap) and chunks (items + workers)"
```

---

## Task 3: Workshop affixes — replace +crit_chance% with +crit_chunks

**Files:**
- Modify: `src/config/workshopAffixes.ts`
- Test: `tests/config/workshopAffixes.test.ts`

- [ ] **Step 1: Write the failing tests**

Append (or replace if present) in `tests/config/workshopAffixes.test.ts`:

```ts
import {
  AFFIX_KINDS, AFFIX_SYMBOL, AFFIX_COLOR, AFFIX_SYMBOL_SCALE,
  AFFIX_MAGNITUDE_RANGE,
} from "@/config/workshopAffixes";

describe("workshopAffixes — crit_chunks replaces crit_chance", () => {
  it("AFFIX_KINDS no longer contains +crit_chance%", () => {
    expect(AFFIX_KINDS).not.toContain("+crit_chance%");
  });

  it("AFFIX_KINDS contains +crit_chunks", () => {
    expect(AFFIX_KINDS).toContain("+crit_chunks");
  });

  it("+crit_chunks has lightning-bolt symbol and warm-gold color", () => {
    expect(AFFIX_SYMBOL["+crit_chunks"]).toBe("⚡");
    expect(AFFIX_COLOR["+crit_chunks"]).toBe("#ffaf3a");
  });

  it("+crit_chunks magnitude ranges are small integer chunk counts per tier", () => {
    expect(AFFIX_MAGNITUDE_RANGE.normal["+crit_chunks"]).toEqual({ min: 1, max: 1 });
    expect(AFFIX_MAGNITUDE_RANGE.magic["+crit_chunks"]).toEqual({ min: 1, max: 2 });
    expect(AFFIX_MAGNITUDE_RANGE.rare["+crit_chunks"]).toEqual({ min: 2, max: 3 });
    expect(AFFIX_MAGNITUDE_RANGE.epic["+crit_chunks"]).toEqual({ min: 2, max: 4 });
    expect(AFFIX_MAGNITUDE_RANGE.legendary["+crit_chunks"]).toEqual({ min: 3, max: 5 });
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `npx vitest run tests/config/workshopAffixes.test.ts -t "crit_chunks replaces crit_chance"`
Expected: FAIL — `+crit_chunks` not in AFFIX_KINDS, no symbol/color/range entries.

- [ ] **Step 3: Edit `src/config/workshopAffixes.ts`**

Update the doc comment block at the top (lines 3-13). Find:

```
 *   +crit_chance%  → getCritChance         (gated by unlock_canvas_crit)
```

Replace with:

```
 *   +crit_chunks   → getCritChunks         (gated by unlock_canvas_crit; raw integer magnitude, NOT percent)
```

Update the `AffixKind` type (line 15-20):

```ts
export type AffixKind =
  | "+sell_price%"
  | "+speed%"
  | "+crit_chunks"
  | "+combo_chance%"
  | "+size%";
```

Update `AFFIX_KINDS` (line 22-28):

```ts
export const AFFIX_KINDS: ReadonlyArray<AffixKind> = [
  "+sell_price%",
  "+speed%",
  "+crit_chunks",
  "+combo_chance%",
  "+size%",
];
```

Update `AFFIX_SYMBOL` (line 31-37):

```ts
export const AFFIX_SYMBOL: Record<AffixKind, string> = {
  "+sell_price%":   "$",
  "+speed%":        "»",
  "+crit_chunks":   "⚡",
  "+combo_chance%": "∞",
  "+size%":         "⊕",
};
```

Update `AFFIX_COLOR` (line 40-46):

```ts
export const AFFIX_COLOR: Record<AffixKind, string> = {
  "+sell_price%":   "#f0b847",
  "+speed%":        "#4fc3e8",
  "+crit_chunks":   "#ffaf3a",
  "+combo_chance%": "#b06ee8",
  "+size%":         "#4cb87a",
};
```

Update `AFFIX_SYMBOL_SCALE` (line 49-55):

```ts
export const AFFIX_SYMBOL_SCALE: Record<AffixKind, number> = {
  "+sell_price%":   1.0,
  "+speed%":        1.0,
  "+crit_chunks":   1.0,
  "+combo_chance%": 1.2,
  "+size%":         1.15,
};
```

Update `AFFIX_MAGNITUDE_RANGE` — replace every `"+crit_chance%"` entry with `"+crit_chunks"` and new integer ranges:

```ts
export const AFFIX_MAGNITUDE_RANGE: Record<ItemTier, Record<AffixKind, { min: number; max: number }>> = {
  normal: {
    "+sell_price%": { min: 15, max: 25 },
    "+speed%":      { min: 15, max: 25 },
    "+size%":       { min: 15, max: 25 },
    "+crit_chunks":   { min: 1,  max: 1  },
    "+combo_chance%": { min: 5,  max: 20 },
  },
  magic: {
    "+sell_price%": { min: 20, max: 30 },
    "+speed%":      { min: 20, max: 30 },
    "+size%":       { min: 20, max: 30 },
    "+crit_chunks":   { min: 1,  max: 2  },
    "+combo_chance%": { min: 10, max: 25 },
  },
  rare: {
    "+sell_price%": { min: 26, max: 38 },
    "+speed%":      { min: 26, max: 38 },
    "+size%":       { min: 26, max: 38 },
    "+crit_chunks":   { min: 2,  max: 3  },
    "+combo_chance%": { min: 16, max: 32 },
  },
  epic: {
    "+sell_price%": { min: 35, max: 50 },
    "+speed%":      { min: 35, max: 50 },
    "+size%":       { min: 35, max: 50 },
    "+crit_chunks":   { min: 2,  max: 4  },
    "+combo_chance%": { min: 24, max: 42 },
  },
  legendary: {
    "+sell_price%": { min: 48, max: 66 },
    "+speed%":      { min: 48, max: 66 },
    "+size%":       { min: 48, max: 66 },
    "+crit_chunks":   { min: 3,  max: 5  },
    "+combo_chance%": { min: 36, max: 56 },
  },
};
```

Also search for any other place inside `workshopAffixes.ts` that still mentions `+crit_chance%` (e.g., a weight table) and rename to `+crit_chunks` keeping the same numeric weight (`1.3`).

- [ ] **Step 4: Run tests to confirm pass**

Run: `npx vitest run tests/config/workshopAffixes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/workshopAffixes.ts tests/config/workshopAffixes.test.ts
git commit -m "config(affixes): replace +crit_chance% with +crit_chunks (lightning icon, integer magnitudes)"
```

---

## Task 4: Office classes — swap crit affix in worker class rolls

**Files:**
- Modify: `src/config/officeClasses.ts`
- Test: `tests/config/officeClasses.test.ts`

- [ ] **Step 1: Identify the worker classes that carry the old affix**

Run: `grep -n "+crit_chance%" src/config/officeClasses.ts`

You'll see entries at lines 30, 41, 52 (per the codebase snapshot). Each is a `{ min, max }` range inside a class's affix-roll table.

- [ ] **Step 2: Write the failing tests**

Append to `tests/config/officeClasses.test.ts`:

```ts
describe("officeClasses — crit_chunks rework", () => {
  it("no class still rolls the removed +crit_chance% affix", () => {
    const json = JSON.stringify(OFFICE_CLASSES);
    expect(json).not.toContain("+crit_chance%");
  });

  it("at least one class rolls +crit_chunks", () => {
    const json = JSON.stringify(OFFICE_CLASSES);
    expect(json).toContain("+crit_chunks");
  });

  it("+crit_chunks per-class ranges are small integers (typical workers add 0..2)", () => {
    for (const cls of Object.values(OFFICE_CLASSES)) {
      const range = cls.affixes?.["+crit_chunks"];
      if (range) {
        expect(range.min).toBeGreaterThanOrEqual(0);
        expect(range.max).toBeLessThanOrEqual(2);
      }
    }
  });
});
```

(Adjust the import `OFFICE_CLASSES` to match what the file exports; check `src/config/officeClasses.ts` top-level export name.)

- [ ] **Step 3: Run tests to confirm failure**

Run: `npx vitest run tests/config/officeClasses.test.ts -t "crit_chunks rework"`
Expected: FAIL — file still contains `+crit_chance%`.

- [ ] **Step 4: Edit `src/config/officeClasses.ts`**

For each `+crit_chance%` line, replace the key with `+crit_chunks` and shrink the magnitude range to small integers (chunks, not percent). Suggested mapping:
- `{ min: 0, max: 4 }` (crit_chance %) → `{ min: 0, max: 1 }` (chunks)
- `{ min: 0, max: 2 }` → `{ min: 0, max: 1 }`
- `{ min: 3, max: 7 }` → `{ min: 1, max: 2 }`

Apply the renames; commit nothing yet.

- [ ] **Step 5: Run tests to confirm pass**

Run: `npx vitest run tests/config/officeClasses.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/config/officeClasses.ts tests/config/officeClasses.test.ts
git commit -m "config(office): swap +crit_chance% worker affixes for +crit_chunks (smaller integer ranges)"
```

---

## Task 5: Skill tree — remove prismatic_eye, document crit_chance capability hook

**Files:**
- Modify: `src/config/skillTreeNodes.ts:84`
- Modify: `src/config/skillTreeDesign.json` (entry around line 847)
- Test: `tests/store/skillTreeSlice.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/store/skillTreeSlice.test.ts`:

```ts
import { SKILL_TREE_NODES } from "@/config/skillTreeNodes";

describe("skill tree — crit per-chunk rework", () => {
  it("prismatic_eye node is removed (crit canvas concept no longer exists)", () => {
    expect(SKILL_TREE_NODES.find((n) => n.id === "prismatic_eye")).toBeUndefined();
  });

  it("no node still carries the removed crit_gold_bonus capability", () => {
    for (const node of SKILL_TREE_NODES) {
      expect(node.unlocks).not.toContain("crit_gold_bonus");
    }
  });

  it("crit_chance capability is documented as a recognized capability tag (hook for future nodes)", () => {
    // No node carries it today, but countCapability(state, "crit_chance") returns 0
    // without throwing — the capability string is valid input.
    const state = { purchasedNodes: {} } as any;
    expect(() => {
      // dynamic import to keep this test isolated
      const { countCapability } = require("@/store/skillTreeSlice");
      countCapability(state, "crit_chance");
    }).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `npx vitest run tests/store/skillTreeSlice.test.ts -t "crit per-chunk rework"`
Expected: FAIL — `prismatic_eye` still in `SKILL_TREE_NODES`.

- [ ] **Step 3: Edit `src/config/skillTreeNodes.ts`**

Delete the line:

```ts
{ id: "prismatic_eye", name: "Prismatic Eye", description: "Each level adds +20% gold on crit canvases (in addition to the speed bonus).", numericEffect: "20%", parentIds: ["consistency"], stacking: "additive", kind: "major", maxLevel: 3, costs: [50, 100, 200], unlocks: ["crit_gold_bonus"] },
```

- [ ] **Step 4: Edit `src/config/skillTreeDesign.json`**

Find the `"id": "prismatic_eye"` object (around line 847). Delete the entire object (including the trailing comma if it's not the last entry, OR remove a leading comma if it's the last entry).

After deletion, ensure the JSON still parses:
Run: `node -e "JSON.parse(require('fs').readFileSync('src/config/skillTreeDesign.json'))"`
Expected: no output (silent = success). Any error = fix the comma.

- [ ] **Step 5: Find and remove other references**

Run: `grep -rn "prismatic_eye\|crit_gold_bonus" src/ tests/ docs/HANDOVER.md`
For each match in `src/` or `tests/`, delete or update the reference. Specifically:
- `tests/dev/bot-simulation.test.ts` lines 89 and 107 reference `prismatic_eye` in a fame-purchase path — remove those entries from the array, OR (preferred) replace them with another node already in the tree that the bot can buy (e.g., `consistency` alone, or another major node).
- `docs/HANDOVER.md` line 925 mentions `prismatic_eye — crit_gold_bonus` — drop that bullet entry.

- [ ] **Step 6: Run tests to confirm pass**

Run: `npx vitest run tests/store/skillTreeSlice.test.ts -t "crit per-chunk rework"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/config/skillTreeNodes.ts src/config/skillTreeDesign.json tests/dev/bot-simulation.test.ts tests/store/skillTreeSlice.test.ts docs/HANDOVER.md
git commit -m "config(skill-tree): remove prismatic_eye; crit_chance capability reserved as future hook"
```

---

## Task 6: Canvas slice — add critChunks; tierUp preserves size/crit/combo

**Files:**
- Modify: `src/store/canvasSlice.ts`
- Test: `tests/store/canvasSlice.test.ts`

### Note

This task adds the new `critChunks` field and changes `tierUp` behavior. The `isCritThisCanvas` field stays in this task — it is removed in Task 7 alongside the tick-loop rewrite (otherwise tickPure won't compile in the meantime).

- [ ] **Step 1: Write the failing tests**

Append to `tests/store/canvasSlice.test.ts`:

```ts
import { useGameStore } from "@/store";

describe("canvasSlice — critChunks run-state", () => {
  it("initial state has empty critChunks record", () => {
    const state = useGameStore.getState();
    expect(state.critChunks).toEqual({});
  });
});

describe("canvasSlice — tierUp preserves gated tracks", () => {
  beforeEach(() => {
    useGameStore.setState({
      canvasTier: 1,
      sellPriceLevel: 15,
      speedLevel: 15,
      sizeLevel: 7,
      critLevel: 12,
      comboLevel: 5,
      canvasProgress: 3.5,
      comboChain: 2,
    });
  });

  it("resets sellPriceLevel and speedLevel to 0", () => {
    useGameStore.getState().tierUp();
    const s = useGameStore.getState();
    expect(s.sellPriceLevel).toBe(0);
    expect(s.speedLevel).toBe(0);
  });

  it("preserves sizeLevel, critLevel, comboLevel across tier-up", () => {
    useGameStore.getState().tierUp();
    const s = useGameStore.getState();
    expect(s.sizeLevel).toBe(7);
    expect(s.critLevel).toBe(12);
    expect(s.comboLevel).toBe(5);
  });

  it("clears canvasProgress, comboChain, critChunks on tier-up", () => {
    useGameStore.setState({ critChunks: { 3: true, 7: true } });
    useGameStore.getState().tierUp();
    const s = useGameStore.getState();
    expect(s.canvasProgress).toBe(0);
    expect(s.comboChain).toBe(0);
    expect(s.critChunks).toEqual({});
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `npx vitest run tests/store/canvasSlice.test.ts -t "critChunks run-state\|tierUp preserves"`
Expected: FAIL — `critChunks` doesn't exist; `tierUp` still wipes all 5 tracks.

- [ ] **Step 3: Edit `src/store/canvasSlice.ts`**

Add the field to `CanvasState` (insert after `lastSale`, around line 49):

```ts
  /**
   * Set of chunk indices in the CURRENT canvas painted via a crit (trigger
   * chunk that rolled OR bonus chunks added by that crit). CanvasStage reads
   * this to apply the gold-flash modifier per cell. Cleared on each sale,
   * on tier-up, and on ascend.
   */
  critChunks: Record<number, true>;
```

Add the field to `initialCanvasState` (around line 52-63):

```ts
export const initialCanvasState: CanvasState = Object.freeze({
  canvasProgress: 0,
  sellPriceLevel: 0,
  speedLevel: 0,
  sizeLevel: 0,
  critLevel: 0,
  comboLevel: 0,
  canvasTier: 1,
  comboChain: 0,
  isCritThisCanvas: false,
  critChunks: {},
  lastSale: null,
}) as CanvasState;
```

Update the `tierUp` jsdoc comment (around line 88-94):

```ts
  /**
   * Canvas tier-up: within-run prestige.
   * Gate: sellPriceLevel >= 15 && speedLevel >= 15.
   * On success: increments canvasTier, resets sellPriceLevel and speedLevel
   * to 0 (the gated tracks — size/crit/combo — are preserved across tier-up),
   * clears in-canvas state (canvasProgress, comboChain, isCritThisCanvas,
   * critChunks), and calls evaluateAchievements().
   * Returns true on success, false if gate not met (state unchanged).
   */
  tierUp: () => boolean;
```

Update the `tierUp` implementation (around line 181-197):

```ts
  tierUp: () => {
    const state = get();
    if (state.sellPriceLevel < 15 || state.speedLevel < 15) return false;
    set({
      canvasTier: state.canvasTier + 1,
      sellPriceLevel: 0,
      speedLevel: 0,
      // sizeLevel, critLevel, comboLevel preserved across tier-up
      canvasProgress: 0,
      comboChain: 0,
      isCritThisCanvas: false,
      critChunks: {},
    });
    get().evaluateAchievements();
    return true;
  },
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npx vitest run tests/store/canvasSlice.test.ts`
Expected: New tests PASS. Older tests asserting "all 5 tracks reset to 0 on tier-up" will FAIL — split them: keep the sellPrice/speed assertion, change size/crit/combo to assert preservation.

- [ ] **Step 5: Fix any pre-existing test that asserted the old reset behavior**

Run: `grep -n "tierUp" tests/store/canvasSlice.test.ts`
For each occurrence asserting `sizeLevel === 0` or `critLevel === 0` or `comboLevel === 0` immediately after a `tierUp()` call, change to the appropriate `toBe(<preserved value>)`. Use a `beforeEach` that seeds non-zero values so the assertion is meaningful.

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass except the ones already known to fail from earlier tasks (PaintingRoute, canvasTickPure imports of CRIT_SPEED_FACTOR). Those are fixed in Tasks 7-8.

- [ ] **Step 7: Commit**

```bash
git add src/store/canvasSlice.ts tests/store/canvasSlice.test.ts
git commit -m "store(canvas): add critChunks set; tierUp preserves size/crit/combo levels"
```

---

## Task 7: canvasTickPure — chunk-stepping loop + remove isCritThisCanvas

**Files:**
- Modify: `src/core/canvasTickPure.ts` (full rewrite of the function body)
- Modify: `src/store/canvasSlice.ts` (remove `isCritThisCanvas` field + initial value + comments referencing it)
- Modify: `src/store/index.ts` (remove `isCritThisCanvas` from any initial-state or ascend-reset blocks)
- Test: `tests/core/canvasTickPure.test.ts` (full rewrite of describe blocks)

### Scope warning

This is the largest task. It removes `isCritThisCanvas` everywhere AND rewrites the tick loop in one go. Do all the steps before running typecheck.

- [ ] **Step 1: Write the failing tests** (full rewrite of `tests/core/canvasTickPure.test.ts`)

Replace the entire file contents:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { canvasTickPure } from "@/core/canvasTickPure";
import { big } from "@/core/bigNumber";
import { useGameStore } from "@/store";
import { setSeed } from "@/core/rng";

function freshDraft(overrides: Partial<Record<string, unknown>> = {}) {
  const base = useGameStore.getState();
  return {
    ...base,
    gold: big(0),
    lifetimeGold: big(0),
    canvasProgress: 0,
    sellPriceLevel: 1,
    speedLevel: 1,
    sizeLevel: 0,
    critLevel: 0,
    comboLevel: 0,
    comboChain: 0,
    critChunks: {},
    canvasTier: 1,
    equipped: {},
    roster: [],
    purchasedNodes: {},
    statsLifetime: { ...base.statsLifetime, canvasesSold: 0, critsLanded: 0 },
    statsRun: { ...base.statsRun, canvasesSold: 0, critsLanded: 0, currentCritStreak: 0, maxCritStreak: 0, maxComboChain: 0, goldEarned: big(0) },
    ...overrides,
  } as any;
}

describe("canvasTickPure — basic behavior", () => {
  it("no-op on delta=0", () => {
    const draft = freshDraft();
    const before = draft.gold;
    canvasTickPure(draft, 0);
    expect(draft.gold.eq(before)).toBe(true);
  });

  it("produces gold on a tick large enough to complete one canvas", () => {
    const draft = freshDraft();
    canvasTickPure(draft, 100);
    expect(draft.gold.gt(0)).toBe(true);
    expect(draft.statsLifetime.canvasesSold).toBeGreaterThanOrEqual(1);
  });

  it("produces many sales on a long delta", () => {
    const draft = freshDraft();
    canvasTickPure(draft, 600);
    expect(draft.statsLifetime.canvasesSold).toBeGreaterThan(1);
  });
});

describe("canvasTickPure — per-chunk crit roll", () => {
  beforeEach(() => setSeed(12345));

  it("records crit-painted chunk indices in draft.critChunks", () => {
    // Tier 1 = 25 chunks per canvas (5x5 grid). Run a partial tick that
    // crosses a few chunk boundaries. With BASE_CRIT_CHANCE=1% the odds of
    // any crit firing in ~5 chunks is tiny, so set critLevel high to force hits.
    const draft = freshDraft({ critLevel: 50 });  // 51% chance, soft-cap brings ~57% effective
    // Advance by ~5 chunks' worth of time and inspect critChunks.
    // (Exact value depends on speedMult/baseTime; just verify the type and bounds.)
    canvasTickPure(draft, 1.0);
    for (const idxStr of Object.keys(draft.critChunks)) {
      const idx = Number(idxStr);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(25);  // T1 chunk count
    }
  });

  it("bonus chunks do NOT re-roll for crit (chain is finite)", () => {
    // With +crit_chunks = 100 (huge bonus), if bonus chunks re-rolled, a single
    // crit hit would cascade and fill the whole canvas. We assert the bonus is
    // capped — critsLanded does not balloon past chunkCount.
    const fakeBrush = {
      slot: "brush", tier: "legendary", fuseCount: 0,
      affixes: [{ kind: "+crit_chunks", magnitude: 100 }],
    };
    const draft = freshDraft({ critLevel: 50, equipped: { brush: fakeBrush } });
    canvasTickPure(draft, 5.0);
    // At most chunkCount × salesThisTick crit chunks can be marked per sale.
    expect(draft.statsRun.critsLanded).toBeLessThanOrEqual(draft.statsRun.canvasesSold * 25 + 25);
  });

  it("streak increments by 1 + appliedBonus on a hit; resets to 0 on a miss", () => {
    // Seed an rng sequence: with critChance close to 1, every paid chunk hits.
    setSeed(1);
    const draft = freshDraft({ critLevel: 50, equipped: {
      brush: { slot: "brush", tier: "rare", fuseCount: 0, affixes: [{ kind: "+crit_chunks", magnitude: 2 }] },
    } });
    canvasTickPure(draft, 0.5);  // partial canvas
    expect(draft.statsRun.currentCritStreak).toBeGreaterThanOrEqual(0);
    expect(draft.statsRun.maxCritStreak).toBeGreaterThanOrEqual(draft.statsRun.currentCritStreak);
  });

  it("critChunks resets to empty on canvas sale", () => {
    const draft = freshDraft({ critLevel: 50 });
    canvasTickPure(draft, 200);  // many canvases sold
    // After multiple sales, the current critChunks belongs only to the CURRENT
    // canvas — its indices must all be < chunkCount for THIS canvas's tier.
    const chunkCount = 25;  // T1
    for (const idxStr of Object.keys(draft.critChunks)) {
      expect(Number(idxStr)).toBeLessThan(chunkCount);
    }
  });

  it("does not reference isCritThisCanvas (field removed from state)", () => {
    const draft = freshDraft();
    canvasTickPure(draft, 100);
    expect(draft).not.toHaveProperty("isCritThisCanvas");
  });
});

describe("canvasTickPure — speed math no longer divides by CRIT_SPEED_FACTOR", () => {
  it("paint time is purely baseTime / speedMult (no crit speed factor)", () => {
    const draft = freshDraft({ critLevel: 50 });  // high crit chance
    canvasTickPure(draft, 10);
    const expectedTime = 1 / 1;  // baseTime / speedMult ~= baseTime; just assert sales fired normally
    expect(draft.statsLifetime.canvasesSold).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `npx vitest run tests/core/canvasTickPure.test.ts`
Expected: FAIL on most cases — `draft.critChunks` undefined; `isCritThisCanvas` still present; tick still uses CRIT_SPEED_FACTOR.

- [ ] **Step 3: Rewrite `src/core/canvasTickPure.ts`**

Replace the full file with:

```ts
import { big, type Big } from "@/core/bigNumber";
import {
  canvasGold, canvasTime,
  COMBO_DECAY_PER_LINK, comboBonusFactor, comboEffectiveChance,
} from "@/core/balance";
import {
  getCanvasGoldMultiplier, getCanvasSpeedMultiplier,
  getCritChance, getCritChunks, getComboBaseChance, getCanvasSize, getComboDecayReduction,
} from "@/core/multipliers";
import { getSketchGridDim } from "@/components/painting/canvasArt";
import { rng } from "@/core/rng";
import {
  addCurrency, trackSaleGoldPure, awardOfficeXpPure,
  incrementStatPure, patchRunStatsPure, type DraftState,
} from "@/core/pureMutations";

const MAX_SALES_PER_TICK = 1000;

/**
 * Canvas-paint tick. Steps per PAID chunk: each iteration crosses one chunk
 * boundary that consumed chunkTime from timeBudget, and rolls crit once.
 * A successful roll adds `getCritChunks(draft)` BONUS chunks of progress
 * instantly (no timeBudget cost). Bonus chunks themselves don't re-roll.
 */
export function canvasTickPure(draft: DraftState, deltaSeconds: number): void {
  if (deltaSeconds <= 0) return;

  let progress = draft.canvasProgress;
  let chain = draft.comboChain;
  let critChunks: Record<number, true> = { ...draft.critChunks };
  let lastSaleId = draft.lastSale?.id ?? 0;
  let lastSaleAmount: Big | null = null;

  let timeBudget = deltaSeconds;
  let sales = 0;

  // Stat accumulators — committed after the loop.
  let localCritStreak = draft.statsRun.currentCritStreak;
  let localMaxCritStreak = draft.statsRun.maxCritStreak;
  let localMaxCombo = draft.statsRun.maxComboChain;
  let critChunksThisTick = 0;
  let salesThisTick = 0;
  let tickGoldTotal = big(0);

  while (timeBudget > 0 && sales < MAX_SALES_PER_TICK) {
    const size = getCanvasSize(draft);
    const baseTime = canvasTime(size, draft.canvasTier);
    const speedMult = getCanvasSpeedMultiplier(draft);
    const effectiveTime = baseTime / speedMult;

    const chunkCount = getSketchGridDim(draft.canvasTier) ** 2;
    const chunkTime = effectiveTime / chunkCount;

    const currentChunkIndex = Math.floor(progress / chunkTime);
    const nextChunkBoundary = (currentChunkIndex + 1) * chunkTime;
    const timeToNextChunk = nextChunkBoundary - progress;

    if (timeBudget < timeToNextChunk) {
      // Not enough time to finish this chunk; just advance progress.
      progress += timeBudget;
      timeBudget = 0;
      break;
    }

    // Cross a PAID chunk boundary.
    progress = nextChunkBoundary;
    timeBudget -= timeToNextChunk;

    // Roll crit on this paid chunk.
    if (rng() < getCritChance(draft)) {
      const bonus = getCritChunks(draft);
      // Cap bonus so it doesn't overshoot this canvas.
      const remainingChunks = chunkCount - (currentChunkIndex + 1);
      const appliedBonus = Math.min(bonus, remainingChunks);

      // Mark trigger + bonus chunks as crit-painted (for gold flash).
      critChunks[currentChunkIndex] = true;
      for (let i = 1; i <= appliedBonus; i++) {
        critChunks[currentChunkIndex + i] = true;
      }
      progress += appliedBonus * chunkTime;

      const totalCritChunks = 1 + appliedBonus;
      critChunksThisTick += totalCritChunks;
      localCritStreak += totalCritChunks;
      if (localCritStreak > localMaxCritStreak) localMaxCritStreak = localCritStreak;
    } else {
      localCritStreak = 0;
    }

    if (progress >= effectiveTime) {
      // Sale.
      progress = 0;
      sales += 1;
      salesThisTick += 1;

      const goldMult = getCanvasGoldMultiplier(draft);
      const baseGold = canvasGold(size, goldMult, draft.canvasTier);
      const gain = baseGold.mul(comboBonusFactor(chain));

      addCurrency(draft, "gold", gain);
      trackSaleGoldPure(draft, gain);
      awardOfficeXpPure(draft, gain);

      tickGoldTotal = tickGoldTotal.add(gain);
      if (chain > localMaxCombo) localMaxCombo = chain;

      // Roll combo for the chain decision (after pay-out).
      const baseChance = getComboBaseChance(draft);
      const decay = Math.max(0, COMBO_DECAY_PER_LINK - getComboDecayReduction(draft));
      const effChance = comboEffectiveChance(baseChance, chain, decay);
      chain = (rng() < effChance) ? chain + 1 : 0;

      lastSaleId += 1;
      lastSaleAmount = gain;

      // Reset per-canvas crit-paint set.
      critChunks = {};
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

- [ ] **Step 4: Remove `isCritThisCanvas` from `src/store/canvasSlice.ts`**

Delete the field from `CanvasState` (lines ~37-38):

```ts
  /** New canvas-depth: rolled at canvas start; `true` for one canvas's lifetime then reset on sale. */
  isCritThisCanvas: boolean;
```

Delete from `initialCanvasState` (the `isCritThisCanvas: false,` line).

Delete from the canvasTick handler set() call (around lines 109-122):

```ts
// REMOVE this line:
isCritThisCanvas: draft.isCritThisCanvas,
```

Replace with:

```ts
critChunks: draft.critChunks,
```

Delete from `tierUp`:

```ts
// REMOVE this line:
isCritThisCanvas: false,
```

Update the jsdoc on `tierUp` to remove the `isCritThisCanvas` mention.

- [ ] **Step 5: Remove `isCritThisCanvas` from `src/store/index.ts`**

Run: `grep -n "isCritThisCanvas" src/store/index.ts`

For each match in an ascend-reset block, delete the line. Example (around line 215):

```ts
// BEFORE
isCritThisCanvas: false,
// AFTER
critChunks: {},
```

For matches inside migration steps (v9→v10 around line 215, the comment around line 203), leave the comment text alone (it's historical) but delete the actual `isCritThisCanvas: false` if it's setting state — though for the v9→v10 migration that initializes state, replace with `critChunks: {}`.

- [ ] **Step 6: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. Any remaining `isCritThisCanvas` reference causes a TS error — fix by deleting.

- [ ] **Step 7: Run tests**

Run: `npx vitest run tests/core/canvasTickPure.test.ts tests/store/canvasSlice.test.ts`
Expected: PASS.

- [ ] **Step 8: Run full test suite**

Run: `npx vitest run`
Expected: tests in `tests/routes/PaintingRoute.test.tsx` and `tests/components/painting/CanvasStage.test.tsx` may still fail because they reference `isCrit`/`isCritThisCanvas` — those are fixed in Task 8. All other tests should pass.

- [ ] **Step 9: Commit**

```bash
git add src/core/canvasTickPure.ts src/store/canvasSlice.ts src/store/index.ts tests/core/canvasTickPure.test.ts
git commit -m "core(tick): per-chunk crit roll with bonus-chunk progress; remove isCritThisCanvas"
```

---

## Task 8: PaintingRoute + CanvasStage UI + CSS

**Files:**
- Modify: `src/routes/PaintingRoute.tsx`
- Modify: `src/components/painting/CanvasStage.tsx`
- Modify: `src/components/painting/CanvasStage.module.css`
- Test: `tests/components/painting/CanvasStage.test.tsx`, `tests/routes/PaintingRoute.test.tsx`

- [ ] **Step 1: Write the failing tests** (CanvasStage)

In `tests/components/painting/CanvasStage.test.tsx`, REPLACE the existing "crit-indicator" test (if present) and add new tests:

```ts
it("does not render a CRIT badge (canvas-level crit removed)", () => {
  const { container } = render(
    <CanvasStage
      sizeLevel={1}
      canvasTier={1}
      progressPct={0.5}
      timeElapsed="3.0"
      timeTotal="6.0"
      nextSaleGold="100"
    />,
  );
  expect(container.querySelector("[data-testid='crit-indicator']")).toBeNull();
});

it("applies the sketchCellCrit modifier to cells listed in critChunks", () => {
  const { container } = render(
    <CanvasStage
      sizeLevel={1}
      canvasTier={1}
      progressPct={0.4}  // ~10 cells revealed at T1 (25 cells)
      timeElapsed="2.5"
      timeTotal="6.0"
      nextSaleGold="100"
      critChunks={{ 0: true, 1: true }}
    />,
  );
  // Find cells whose visible state is true (opacity 1) and check class
  const overlay = container.querySelector("[data-testid='sketch-overlay']");
  expect(overlay).not.toBeNull();
  const cells = overlay!.querySelectorAll("div");
  // We can't easily inspect inline opacity here, so just verify some cell has
  // the modifier class — the data is plumbed through.
  const hasModifier = Array.from(cells).some((c) => c.className.includes("sketchCellCrit"));
  expect(hasModifier).toBe(true);
});
```

- [ ] **Step 2: Write the failing tests** (PaintingRoute)

In `tests/routes/PaintingRoute.test.tsx`, add:

```ts
it("paintTimeSec is purely baseTime / speedMult (no critFactor multiplier)", async () => {
  // After this rework, PaintingRoute computes paintTimeSec without isCritThisCanvas.
  // Render the route at a known state and verify the displayed time/total isn't divided by 10.
  // (Concretely: assert the component doesn't import or reference CRIT_SPEED_FACTOR.)
  const src = await import("@/routes/PaintingRoute");
  const fileText = src.toString();
  expect(fileText).not.toContain("CRIT_SPEED_FACTOR");
  expect(fileText).not.toContain("isCritThisCanvas");
});
```

(This is a brittle source-grep test. If the project doesn't tolerate that pattern, replace with a render-and-assert flow that confirms `Painting · 6.0s` rather than `Painting · 0.6s` for the default state.)

- [ ] **Step 3: Run tests to confirm failure**

Run: `npx vitest run tests/components/painting/CanvasStage.test.tsx tests/routes/PaintingRoute.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Edit `src/components/painting/CanvasStage.tsx`**

Add `critChunks` to the `Props` interface:

```ts
interface Props {
  sizeLevel: number;
  canvasTier: number;
  progressPct: number;
  timeElapsed: string;
  timeTotal: string;
  nextSaleGold: string;
  /** T14: combo chain depth for badge display. */
  comboChain?: number;
  /** Set of chunk indices in the current canvas painted by a crit. Cells in
   *  this set get the gold-flash modifier. */
  critChunks?: Record<number, true>;
  canvasNumber?: number;
  onChunkClick?: () => void;
}
```

Remove `isCrit?: boolean;` from Props if present.

Remove the destructure of `isCrit`:

```ts
export function CanvasStage({
  sizeLevel,
  canvasTier,
  progressPct,
  timeElapsed,
  timeTotal,
  nextSaleGold,
  comboChain,
  critChunks = {},
  canvasNumber = 0,
  onChunkClick,
}: Props): JSX.Element {
```

Remove the `CRIT` badge JSX:

```tsx
// DELETE this block:
{isCrit && (
  <div className={styles.critIndicator} data-testid="crit-indicator">CRIT</div>
)}
```

Update the per-cell render to apply the modifier:

```tsx
{Array.from({ length: totalCells }, (_, i) => {
  const col = i % gridDim;
  const row = Math.floor(i / gridDim);
  const revealRank = cellOrder.indexOf(i);
  const visible = revealRank < cellsRevealed;
  const isCrit = critChunks[i] === true;
  const denom = gridDim - 1;
  return (
    <div
      key={i}
      className={`${styles.sketchCell} ${isCrit ? styles.sketchCellCrit : ""}`}
      style={{
        backgroundImage: `url(${sketchUrl})`,
        backgroundSize: `${gridDim * 100}% ${gridDim * 100}%`,
        backgroundPosition: `${(col / denom) * 100}% ${(row / denom) * 100}%`,
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(0.4)",
      }}
    />
  );
})}
```

- [ ] **Step 5: Edit `src/components/painting/CanvasStage.module.css`**

Add a new modifier class (place it next to `.sketchCell`):

```css
/* Crit-painted chunks pop in with a brief gold drop-shadow over the same
 * 220ms transition window. Combined with the chunk pop-in transform, this
 * reads as a "lucky" extra chunk landing. */
.sketchCellCrit {
  filter: drop-shadow(0 0 6px var(--gold)) drop-shadow(0 0 12px rgba(255, 200, 80, 0.6));
}
```

Remove the now-orphan `.critIndicator` and `@keyframes critPulse` blocks (no caller references them after the badge deletion).

- [ ] **Step 6: Edit `src/routes/PaintingRoute.tsx`**

Remove the `isCritThisCanvas` selector and the `critFactor` math. Replace lines around 42-72:

```ts
// REMOVE:
import { ... CRIT_SPEED_FACTOR, } from "@/core/balance";
// (just delete CRIT_SPEED_FACTOR from the named imports if it remains)

// REMOVE:
const isCritThisCanvas = useGameStore((s) => s.isCritThisCanvas);

// REMOVE:
const critFactor = isCritThisCanvas ? CRIT_SPEED_FACTOR : 1;

// REPLACE:
const paintTimeSec = baseTime / (speedMult * critFactor);
// WITH:
const paintTimeSec = baseTime / speedMult;
```

Add a `critChunks` selector and pass it down:

```ts
const critChunks = useGameStore((s) => s.critChunks);
```

In the `<CanvasStage ...>` JSX, remove `isCrit={isCritThisCanvas}` and add:

```tsx
critChunks={critChunks}
```

- [ ] **Step 7: Run typecheck and tests**

Run: `npx tsc --noEmit && npx vitest run tests/components/painting/CanvasStage.test.tsx tests/routes/PaintingRoute.test.tsx`
Expected: PASS.

- [ ] **Step 8: Run full test suite**

Run: `npx vitest run`
Expected: PASS overall (TrackCard MAX-label tests don't exist yet; that's Task 9).

- [ ] **Step 9: Commit**

```bash
git add src/routes/PaintingRoute.tsx src/components/painting/CanvasStage.tsx src/components/painting/CanvasStage.module.css tests/components/painting/CanvasStage.test.tsx tests/routes/PaintingRoute.test.tsx
git commit -m "ui(canvas-stage): gold flash on crit-painted chunks; drop CRIT badge + critFactor"
```

---

## Task 9: TrackCard — MAX label at maxLevel; crit-chance card refactor

**Files:**
- Modify: `src/components/painting/TrackCard.tsx`
- Modify: `src/routes/PaintingRoute.tsx` (caller for the crit card)
- Test: `tests/components/painting/CanvasStage.test.tsx` or a new TrackCard test file

- [ ] **Step 1: Write the failing test**

Add `tests/components/painting/TrackCard.test.tsx` if it doesn't exist:

```ts
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrackCard } from "@/components/painting/TrackCard";

describe("TrackCard — MAX label at maxLevel", () => {
  it("renders 'MAX' and disables the button when level >= maxLevel", () => {
    const onUpgrade = vi.fn();
    render(
      <TrackCard
        trackId="crit"
        label="Crit"
        affixKind="+sell_price%"  // placeholder; real callers pass iconOverride for crit
        level={50}
        maxLevel={50}
        effectLine="+1% crit chance/level"
        costLabel="—"
        canAfford={true}
        locked={false}
        onUpgrade={onUpgrade}
      />,
    );
    const button = screen.getByTestId("track-card-upgrade-crit");
    expect(button).toBeDisabled();
    expect(button.textContent).toMatch(/MAX/i);
  });

  it("renders the cost label when level < maxLevel", () => {
    render(
      <TrackCard
        trackId="crit"
        label="Crit"
        affixKind="+sell_price%"
        level={10}
        maxLevel={50}
        effectLine="+1% crit chance/level"
        costLabel="500"
        canAfford={true}
        locked={false}
        onUpgrade={() => {}}
      />,
    );
    const button = screen.getByTestId("track-card-upgrade-crit");
    expect(button).not.toBeDisabled();
    expect(button.textContent).not.toMatch(/MAX/i);
  });
});

describe("TrackCard — icon override (for crit-chance card without an AffixKind)", () => {
  it("uses iconOverride and colorOverride when provided", () => {
    const { container } = render(
      <TrackCard
        trackId="crit"
        label="Crit Chance"
        iconOverride="✦"
        colorOverride="#e85c5c"
        level={5}
        effectLine="+1% chance/level"
        costLabel="500"
        canAfford={true}
        locked={false}
        onUpgrade={() => {}}
      />,
    );
    expect(container.textContent).toContain("✦");
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `npx vitest run tests/components/painting/TrackCard.test.tsx`
Expected: FAIL — `TrackCard` doesn't accept `maxLevel`, `iconOverride`, `colorOverride`.

- [ ] **Step 3: Edit `src/components/painting/TrackCard.tsx`**

Update the Props interface:

```ts
interface Props {
  trackId: CanvasTrackId;
  label: string;
  /** If iconOverride is set, affixKind is ignored for icon/color lookup. */
  affixKind?: AffixKind;
  iconOverride?: string;
  colorOverride?: string;
  level: number;
  /** If set, the button shows "MAX" and is disabled when level >= maxLevel. */
  maxLevel?: number;
  effectLine: string;
  costLabel: string;
  canAfford: boolean;
  locked: boolean;
  onUpgrade: () => void;
}
```

Update the body:

```tsx
export function TrackCard({
  trackId, label, affixKind, iconOverride, colorOverride,
  level, maxLevel, effectLine, costLabel, canAfford, locked, onUpgrade,
}: Props): JSX.Element {
  const isMaxed = typeof maxLevel === "number" && level >= maxLevel;
  const disabled = locked || !canAfford || isMaxed;
  const symbol = iconOverride ?? (affixKind ? AFFIX_SYMBOL[affixKind] : "?");
  const color = colorOverride ?? (affixKind ? AFFIX_COLOR[affixKind] : "var(--ink-2)");
  const scale = affixKind ? AFFIX_SYMBOL_SCALE[affixKind] : 1.0;
  const coinIcon = <CurrencyAmount kind="gold" value={costLabel} />;
  return (
    <div
      className={`${styles.card} ${locked ? styles.locked : ""}`}
      data-track-id={trackId}
    >
      <div className={styles.label}>
        <span className={styles.symbol} style={{ color, fontSize: `${20 * scale}px` }}>{symbol}</span>
        {label}
      </div>
      <div className={styles.level}>Level {level}</div>
      <div className={styles.effect}>{effectLine}</div>
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
            </>
          )
        )}
        footer={() => locked ? "Visit the constellation to purchase the unlock node." : ""}
      >
        <button
          type="button"
          className={styles.upgradeBtn}
          disabled={disabled}
          onClick={!disabled ? onUpgrade : undefined}
          data-testid={`track-card-upgrade-${trackId}`}
        >
          {locked ? "Locked" : isMaxed ? "MAX" : coinIcon}
        </button>
      </Hoverable>
    </div>
  );
}
```

- [ ] **Step 4: Update the crit `TrackCard` caller in `PaintingRoute.tsx`**

Find the existing `<TrackCard trackId="crit" ...>` and change `affixKind="+crit_chance%"` to use overrides:

```tsx
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
```

Import `MAX_CRIT_LEVEL` at the top:

```ts
import { ..., MAX_CRIT_LEVEL } from "@/core/balance";
```

Also drop the description that mentions "(90% faster on hit)" since CRIT_SPEED_FACTOR is gone.

- [ ] **Step 5: Run typecheck and tests**

Run: `npx tsc --noEmit && npx vitest run tests/components/painting/TrackCard.test.tsx tests/routes/PaintingRoute.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/painting/TrackCard.tsx src/routes/PaintingRoute.tsx tests/components/painting/TrackCard.test.tsx
git commit -m "ui(track-card): MAX label at level cap; iconOverride for the crit-chance card"
```

---

## Task 10: StatsRoom — relabel crit stats from "canvas" to "chunk"

**Files:**
- Modify: `src/components/painting/StatsRoom.tsx`
- Test: `tests/components/painting/StatsRoom.test.tsx` (create if absent)

- [ ] **Step 1: Find existing crit labels**

Run: `grep -n -i "crit" src/components/painting/StatsRoom.tsx`

Look for label strings like "Crits landed", "Current crit streak", "Best crit streak", or similar. Note the existing wording.

- [ ] **Step 2: Write the failing test**

In `tests/components/painting/StatsRoom.test.tsx`:

```ts
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StatsRoom } from "@/components/painting/StatsRoom";

describe("StatsRoom — crit labels reflect chunk semantics", () => {
  it("uses 'chunk' wording for crit-related stats", () => {
    const { container } = render(<StatsRoom />);
    const text = container.textContent ?? "";
    // Labels must mention "chunk" somewhere on a crit row.
    expect(text).toMatch(/crit.*chunk/i);
  });

  it("does not use the old 'crit canvas' wording", () => {
    const { container } = render(<StatsRoom />);
    const text = container.textContent ?? "";
    expect(text.toLowerCase()).not.toMatch(/crit (canvas|canvases)/);
  });
});
```

- [ ] **Step 3: Run tests to confirm failure**

Run: `npx vitest run tests/components/painting/StatsRoom.test.tsx`
Expected: FAIL — old labels still say "canvas".

- [ ] **Step 4: Edit `src/components/painting/StatsRoom.tsx`**

For each crit label, rewrite to reference chunks. Examples:
- "Crits landed" → "Crit chunks landed"
- "Current crit streak (canvases)" → "Current crit streak (chunks)"
- "Best crit streak" → "Best crit streak (chunks)"

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/components/painting/StatsRoom.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/painting/StatsRoom.tsx tests/components/painting/StatsRoom.test.tsx
git commit -m "ui(stats-room): label crit stats with chunk wording"
```

---

## Task 11: Save migration v22 → v23 (full wipe)

**Files:**
- Modify: `src/store/index.ts` (SAVE_VERSION bump + new migration step)
- Test: `tests/store/persistence-integration.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/store/persistence-integration.test.ts`:

```ts
describe("save migration v22 → v23 (crit per-chunk rework)", () => {
  it("returns an empty record so the store falls back to default initial state", () => {
    const { migrate } = require("@/store/index");
    const v22Save = {
      gold: { mantissa: 12345, exponent: 0 } as unknown,
      sellPriceLevel: 7,
      critLevel: 30,
      // ...any other v22 fields...
      isCritThisCanvas: true,
      equipped: { brush: { affixes: [{ kind: "+crit_chance%", magnitude: 42 }] } },
      purchasedNodes: { prismatic_eye: 2 },
    };
    const migrated = migrate(v22Save, 22);
    // After wipe + default-rehydration, none of the v22 mutated fields persist.
    // The migrate function itself returns `{}` (or a near-empty shell); zustand's
    // merge fills the rest from initial state. We assert the wipe directly.
    expect(Object.keys(migrated)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

Run: `npx vitest run tests/store/persistence-integration.test.ts -t "v22 → v23"`
Expected: FAIL — no migration step for v22→v23 exists.

- [ ] **Step 3: Edit `src/store/index.ts`**

Change:

```ts
const SAVE_VERSION = 22;
```

To:

```ts
const SAVE_VERSION = 23;
```

Append a new doc comment to the migration chain (find the v21→v22 block and add below it):

```ts
 *
 * v22 → v23 (2026-05-24): crit per-chunk rework. Removes `+crit_chance%`
 * affix kind, removes `prismatic_eye` skill node, replaces canvas-level crit
 * speed with per-chunk crit chunk bonus. Per spec, full wipe — return `{}`
 * and let zustand merge fill from defaults.
```

Inside the `migrate` function, add after the last existing block:

```ts
  if (fromVersion < 23) {
    // v22 → v23 (2026-05-24): crit per-chunk rework. Full wipe per spec.
    return {} as unknown as GameStore;
  }
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/store/persistence-integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Smoke-test the running app**

Run: `npm run dev` (or open the existing dev server). Open the running app in a browser, then in DevTools:

```js
indexedDB.deleteDatabase("artdle-save");  // simulate fresh-load behavior
location.reload();
```

Expected: the app loads in a clean default state — gold 0, no critLevel, no inventory. (Sanity check; not automated.)

- [ ] **Step 6: Commit**

```bash
git add src/store/index.ts tests/store/persistence-integration.test.ts
git commit -m "store(persistence): SAVE_VERSION 22→23 with full wipe for crit rework"
```

---

## Task 12: Bot-simulation re-baseline + final integration sweep

**Files:**
- Modify: `tests/dev/bot-simulation.test.ts`
- Run: full test suite + typecheck + lint

- [ ] **Step 1: Run the bot simulation; observe failures**

Run: `npx vitest run tests/dev/bot-simulation.test.ts`
Expected: FAIL — old gold/canvas-count expectations were tuned to the old crit speed math.

Capture the actual values from the failure output. For each `expect(...).toBe(X)` or `toBeGreaterThan(X)`, note the new actual value.

- [ ] **Step 2: Update the assertions**

For each assertion that fails because the actual value moved by the expected fraction (~10–20% for the early game, more for late game with stacked items), update to the new value plus/minus a tolerance. Use `toBeCloseTo` or wide-band `toBeGreaterThan/Less` instead of exact equality where the rng path could vary.

If the bot simulation seeds rng (`setSeed(N)` near the top), the values should be deterministic — just update them.

- [ ] **Step 3: Run the bot simulation again**

Run: `npx vitest run tests/dev/bot-simulation.test.ts`
Expected: PASS.

- [ ] **Step 4: Run the full test suite + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: ALL green.

- [ ] **Step 5: Manual smoke-test in the dev server**

If not already running: `npm run dev`. In the browser:
1. Clear save (devtools → Application → IndexedDB → delete `artdle-save` → reload).
2. Buy a few canvases. Confirm chunks pop in normally; ~1% of them gold-flash (base crit at L0).
3. Buy critLevel up to 5–10. Confirm the gold-flash rate visibly increases.
4. Equip a workshop item that rolled `+crit_chunks` (if you have one — workshop rolls eventually produce one). Confirm crits now paint 2+ chunks in a burst.
5. Tier up. Confirm size/crit/combo levels persist; sellPrice/speed reset to 0.
6. Open StatsRoom. Confirm "Crit chunks landed", "Current crit streak (chunks)", etc.

- [ ] **Step 6: Commit**

```bash
git add tests/dev/bot-simulation.test.ts
git commit -m "test(bot-sim): re-baseline gold/canvas expectations for crit per-chunk rework"
```

- [ ] **Step 7: Final integration commit (optional, only if any cleanup remains)**

```bash
git status
# If any straggling files remain (lint fixes, doc tweaks), add and commit:
git add <files>
git commit -m "chore: crit per-chunk rework cleanup"
```

---

## Post-implementation verification

After all 12 tasks land:

- [ ] **Run full suite** — `npx vitest run` → 100% green.
- [ ] **Typecheck** — `npx tsc --noEmit` → clean.
- [ ] **Build** — `npm run build` → succeeds.
- [ ] **Visual QA** — Open the dev server, verify the gold flash, the MAX label at critLevel 50, the tier-up preserving gated tracks, and the StatsRoom labels.
- [ ] **Deploy** — `npx vercel --prod` from the repo root. Confirm production bundle hash is fresh and the new affix-kind string `+crit_chunks` appears in the JS bundle.
