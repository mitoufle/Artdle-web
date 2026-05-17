# Code Audit — Structural Discrepancies & Reshape Directions (2026-05-17)

Full audit of 40+ files. Five structural categories identified. Three reshape directions proposed.

---

## Category 1 — Display/Computation Drift (player-visible bugs)

### 1a. StatsRoom breakdown rows omit School and Achievement contributions

**File:** `src/components/painting/StatsRoom.tsx:62-123`

`getCanvasGoldMultiplier` and `getCanvasSpeedMultiplier` include school bonuses (`canvas_gold_pct`, `speed_pct` via `getSchoolBonus`) and achievement bonuses (via `getAchievementBonus`). The breakdown rows shown to the player only list:

```
Canvas upgrade | Skill tree (color/speed) | Items | Workers
```

School and Achievement are absent. The displayed total exceeds the sum of listed rows for any player who has unlocked school researches or achievement bonuses. **The stat panel is wrong.**

**Fix:** Extract `getSchoolCanvasGoldContribution()` and `getAchievementCanvasGoldContribution()` helpers from the internals of the multiplier functions. Add them as breakdown rows in `statBlocks()`, guarded with `> 0` so they only appear when non-zero. Do the same for Speed.

### 1b. BottomBar missing `/achievements` route entry

**File:** `src/components/shell/BottomBar.tsx` — `ROUTE_PROMINENCE` map

`/achievements` is not in the map. The route falls through to `DEFAULT_PROMINENT = new Set(["gold", "inspi"])`, which dims everything except gold and inspi on the achievements screen — meaningless for that tab.

**Fix:** Add `"/achievements": new Set([])` (or `new Set(["fame"])`) to `ROUTE_PROMINENCE`.

### 1c. SchoolRoom bypasses the Hoverable abstraction

**File:** `src/components/painting/SchoolRoom.tsx`

SchoolRoom calls `useGameStore(s => s.pushHoverInfo)` / `clearHoverInfo` directly. WorkshopRoom, OfficeRoom, and AchievementsRoute all use `<Hoverable>`. Two hover-authoring patterns exist for the same UX; SchoolRoom will silently diverge if the hover protocol changes.

**Fix:** Replace raw push/clear calls in SchoolRoom with `<Hoverable>` wrappers.

---

## Category 2 — Stringly-Typed Cross-References (silent-failure risk)

Effect kind strings (`"canvas_gold_pct"`, `"speed_pct"`, `"inspi_pct"`, `"paint_mastery_flat"`), school bonus keys (`"+% Fame gain"`, `"School Research flat reduction (mnt)"`), capability tags, and achievement condition stat strings are all runtime strings with no compile-time checking. A misspelling returns 0 silently.

The `taylorsim` typo in `skillTreeDesign.json:381` (and all TS references) is the canonical example: consistent across JSON and code so it works correctly, but a one-sided fix would break auto-crafting with no error.

**`src/config/skillTreeNodes.ts`** already documents the trade-off: `"typo protection is sacrificed for data-driven config"`. This is accepted design for node IDs. The effect kinds and school bonus keys are not similarly documented and represent untreated risk.

**Not an emergency.** Risk grows proportionally with the number of effects added.

---

## Category 3 — Helper-State Hand-Construction (structural fragility)

Every caller of a multiplier function manually assembles its own slice of store state:

```ts
// PaintingRoute.tsx — 11 fields, all named explicitly
const helperState: CanvasMultiplierInputs = {
  equipped, purchasedNodes, roster, paintMastery,
  sellPriceLevel, speedLevel, sizeLevel, critLevel, comboLevel,
  completedResearches, completedAchievements,
};
```

`CanvasMultiplierInputs` (11-field named type) was introduced after a runtime `TypeError` when `TreeRoute`'s manually-constructed helperState was missing `completedAchievements`. The type is the only safety net.

### Tests defeat the safety net

`tests/core/multipliers.test.ts:19-28` uses:

```ts
const stub = (over: Partial<GameStore> = {}): GameStore => ({
  purchasedNodes: {},
  equipped: {},
  // 5 more fields — not all 11
  ...over,
} as GameStore); // ← cast bypasses TS structural check
```

