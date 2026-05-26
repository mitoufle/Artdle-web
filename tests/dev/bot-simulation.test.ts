/**
 * AI player bot simulation.
 *
 * Runs the full game loop headlessly (real Zustand store, no persistence layer)
 * and logs pacing milestones so we can understand gold/inspiration curves.
 *
 * Run: npx vitest run tests/dev/bot-simulation.test.ts --reporter=verbose
 *
 * The test always passes — its value is the console output.
 */

import { describe, it, beforeEach, expect } from "vitest";
import { useGameStore, _resetHeartbeat } from "@/store";
import { big, type Big } from "@/core/bigNumber";
import { setSeed } from "@/core/rng";
import { runCatchupSimulation } from "@/systems/catchup";
import { cloneGameState } from "@/systems/catchupClone";
import { ACHIEVEMENTS } from "@/config/achievementConfig";
import {
  canvasGold,
  chunksPerCanvas,
  chunkInterval,
  craftCost,
  fameOnAscend,
  sellPriceUpgradeCost,
  speedUpgradeCost,
  critUpgradeCost,
  comboUpgradeCost,
  tierUpgradeCost,
} from "@/core/balance";
import {
  getCanvasGoldMultiplier,
  getCanvasSpeedMultiplier,
} from "@/core/multipliers";
import { canBuyNode, getCanvasTrackUnlocked } from "@/store/skillTreeSlice";
import { canAscend } from "@/systems/ascend";
import { getRosterCap, getHireCost } from "@/store/officeSlice";
import { initialWorkshopState } from "@/store/workshopSlice";
import { TREE_STAGES } from "@/config/treeStages";
import type { SkillNodeId } from "@/store/skillTreeSlice";

// ─── Simulation constants ─────────────────────────────────────────────────────

const TICK_S = 1;
const DECISION_EVERY_S = 5;
const LOG_EVERY_S = 300;     // log a row every 5 minutes of simulated time
const MAX_S = 24 * 60 * 60;  // 24 hours of simulated time
const SEED = 42;
const ASCEND_FAME_START = 5;       // first ascend at ~125K inspi
const ASCEND_FAME_MULTIPLIER = 2;  // double the target after each ascend
const ASCEND_FAME_CAP = 500;       // stop raising the bar here (~3M inspi)

// ─── Node priority list ───────────────────────────────────────────────────────
// Each ID listed ONCE. Bot buys the next available level of the first affordable
// node in this list each decision tick.
//
// Ordering principle:
//   1. Cheap unlock-gates that open core mechanics come BEFORE expensive multi-level nodes
//   2. multi-level expensive nodes after they've unblocked what matters
//   3. late-game multipliers last

