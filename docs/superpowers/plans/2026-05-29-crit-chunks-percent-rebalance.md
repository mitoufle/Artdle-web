# Crit-Chunks Percent Rebalance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nerf the overpowered `+crit_chunks` item affix by reading its magnitude as a *percentage* that scales the base additional-chunks-per-crit, instead of adding flat chunks.

**Architecture:** One-site change in the engine selector `getCritChunks` (`src/core/multipliers.ts`): items now contribute `Σ (magnitude/100 × slotMult)` as a percentage applied to `BASE_CRIT_CHUNKS`, i.e. `playerStrokesPerCrit = floor(BASE_CRIT_CHUNKS × (1 + itemPct))`. The Stats panel mirror (`critChunksFromItems` in `StatsRoom.tsx`) is updated to match and to show the fractional effective contribution. No save migration and no workshop-roll change — stored magnitudes are kept; the magnitude bonus may still inflate the rolled number, but as a percentage of a base of 1 it can no longer run away.

**Tech Stack:** TypeScript (strict), Vitest, Zustand selectors.

**Spec:** `docs/superpowers/specs/2026-05-29-crit-and-tree-rebalance-design.md` (Part 1).

> **Note on workers:** `getCritChunks` and `critChunksFromWorkers` still contain a worker branch (old Office). Leave it untouched here — the Office painter redesign plan removes it. This plan changes only the *items* branch.

---

## File structure

- `src/core/multipliers.ts` — `getCritChunks`: items branch becomes a percentage on the base.
- `src/components/painting/StatsRoom.tsx` — `critChunksFromItems`: mirror the percentage and return the fractional effective chunk contribution for the breakdown line.
- `tests/core/multipliers.test.ts` — unit tests for the new `getCritChunks` behavior.

---

### Task 1: `getCritChunks` reads item magnitude as a percentage of the base

**Files:**
- Modify: `src/core/multipliers.ts:203-221` (`getCritChunks`)
- Test: `tests/core/multipliers.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/core/multipliers.test.ts` (create the file if it does not exist, with the imports shown):

```ts
import { describe, it, expect } from "vitest";
import { getCritChunks } from "@/core/multipliers";
import { BASE_CRIT_CHUNKS } from "@/core/balance";
import type { CanvasMultiplierInputs } from "@/core/multipliers";

/** Minimal state for getCritChunks: it reads equipped, roster, and purchasedNodes (socks). */
function critState(
  equipped: Record<string, { affixes: { kind: string; magnitude: number }[] }>,
  opts: { socks?: boolean } = {},
): CanvasMultiplierInputs {
  return {
    equipped,
    roster: [],
    purchasedNodes: opts.socks ? { socks: 1 } : {},
  } as unknown as CanvasMultiplierInputs;
}

describe("getCritChunks — item magnitude as percent of base", () => {
  it("returns BASE_CRIT_CHUNKS when nothing is equipped", () => {
    expect(getCritChunks(critState({}))).toBe(BASE_CRIT_CHUNKS); // 1
  });

  it("reads a single +crit_chunks magnitude as a percent (85 -> +85% of base -> floor 1.85 = 1)", () => {
    const s = critState({ brush: { affixes: [{ kind: "+crit_chunks", magnitude: 85 }] } });
    expect(getCritChunks(s)).toBe(1); // floor(1 * 1.85)
  });

  it("stacks item percentages additively (85 + 85 -> +170% -> floor 2.7 = 2)", () => {
    const s = critState({
      brush: { affixes: [{ kind: "+crit_chunks", magnitude: 85 }] },
      palette: { affixes: [{ kind: "+crit_chunks", magnitude: 85 }] },
    });
    expect(getCritChunks(s)).toBe(2);
  });

  it("applies socks x1.5 to a boots crit affix percentage (100 * 1.5 = +150% -> floor 2.5 = 2)", () => {
    const s = critState(
      { boots: { affixes: [{ kind: "+crit_chunks", magnitude: 100 }] } },
      { socks: true },
    );
    expect(getCritChunks(s)).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/multipliers.test.ts`
Expected: FAIL — current flat-add logic returns `1 + 85 = 86` for the single-item case, not `1`.

- [ ] **Step 3: Rewrite the items branch as a percentage on the base**

In `src/core/multipliers.ts`, replace the body of `getCritChunks` so the items branch accumulates a percentage and scales `BASE_CRIT_CHUNKS`:

```ts
export const getCritChunks = (state: CanvasMultiplierInputs): number => {
  const hasSocks = getNodeLevel(state, "socks") > 0;

  // Items contribute a PERCENTAGE of the base additional-chunks-per-crit.
  // magnitude is read as a percent (85 -> +85%); socks x1.5 on boots.
  let itemPct = 0;
  for (const entry of Object.entries(state.equipped)) {
    const [slot, item] = entry as [SlotKind, Item | undefined];
    if (!item) continue;
    const slotMult = hasSocks && slot === "boots" ? 1.5 : 1.0;
    for (const affix of item.affixes) {
      if (affix.kind === "+crit_chunks") itemPct += (affix.magnitude / 100) * slotMult;
    }
  }
  let chunks = BASE_CRIT_CHUNKS * (1 + itemPct);

  // Worker branch unchanged here — removed by the Office painter redesign plan.
  for (const worker of state.roster) {
    const scale = levelScale(worker.level).toNumber();
    for (const affix of worker.affixes) {
      if (affix.kind === "+crit_chunks") chunks += affix.magnitude * scale;
    }
  }
  return Math.max(0, Math.floor(chunks));
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/multipliers.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/core/multipliers.ts tests/core/multipliers.test.ts
git commit -m "fix(crit): read +crit_chunks item magnitude as a percent of base"
```

---

### Task 2: Stats panel mirrors the percentage + shows the effective fractional contribution

**Files:**
- Modify: `src/components/painting/StatsRoom.tsx:74-86` (`critChunksFromItems`)
- Test: none (UI display helper; verified by the engine test + manual check)

- [ ] **Step 1: Update `critChunksFromItems` to return the effective fractional chunk contribution**

Replace `critChunksFromItems` so it returns `BASE_CRIT_CHUNKS × itemPct` (the extra chunks the items actually add), matching the engine. A single 85-magnitude item now reads as `+0.85` instead of `+0`.

```ts
/**
 * Effective additional chunks contributed by equipped items: their +crit_chunks
 * magnitudes are read as a PERCENT of BASE_CRIT_CHUNKS (socks x1.5 on boots).
 * Mirrors the items branch of `getCritChunks` in multipliers.ts.
 */
function critChunksFromItems(state: CanvasMultiplierInputs): number {
  const hasSocks = getNodeLevel(state, "socks") > 0;
  let itemPct = 0;
  for (const entry of Object.entries(state.equipped)) {
    const [slot, item] = entry as [SlotKind, { affixes: { kind: string; magnitude: number }[] } | undefined];
    if (!item) continue;
    const slotMult = hasSocks && slot === "boots" ? 1.5 : 1.0;
    for (const affix of item.affixes) {
      if (affix.kind === "+crit_chunks") itemPct += (affix.magnitude / 100) * slotMult;
    }
  }
  return BASE_CRIT_CHUNKS * itemPct;
}
```

`BASE_CRIT_CHUNKS` is already imported in `StatsRoom.tsx` (used at line 110). The "Items" breakdown line now shows the fractional value (e.g. `+0.9`); the existing `toFixed` in the total label already renders fractionals.

- [ ] **Step 2: Verify the build + types**

Run: `npx tsc -b --noEmit`
Expected: no NEW errors (the 24 pre-existing baseline errors are unchanged).

Run: `npx vite build`
Expected: clean build.

- [ ] **Step 3: Manual check (optional)**

Open the Stats room with a `+crit_chunks` item equipped: the "Strokes per crit" block shows a small fractional "Items" contribution (e.g. `+0.9`) and a total close to `2`, not `80+`.

- [ ] **Step 4: Commit**

```bash
git add src/components/painting/StatsRoom.tsx
git commit -m "ui(stats): show effective fractional +crit_chunks item contribution"
```

---

## Self-Review

**Spec coverage (Part 1):**
- "magnitude read as % of base" → Task 1. ✅
- `playerStrokesPerCrit = floor(BASE × (1 + Σ mag/100))` → Task 1 impl. ✅
- Socks ×1.5 on boots crit affix's % → Task 1 test + impl. ✅
- No migration / no roll-path change → confirmed (no such task; intentional). ✅
- UI shows effective fractional contribution → Task 2. ✅
- Workers not part of this number → worker branch left untouched, noted for Office plan. ✅

**Placeholder scan:** none — all steps contain concrete code/commands.

**Type consistency:** `getCritChunks(state: CanvasMultiplierInputs)`, `BASE_CRIT_CHUNKS`, `Item`/`SlotKind` all match existing signatures in `multipliers.ts`; `critChunksFromItems(state: CanvasMultiplierInputs): number` matches its StatsRoom callsite.