The `as GameStore` cast means TypeScript will not catch a missing field. If a new field is added to `CanvasMultiplierInputs`, the test compiles and may pass while silently reading `undefined`.

`getInspiMultiplier`, `getAscendThresholdReduction`, and others use anonymous inline `Pick<GameStore, ...>` types rather than named types — no shared safety net for those paths.

**Fix (Reshape B below):** Named selector hook + properly-typed test stubs.

---

## Category 4 — Reset Orchestration Hard-Coded

**File:** `src/systems/ascend.ts:40-62`

`performAscendOrchestrator` contains a hard-coded list of resets:

```ts
state.resetRunCurrencies();
state.resetTree();
state.resetCanvas();
state.resetWorkshop();
state.resetOffice();
// school and skill-tree intentionally absent — permanent state
```

Adding a new run-scoped slice requires touching the orchestrator. There is no declarative registry of "what resets on ascend."

**Naming confusion:**
- `resetOffice()` only resets `queue`, `roster`, `trickleTimer` — NOT `officeLevel` or `officeXp` (intentional: office level is permanent). The name implies a full reset.
- `resetSchool()` is exported and tested but **never called in production** (grep-confirmed). School is permanent by design. The method is a dead stub.
- The `partialize` blacklist in `src/store/index.ts` has the same problem: transient fields (`activeNotification`, `notificationQueue`, etc.) are manually listed; adding a new transient field requires updating the list.

---

## Category 5 — Dead Code Drift

**File:** `src/core/balance.ts`

Three functions remain from the old passive PM drip system, replaced by achievement-only grants:
- `pmGainPerSale(gold)` — old per-sale PM formula
- `pmThreshold` — the threshold constant
- `pmFromLifetime(gold)` — lifetime PM formula

`pmMult` is live (used by `getPmMultiplier`). The other three are unreferenced. `paintMasterySlice.ts` has a comment confirming PM is now achievement-only.

`resetSchool()` in `schoolSlice.ts` — exported, tested, never called in ascend. Either remove or document it as test-only.

---

## Proposed Reshape Directions

### Reshape A — Fix the visible panel bugs (1–2 sessions, low risk)

Player-visible. No architectural change. Do first.

1. `StatsRoom.tsx`: Add School and Achievement rows to Sell Price and Speed breakdowns. Extract contribution helpers from multiplier internals, guard with `> 0`.
2. `BottomBar.tsx`: Add `/achievements` to `ROUTE_PROMINENCE`.
3. `SchoolRoom.tsx`: Replace raw hover push/clear with `<Hoverable>`.
4. `balance.ts`: Delete `pmGainPerSale`, `pmThreshold`, `pmFromLifetime`.
5. `schoolSlice.ts`: Remove or `@internal`-document `resetSchool()`.

### Reshape B — Named selector hook + typed test stubs (1–3 sessions, medium risk)

Eliminates the hand-construction pattern and restores test safety net.

1. Create `useCanvasMultiplierInputs(): CanvasMultiplierInputs` hook. `PaintingRoute` and `StatsRoom` use it; their hand-construction disappears.
2. Fix `tests/core/multipliers.test.ts`: replace `as GameStore` casts with properly-typed `CanvasMultiplierInputs` stubs. TypeScript will now catch missing fields.
3. Name the anonymous `Pick<>` types in `getInspiMultiplier`, `getAscendThresholdReduction`, etc.
4. Verify `TreeRoute` helperState field coverage is complete (the prior bug site).

### Reshape C — Declarative run-scope registry (2–4 sessions, higher risk)

Replaces the hard-coded ascend orchestrator list with per-slice opt-in metadata.

Sketch: each run-scoped slice exports `runScoped = true`; the orchestrator iterates a registry instead of naming each reset explicitly. The `partialize` blacklist could mirror this with a `transient: true` marker per field.

**Only worth doing if a new run-scoped slice is actively being added.** The current hard-coded list is explicit and auditable; the registry adds indirection for limited gain unless the codebase grows more slices soon.

---

## Priority

1. **Reshape A immediately** — StatsRoom is wrong for any player with school or achievement bonuses. 1-session fix.
2. **Reshape B test fix as part of A** — the `as GameStore` bypass is a silent regression trap. Fix the stubs while touching the multiplier files.
3. **Reshape C: defer** — stable enough, low urgency.