const NODE_PRIORITY: SkillNodeId[] = [
  // Core roots: cheap, high ROI, open the tree
  "basic_technique",   // +2%/L speed (1/2/3/4/5 fame); opens color tree, muscle_memory, entrepreneur
  "black_white",       // +20% gold (1 fame; requires basic_technique≥1)
  "muscle_memory",     // +5%/L speed (5 fame/L); opens size_matters + genius_episode
  "entrepreneur",      // unlocks office roster + queue (10 fame; requires basic_technique≥1)
  // Key canvas-track unlocks — buy BEFORE maxing expensive multi-level nodes
  "size_matters",      // 5 fame → UNLOCK canvas_size track (requires muscle_memory≥1)
  "genius_episode",    // 5 fame → UNLOCK canvas_crit track (requires muscle_memory≥1)
  // Inspiration nodes (decent ROI, gateway to poke_tree/Bargain)
  "get_inspired",      // +25%/L inspi (1/5/10/15/20 fame)
  "poke_tree",         // inspi rate bonus (5 fame/L)
  "Bargain",           // tree cost discount (5 fame/L) → enlightenment
  // Color tree — single-level nodes ordered by cost
  "magenta",           // +30% gold (5 fame)
  "cyan",              // +30% gold (5 fame)
  "yellow",            // +30% gold (5 fame)
  "red",               // +40% gold (10 fame)
  "blue",              // +40% gold (10 fame)
  "purple",            // +50% gold (20 fame; requires blue+red)
  "green",             // +40% gold (30 fame; requires yellow+cyan)
  "brown",             // +50% gold (20 fame; requires green+blue)
  "orange",            // +50% gold (20 fame; requires red+green)
  // Size/combo chain nodes
  "big_picture",       // +canvas_size_bonus/L (10 fame/L; requires size_matters)
  "consistency",       // path to fast_learner (10 fame/L; requires genius_episode)
  "fast_learner",      // path to unrelentless (20 fame/L; requires big_picture + consistency)
  "unrelentless",      // UNLOCK canvas_combo track (50 fame; requires fast_learner)
  // Workshop slot unlocks
  "gear_up",           // unlocks palette slot + craftsmanship path (100 fame; requires muscle_memory)
  // Office path
  "education",         // path to hire capabilities
  "free_will",         // unlocks class_speedrunner; gateway to hire_manager
  "hire_manager",      // +roster slots (5 fame/L)
  "recruiter",         // +queue slots (3 fame/L)
  "accelerator",       // worker_xp_mult (20 fame/L; requires free_will)
  "bookkeeper",        // hire_cost_reduction (10 fame/L; requires hire_manager)
  "gold_diggers",      // unlocks class_goldsmith (requires accelerator + hire_manager)
  // More color tree
  "rainbow",           // multiplicative gold bonus (100 fame; requires orange+brown+purple)
  // Workshop craftsmanship
  "craftsmanship",     // better affix magnitude (100 fame/L; requires gear_up)
  // Late-game multipliers
  "expanding_horizon", // canvas_size_bonus (25 fame/L; requires big_picture)
  "enlightenment",     // ascend threshold reduction (50 fame/L; requires Bargain)
  "patron",            // inspi_mult_bonus (40 fame/L; requires poke_tree)
  "afterburner",       // combo_decay_reduction (20 fame/L; requires unrelentless)
  // Easel + equipment slot chain (long, expensive)
  "wooden_chest",      // path to steel_chest (100 fame; requires craftsmanship)
  "shredder",          // path to taylorsim (150 fame; requires craftsmanship)
  "taylorsim",         // path to forget_pain (150 fame; requires shredder)
  "steel_chest",       // path to forget_pain (200 fame; requires wooden_chest)
  "forget_pain",       // UNLOCK easel slot (free; requires steel_chest+taylorsim)
  "monk_internship",   // path to painters_boots (10 fame; requires forget_pain)
  "third_hand",        // path to painters_boots (0 fame; requires forget_pain)
  "painters_boots",    // UNLOCK boots slot (1 fame; requires monk_internship+third_hand)
  "socks",             // path to painters_apron (1 fame; requires painters_boots)
  "painters_apron",    // UNLOCK apron slot (1 fame; requires socks)
  "painters_hat",      // UNLOCK hat slot (1 fame; requires painters_apron)
  "better_scaling",    // affix magnitude scales with workshop level (1 fame; requires painters_hat)
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function fmtN(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3)  return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(1);
}

/** Effective gold per second for the current state (chunk-domain). */
function gps(state: ReturnType<typeof useGameStore.getState>): number {
  const tier      = state.canvasTier;
  const gm        = getCanvasGoldMultiplier(state);
  const sm        = getCanvasSpeedMultiplier(state);
  const chunks    = chunksPerCanvas(tier);
  const interval  = chunkInterval(sm);
  const canvasS   = chunks * interval;
  const avgGold   = canvasGold(gm, tier).toNumber();
  return avgGold / canvasS;
}

/** Inspiration per second. */
function ips(state: ReturnType<typeof useGameStore.getState>): number {
  const giLevels = state.purchasedNodes["get_inspired"] ?? 0;
  const im = 1 + giLevels * 0.25;
  let total = 0;
  for (const stage of TREE_STAGES) {
    for (const part of stage.parts) {
      const lvl = state.partLevels[part.id] ?? 0;
      total += lvl * part.rate;
    }
  }
  return total * im;
}

// ─── Decision functions ───────────────────────────────────────────────────────

