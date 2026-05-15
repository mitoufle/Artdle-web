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

import { describe, it, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { setSeed } from "@/core/rng";
import {
  canvasGold,
  canvasTime,
  craftCost,
  CRIT_SPEED_FACTOR,
  fameOnAscend,
  sellPriceUpgradeCost,
  speedUpgradeCost,
  sizeUpgradeCost,
  critUpgradeCost,
  comboUpgradeCost,
} from "@/core/balance";
import {
  getCanvasGoldMultiplier,
  getCanvasSpeedMultiplier,
  getCritChance,
  getCanvasSize,
  getPmMultiplier,
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
const MAX_S = 3 * 60 * 60;   // 3 hours of simulated time
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
  "consistency",       // path to fast_learner + prismatic_eye (10 fame/L; requires genius_episode)
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
  "prismatic_eye",     // crit_gold_bonus (30 fame/L; requires consistency)
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

/** Effective gold per second for the current state. */
function gps(state: ReturnType<typeof useGameStore.getState>): number {
  const size = getCanvasSize(state);
  const gm   = getCanvasGoldMultiplier(state);
  const sm   = getCanvasSpeedMultiplier(state);
  const pm   = getPmMultiplier(state);
  const crit = getCritChance(state);
  const baseTime  = canvasTime(size);
  const normTime  = baseTime / sm;
  // avg time: crit canvases complete CRIT_SPEED_FACTOR× faster
  const avgTime   = normTime * (1 - (1 - 1 / CRIT_SPEED_FACTOR) * crit);
  const avgGold   = canvasGold(size, gm).mul(pm).toNumber();
  return avgGold / avgTime;
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

  if (getCanvasTrackUnlocked(state, "size"))
    tryTrack(sizeUpgradeCost(state.sizeLevel).toNumber(),
      { sizeLevel: state.sizeLevel + 1 },
      () => useGameStore.getState().upgradeSize());

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
    useGameStore.getState()._setPaintMastery(big(0));
  });

  it("runs 3-hour simulation and logs pacing", () => {
    const milestones: string[] = [];
    let firstAscendAt = -1;

    const addMilestone = (t: number, msg: string) => {
      milestones.push(`  [${fmtTime(t)}] *** ${msg} ***`);
    };

    // Track first-time flag unlocks
    let sizUnlocked = false, critUnlocked = false, comboUnlocked = false;

    // Progressive ascend target: starts small, doubles each run up to the cap
    let ascendMinFame = ASCEND_FAME_START;

    console.log("\n=== Artdle Bot Simulation ===");
    console.log("Format: [H:MM:SS] G/s | I/s | SP:# Sp:# Si:# Cr:# Co:# | WS:L# | Asc:# | Fame:#\n");

    for (let t = 0; t < MAX_S; t += TICK_S) {
      useGameStore.getState().tickAll(TICK_S);

      if (t % DECISION_EVERY_S === 0) {
        const state = useGameStore.getState();

        // Ascend when payout meets the current progressive target
        if (canAscend(state) && fameOnAscend(state.inspiration) >= ascendMinFame) {
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

        decideTreeParts();
        decideSkillTree(t, milestones);
        decideCanvasUpgrades();
        decideCraftAndEquip();
        decideHire();

        // Detect first-time track unlocks
        const s2 = useGameStore.getState();
        if (!sizUnlocked && getCanvasTrackUnlocked(s2, "size")) {
          sizUnlocked = true;
          addMilestone(t, "UNLOCKED canvas_size track");
        }
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
          `SP:${state.sellPriceLevel} Sp:${state.speedLevel} Si:${state.sizeLevel} Cr:${state.critLevel} Co:${state.comboLevel}`,
          `WS:L${state.workshopLevel}`,
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
    console.log("\n=== Final State (3h) ===");
    console.log(`  Gold:          ${fmtN(final.gold.toNumber())}`);
    console.log(`  Fame:          ${fmtN(final.fame.toNumber())}`);
    console.log(`  Ascends:       ${final.ascendCount}`);
    console.log(`  G/s:           ${fmtN(gps(final))}`);
    console.log(`  I/s:           ${fmtN(ips(final))}`);
    console.log(`  Canvas tracks: SP:${final.sellPriceLevel} Sp:${final.speedLevel} Si:${final.sizeLevel} Cr:${final.critLevel} Co:${final.comboLevel}`);
    console.log(`  Workshop:      L${final.workshopLevel} (${final.inventory.length} in inv, ${Object.keys(final.equipped).length} equipped)`);
    console.log(`  Paint Mastery: ${fmtN(final.paintMastery.toNumber())}`);
    console.log(`  First ascend:  ${firstAscendAt >= 0 ? fmtTime(firstAscendAt) : "never"}`);
    console.log(`  Size unlocked: ${sizUnlocked} | Crit unlocked: ${critUnlocked} | Combo unlocked: ${comboUnlocked}`);
  }, 30_000);
});