function decideTreeParts(): void {
  useGameStore.getState().buyAllAffordableTreeParts();
}

function decideSkillTree(t: number, milestones: string[]): void {
  const state = useGameStore.getState();
  for (const id of NODE_PRIORITY) {
    if (canBuyNode(state, id)) {
      const prevLevel = state.purchasedNodes[id] ?? 0;
      useGameStore.getState().buyNode(id);
      const newLevel = useGameStore.getState().purchasedNodes[id] ?? 0;
      if (newLevel !== prevLevel) {
        milestones.push(`  [${fmtTime(t)}] node: ${id} L${newLevel} (fame now ${fmtN(useGameStore.getState().fame.toNumber())})`);
      }
      return;
    }
  }
}

function decideCanvasUpgrades(): void {
  const state = useGameStore.getState();
  const curGps = gps(state);

  interface Candidate { fn: () => void; roi: number; }
  const candidates: Candidate[] = [];

  const tryTrack = (
    cost: number,
    simState: Partial<ReturnType<typeof useGameStore.getState>>,
    fn: () => void,
  ) => {
    if (state.gold.toNumber() >= cost) {
      const newGps = gps({ ...state, ...simState });
      candidates.push({ fn, roi: (newGps - curGps) / cost });
    }
  };

  tryTrack(sellPriceUpgradeCost(state.sellPriceLevel).toNumber(),
    { sellPriceLevel: state.sellPriceLevel + 1 },
    () => useGameStore.getState().upgradeSellPrice());

  tryTrack(speedUpgradeCost(state.speedLevel).toNumber(),
    { speedLevel: state.speedLevel + 1 },
    () => useGameStore.getState().upgradeSpeed());

  if (getCanvasTrackUnlocked(state, "crit"))
    tryTrack(critUpgradeCost(state.critLevel).toNumber(),
      { critLevel: state.critLevel + 1 },
      () => useGameStore.getState().upgradeCrit());

  if (getCanvasTrackUnlocked(state, "combo"))
    tryTrack(comboUpgradeCost(state.comboLevel).toNumber(),
      { comboLevel: state.comboLevel + 1 },
      () => useGameStore.getState().upgradeCombo());

  if (candidates.length === 0) return;
  candidates.sort((a, b) => b.roi - a.roi);
  candidates[0].fn();
}

/** Craft when we can afford 2× cost; equip anything usable; discard only duplicates. */
function decideCraftAndEquip(): void {
  // First try to equip any unequipped items
  const s0 = useGameStore.getState();
  for (const item of s0.inventory) {
    if (!s0.equipped[item.slot]) {
      useGameStore.getState().equipItem(item.id);
    }
  }

  // Discard only when inventory is full AND there is a duplicate-slot item to remove
  const s1 = useGameStore.getState();
  if (s1.inventory.length >= 3) {
    const toDiscard = s1.inventory.find(
      (item) => s1.equipped[item.slot] !== undefined && s1.equipped[item.slot]?.id !== item.id,
    );
    if (toDiscard) useGameStore.getState().discard(toDiscard.id);
  }

  // Craft if affordable and inventory isn't full
  const s2 = useGameStore.getState();
  const cost = craftCost(s2.workshopLevel).toNumber();
  if (s2.gold.toNumber() >= cost * 2 && s2.inventory.length < 3) {
    useGameStore.getState().craft();
  }
}

function decideHire(): void {
  const state = useGameStore.getState();
  const cap = getRosterCap(state);
  if (state.roster.length >= cap) return;
  for (const candidate of (state.hiringQueue ?? [])) {
    const cost = getHireCost(state, candidate).toNumber();
    if (state.gold.toNumber() >= cost) {
      useGameStore.getState().hireFromQueue(candidate.id);
      return;
    }
  }
}

// ─── Simulation ───────────────────────────────────────────────────────────────

describe("bot-simulation", () => {
  beforeEach(() => {
    setSeed(SEED);
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetTree();
    useGameStore.getState().resetSkillTree();
    useGameStore.getState().resetOffice();
    useGameStore.setState({
      ...initialWorkshopState,
      fame: big(0),
      ascendCount: 0,
      pastRuns: [],
    });
  });

  it("runs 24-hour simulation and logs pacing", { timeout: 180_000 }, () => {
    const milestones: string[] = [];
    let firstAscendAt = -1;
    let lastTier = useGameStore.getState().canvasTier;
    let lastTierUpAt = 0;
    const tierIntervals: Array<{ from: number; to: number; intervalS: number; gpsAtUp: number }> = [];

    const addMilestone = (t: number, msg: string) => {
      milestones.push(`  [${fmtTime(t)}] *** ${msg} ***`);
    };

    // Track first-time flag unlocks (Size track removed in chunk-domain rework)
    let critUnlocked = false, comboUnlocked = false;

    // Progressive ascend target: starts small, doubles each run up to the cap
    let ascendMinFame = ASCEND_FAME_START;

    console.log("\n=== Artdle Bot Simulation ===");
    console.log("Format: [H:MM:SS] G/s | I/s | SP:# Sp:# Cr:# Co:# | WS:L# | Asc:# | Fame:# | T:#\n");

    for (let t = 0; t < MAX_S; t += TICK_S) {
      useGameStore.getState().tickAll(TICK_S);

      const curTier = useGameStore.getState().canvasTier;
      if (curTier !== lastTier) {
        const interval = t - lastTierUpAt;
        const gpsAtUp = gps(useGameStore.getState());
        tierIntervals.push({ from: lastTier, to: curTier, intervalS: interval, gpsAtUp });
        addMilestone(t,
          `TIER UP T${lastTier}→T${curTier} — interval ${fmtTime(interval)}, G/s now ${fmtN(gpsAtUp)}`);
        lastTier = curTier;
        lastTierUpAt = t;
      }

      if (t % DECISION_EVERY_S === 0) {
        const state = useGameStore.getState();

        // Ascend when payout meets the current progressive target.
        // Guard on canvasTier === 1: once the bot tier-ups, it commits to the
        // run instead of wiping back to T1, so we can measure T1→T2→T3→T4
        // intervals inside a single run.
        if (canAscend(state) && fameOnAscend(state.inspiration) >= ascendMinFame && state.canvasTier === 1) {
          const inspireBefore = state.inspiration.toNumber();
          const fameBefore = state.fame.toNumber();
          useGameStore.getState().performAscend();
          const newFame = useGameStore.getState().fame.toNumber() - fameBefore;
          if (firstAscendAt < 0) firstAscendAt = t;
          addMilestone(t,
            `ASCEND #${useGameStore.getState().ascendCount} — inspi was ${fmtN(inspireBefore)}, +${newFame} fame (total: ${fmtN(useGameStore.getState().fame.toNumber())}) [next target: ${Math.min(ASCEND_FAME_CAP, ascendMinFame * ASCEND_FAME_MULTIPLIER)} fame]`);
          setSeed(SEED + useGameStore.getState().ascendCount);
          ascendMinFame = Math.min(ASCEND_FAME_CAP, ascendMinFame * ASCEND_FAME_MULTIPLIER);
        }

        // Tier up when affordable. Bot spends most gold on within-tier
        // upgrades first (they're cheaper); tier-up cost (1000^T) gates
        // the loop. Triggered before other decisions so freshly-earned gold
        // tied to a sale doesn't get burned on cheap upgrades first.
        if (state.gold.gte(tierUpgradeCost(state.canvasTier))) {
          useGameStore.getState().tierUp();
        }

        decideTreeParts();
        decideSkillTree(t, milestones);
        decideCanvasUpgrades();
        decideCraftAndEquip();
        decideHire();

        // Detect first-time track unlocks (size track removed)
        const s2 = useGameStore.getState();
        if (!critUnlocked && getCanvasTrackUnlocked(s2, "crit")) {
          critUnlocked = true;
          addMilestone(t, "UNLOCKED canvas_crit track");
        }
        if (!comboUnlocked && getCanvasTrackUnlocked(s2, "combo")) {
          comboUnlocked = true;
          addMilestone(t, "UNLOCKED canvas_combo track");
        }
      }

      // Log row every LOG_EVERY_S; drain pending milestones first
      if (t > 0 && t % LOG_EVERY_S === 0) {
        for (const m of milestones.splice(0)) console.log(m);
        const state = useGameStore.getState();
        const row = [
          `[${fmtTime(t)}]`,
          `G/s:${fmtN(gps(state)).padStart(8)}`,
          `I/s:${fmtN(ips(state)).padStart(8)}`,
          `SP:${state.sellPriceLevel} Sp:${state.speedLevel} Cr:${state.critLevel} Co:${state.comboLevel}`,
          `WS:L${state.workshopLevel}`,
          `T:${state.canvasTier}`,
          `Asc:${state.ascendCount}`,
          `Fame:${fmtN(state.fame.toNumber())}`,
          `Gold:${fmtN(state.gold.toNumber())}`,
        ].join("  ");
        console.log(row);
      }
    }

    // Drain any remaining milestones
    for (const m of milestones) console.log(m);

    const final = useGameStore.getState();
    console.log("\n=== Final State (24h) ===");
    console.log(`  Gold:          ${fmtN(final.gold.toNumber())}`);
    console.log(`  Fame:          ${fmtN(final.fame.toNumber())}`);
    console.log(`  Ascends:       ${final.ascendCount}`);
    console.log(`  G/s:           ${fmtN(gps(final))}`);
    console.log(`  I/s:           ${fmtN(ips(final))}`);
    console.log(`  Canvas tracks: SP:${final.sellPriceLevel} Sp:${final.speedLevel} Cr:${final.critLevel} Co:${final.comboLevel}`);
    console.log(`  Canvas tier:   T${final.canvasTier}`);
    console.log(`  Workshop:      L${final.workshopLevel} (${final.inventory.length} in inv, ${Object.keys(final.equipped).length} equipped)`);
    console.log(`  First ascend:  ${firstAscendAt >= 0 ? fmtTime(firstAscendAt) : "never"}`);
    console.log(`  Crit unlocked: ${critUnlocked} | Combo unlocked: ${comboUnlocked}`);

    console.log("\n=== Per-tier progression ===");
    if (tierIntervals.length === 0) {
      console.log("  (no tier-ups fired in this run)");
    } else {
      for (const r of tierIntervals) {
        console.log(`  T${r.from}→T${r.to}: ${fmtTime(r.intervalS)} (G/s at up: ${fmtN(r.gpsAtUp)})`);
      }
      for (let i = 1; i < tierIntervals.length; i++) {
        const prev = tierIntervals[i - 1].intervalS;
        const cur = tierIntervals[i].intervalS;
        const ratio = prev > 0 ? cur / prev : 0;
        console.log(`  ratio T${tierIntervals[i - 1].to}→T${tierIntervals[i].to} vs prev: ×${ratio.toFixed(2)}`);
      }
    }

    // Regression guard for tier-cost progression.
    // After the chunk-domain rework the tier-up cost ramp became `1000^T`
    // (T1→T2 = 1k, T2→T3 = 1M, T3→T4 = 1B). The mid-tier inversion guard
    // (T3→T4 ≥ T2→T3 × 0.9) still applies — non-reset multipliers compound
    // across tiers, and we want to make sure the ramp keeps each tier-up
    // strictly more expensive in wall-clock terms than the last. With the
    // steeper ramp the bot may not reach T3 (let alone T4) inside the
    // simulation budget; the assertion is guarded so it auto-skips when
    // the relevant intervals aren't observed. A failure here means the
    // curve actually inverted, not that progression slowed.
    const t23 = tierIntervals.find((r) => r.from === 2 && r.to === 3);
    const t34 = tierIntervals.find((r) => r.from === 3 && r.to === 4);
    if (t23 && t34 && t23.intervalS > 0) {
      expect(t34.intervalS).toBeGreaterThanOrEqual(t23.intervalS * 0.9);
    }
  });

  // ─── Convergence test ─────────────────────────────────────────────────────
  //
  // Verify that `runCatchupSimulation(N)` produces approximately the same
  // economic state as running the live tick loop for N seconds from the same
  // baseline + RNG seed.
  //
  // Why 3599 and not 3600? `chooseDelta` returns 1 for elapsed < 3600 and 10
  // for elapsed in [3600, 24h). At exactly 3600 the sim would use a 10s delta
  // while the live loop uses 1s ticks, and the two RNG streams would diverge
  // (canvasTickPure rolls an extra crit at progress=0 per tick, so the
  // boundary roll rate is delta-dependent). At 3599 both paths use delta=1
  // and consume RNG in lockstep, letting us assert a tight tolerance.

  function snapshotEconomy(
    state: ReturnType<typeof useGameStore.getState>,
  ): { gold: Big; inspiration: Big; canvasesSold: number } {
    return {
      gold: state.gold,
      inspiration: state.inspiration,
      canvasesSold: state.statsRun.canvasesSold,
    };
  }

  it("catch-up simulation converges with live tick over ~1h", async () => {
    const ELAPSED = 3599; // delta = 1 on both paths (see comment above)

    // Build a deterministic baseline on top of the beforeEach resets. A stage-0
    // tree with cotyledon=5 produces 0.5 inspi/sec; sellPriceLevel + speedLevel
    // default to 1 so the canvas tick fires sales from the first second.
    //
    // Pre-mark every achievement as completed so none can fire mid-run. The
    // live tick calls `evaluateAchievements()` after every selling tick, while
    // `runCatchupSimulation` calls it ONCE at the end; without this guard, any
    // mid-run unlock (e.g. Rising Star at 1000 lifetime sales → +20% speed)
    // would boost the live path's output but not the sim's, producing a
    // ~50% gold divergence (verified empirically — see commit history).
    const allCompleted: Record<string, true> = {};
    for (const a of ACHIEVEMENTS) allCompleted[a.id] = true;
    useGameStore.setState({
      currentStage: 0,
      partLevels: { cotyledon: 5 },
      completedAchievements: allCompleted,
    });

    // Deep-clone the baseline so the second run can be restored from a
    // pristine snapshot — Zustand setState merges shallowly, so nested records
    // like partLevels and statsRun could otherwise alias mutated objects.
    const baseline = cloneGameState(useGameStore.getState());

    // ─── Run 1: live ticks ───
    setSeed(SEED);
    _resetHeartbeat();
    for (let s = 0; s < ELAPSED; s++) {
      useGameStore.getState().tickAll(1);
    }
    const liveResult = snapshotEconomy(useGameStore.getState());

    // ─── Run 2: catch-up sim from the same baseline + same RNG seed ───
    useGameStore.setState(cloneGameState(baseline));
    setSeed(SEED);
    _resetHeartbeat();
    await runCatchupSimulation(ELAPSED, () => {});
    const simResult = snapshotEconomy(useGameStore.getState());

    console.log("\n=== Convergence (live vs catch-up, 3599s) ===");
    console.log(`  Gold        live=${liveResult.gold.toString()} sim=${simResult.gold.toString()}`);
    console.log(`  Inspi       live=${liveResult.inspiration.toString()} sim=${simResult.inspiration.toString()}`);
    console.log(`  CanvasesSold live=${liveResult.canvasesSold} sim=${simResult.canvasesSold}`);

    // With matched deltas and matched RNG seed, the two paths should match
    // exactly (or be vanishingly close due to floating-point order in Big
    // arithmetic). Allow 1% tolerance as a safety margin.
    const goldRatio = simResult.gold.div(liveResult.gold).toNumber();
    expect(goldRatio).toBeGreaterThan(0.99);
    expect(goldRatio).toBeLessThan(1.01);

    const inspiRatio = simResult.inspiration.div(liveResult.inspiration).toNumber();
    expect(inspiRatio).toBeGreaterThan(0.99);
    expect(inspiRatio).toBeLessThan(1.01);

    // Canvases sold should match exactly (integer counter, deterministic deltas).
    const canvasDelta = Math.abs(simResult.canvasesSold - liveResult.canvasesSold);
    expect(canvasDelta).toBeLessThanOrEqual(1);
  }, 60_000);
});
