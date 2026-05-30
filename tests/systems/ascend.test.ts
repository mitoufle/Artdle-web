import { describe, it, expect, beforeEach } from "vitest";
import {
  canAscend,
  performAscendOrchestrator,
} from "@/systems/ascend";
import { useGameStore } from "@/store";
import { createWorker } from "@/store/officeSlice";
import { big } from "@/core/bigNumber";
import { fameOnAscend } from "@/core/balance";

describe("systems/ascend", () => {
  beforeEach(() => {
    useGameStore.getState().resetRunCurrencies();
    useGameStore.getState().resetTree();
    useGameStore.getState().resetCanvas();
    useGameStore.getState().resetWorkshop();
    useGameStore.setState({ purchasedNodes: {}, ascendCount: 0, fame: big(0) });
  });

  // ============================================================================
  // canAscend — gated at 10,000 inspi (first fame point)
  // ============================================================================

  it("canAscend returns false below 10k inspi, true at/above", () => {
    expect(canAscend(useGameStore.getState())).toBe(false);
    useGameStore.getState().add("inspiration", big(9_999));
    expect(canAscend(useGameStore.getState())).toBe(false);
    useGameStore.getState().add("inspiration", big(1));
    expect(canAscend(useGameStore.getState())).toBe(true);
  });

  // ============================================================================
  // performAscendOrchestrator
  // ============================================================================

  it("performAscendOrchestrator on success: gold → 0, inspiration → 0", () => {
    useGameStore.getState().add("gold", big(500));
    useGameStore.getState().add("inspiration", big(12_000));
    expect(
      performAscendOrchestrator(useGameStore.getState),
    ).toBe(true);
    expect(useGameStore.getState().gold.toNumber()).toBe(0);
    expect(useGameStore.getState().inspiration.toNumber()).toBe(0);
  });

  it("performAscendOrchestrator on success: fame increases by fameOnAscend(inspirationBeforeReset)", () => {
    useGameStore.getState().add("inspiration", big(12_000));
    const expectedFameGain = fameOnAscend(big(12_000));
    const beforeFame = useGameStore.getState().fame.toNumber();
    performAscendOrchestrator(useGameStore.getState);
    expect(useGameStore.getState().fame.toNumber()).toBe(beforeFame + expectedFameGain);
  });

  it("performAscendOrchestrator on success: ascendCount increments by 1", () => {
    useGameStore.getState().add("inspiration", big(12_000));
    const beforeCount = useGameStore.getState().ascendCount;
    performAscendOrchestrator(useGameStore.getState);
    expect(useGameStore.getState().ascendCount).toBe(beforeCount + 1);
  });

  it("performAscendOrchestrator on success: tree resets (currentStage=0, all partLevels=0)", () => {
    useGameStore.getState().add("gold", big(10000));
    useGameStore.getState().buyPartLevel("u1");
    useGameStore.setState({ currentStage: 1 });
    useGameStore.getState().buyPartLevel("u2");
    useGameStore.getState().add("inspiration", big(12_000));
    performAscendOrchestrator(useGameStore.getState);
    const s = useGameStore.getState();
    expect(s.currentStage).toBe(0);
    expect(s.partLevels.u1).toBe(0);
    expect(s.partLevels.u2).toBe(0);
  });

  it("performAscendOrchestrator on success: canvas resets (canvasProgress=0)", () => {
    useGameStore.setState({ canvasProgress: 7.5 });
    useGameStore.getState().add("inspiration", big(12_000));
    performAscendOrchestrator(useGameStore.getState);
    expect(useGameStore.getState().canvasProgress).toBe(0);
  });

  it("performAscendOrchestrator on success: workshop resets (inventory empty, equipped empty)", () => {
    useGameStore.setState({
      inventory: [
        {
          id: "inv-1",
          slot: "brush" as const,
          tier: "normal" as const,
          affixes: [{ kind: "+sell_price%" as const, magnitude: 10 }],
          fuseCount: 0,
        },
      ],
      equipped: {
        brush: {
          id: "eq-1",
          slot: "brush" as const,
          tier: "magic" as const,
          affixes: [{ kind: "+speed%" as const, magnitude: 8 }],
          fuseCount: 0,
        },
      },
    });
    useGameStore.getState().add("inspiration", big(12_000));
    performAscendOrchestrator(useGameStore.getState);
    const s = useGameStore.getState();
    expect(s.inventory).toEqual([]);
    expect(s.equipped).toEqual({});
  });

  it("performAscendOrchestrator applies +% Fame gain school bonus (Math.floor)", () => {
    // branding: kind="+% Fame gain", value=0.02 → +2% more fame
    // use 1,000,000 inspi (≈102 fame) so 2% is non-trivial: floor(102*1.02)=104
    useGameStore.setState({ completedResearches: { branding: true } });
    useGameStore.getState().add("inspiration", big(1_000_000));
    const baseFame = fameOnAscend(big(1_000_000));
    performAscendOrchestrator(useGameStore.getState);
    const expectedFame = Math.floor(baseFame * (1 + 0.02));
    expect(expectedFame).toBeGreaterThan(baseFame); // sanity: 2% bonus must change the result
    expect(useGameStore.getState().fame.toNumber()).toBe(expectedFame);
  });

  it("performAscendOrchestrator applies no bonus when school research not completed", () => {
    useGameStore.setState({ completedResearches: {} });
    useGameStore.getState().add("inspiration", big(1_000_000));
    const baseFame = fameOnAscend(big(1_000_000));
    performAscendOrchestrator(useGameStore.getState);
    expect(useGameStore.getState().fame.toNumber()).toBe(baseFame);
  });

  it("performAscendOrchestrator on success: purchasedNodes UNCHANGED (preserved)", () => {
    useGameStore.setState({
      purchasedNodes: { get_inspired: 2, black_white: 1 },
    });
    useGameStore.getState().add("inspiration", big(12_000));
    performAscendOrchestrator(useGameStore.getState);
    expect(useGameStore.getState().purchasedNodes).toEqual({
      get_inspired: 2,
      black_white: 1,
    });
  });

  it("performAscendOrchestrator on success: playerId UNCHANGED", () => {
    const beforeId = useGameStore.getState().playerId;
    useGameStore.getState().add("inspiration", big(12_000));
    performAscendOrchestrator(useGameStore.getState);
    expect(useGameStore.getState().playerId).toBe(beforeId);
  });

  it("performAscendOrchestrator multiple times: ascendCount increments each time", () => {
    useGameStore.getState().add("inspiration", big(12_000));
    performAscendOrchestrator(useGameStore.getState);
    expect(useGameStore.getState().ascendCount).toBe(1);
    useGameStore.getState().add("inspiration", big(15_000));
    performAscendOrchestrator(useGameStore.getState);
    expect(useGameStore.getState().ascendCount).toBe(2);
  });

  it("performAscendOrchestrator with inspi=0: returns false, no fame, no state change", () => {
    expect(useGameStore.getState().inspiration.toNumber()).toBe(0);
    const beforeFame = useGameStore.getState().fame.toNumber();
    const beforeCount = useGameStore.getState().ascendCount;
    expect(
      performAscendOrchestrator(useGameStore.getState),
    ).toBe(false);
    expect(useGameStore.getState().fame.toNumber()).toBe(beforeFame);
    expect(useGameStore.getState().ascendCount).toBe(beforeCount);
  });

  describe("performAscendOrchestrator — pastRuns ledger (v2.0 Round 3)", () => {
    beforeEach(() => {
      useGameStore.getState().resetTree();
      useGameStore.getState().resetCanvas();
      useGameStore.getState().resetWorkshop();
      useGameStore.getState().resetRunCurrencies();
      useGameStore.setState({ ascendCount: 0, fame: big(0), pastRuns: [] });
    });

    it("appends a pastRun entry on successful ascend with the captured fame gain", () => {
      useGameStore.setState({ inspiration: big(12_000) });
      const before = useGameStore.getState().pastRuns.length;
      const ok = useGameStore.getState().performAscend();
      expect(ok).toBe(true);
      const runs = useGameStore.getState().pastRuns;
      expect(runs.length).toBe(before + 1);
      expect(runs[runs.length - 1]!.fame).toBeGreaterThan(0);
      expect(typeof runs[runs.length - 1]!.ascendedAt).toBe("number");
    });

    it("does not append a pastRun when ascend is blocked (below 10k inspi)", () => {
      useGameStore.setState({ inspiration: big(0) });
      const before = useGameStore.getState().pastRuns.length;
      const ok = useGameStore.getState().performAscend();
      expect(ok).toBe(false);
      expect(useGameStore.getState().pastRuns.length).toBe(before);
    });
  });

  // ============================================================================
  // v1.1 reset semantics: lifetime stats
  // ============================================================================

  describe("performAscendOrchestrator — lifetime stats", () => {
    beforeEach(() => {
      useGameStore.getState().resetCanvas();
      useGameStore.getState().resetRunCurrencies();
      useGameStore.getState()._setLifetimeGold(big(0));
    });

    it("ascend preserves lifetimeGold and lifetimeInspiration exactly (no reset)", () => {
      useGameStore.setState({ inspiration: big(12_000) });
      useGameStore.getState()._setLifetimeGold(big(99_999));
      useGameStore.getState()._setLifetimeInspiration(big(123));
      performAscendOrchestrator(useGameStore.getState);
      expect(useGameStore.getState().lifetimeGold.toNumber()).toBe(99_999);
      expect(useGameStore.getState().lifetimeInspiration.toNumber()).toBe(123);
    });
  });

  describe("performAscendOrchestrator — empty-roster ascend is byte-identical to pre-office", () => {
    it("no roster: fame credited, run currencies reset, no error, no roll", () => {
      useGameStore.setState({
        inspiration: big(1_000_000), // well above the 10k fame gate
        gold: big(5000),
        roster: [],
        lastAscendRoll: null,
      });
      const fameBefore = useGameStore.getState().fame;
      const ok = performAscendOrchestrator(useGameStore.getState);
      expect(ok).toBe(true);
      const s = useGameStore.getState();
      expect(s.gold.eq(big(0))).toBe(true);
      expect(s.inspiration.eq(big(0))).toBe(true);
      expect(s.fame.gt(fameBefore)).toBe(true);
      expect(s.roster).toEqual([]);
      expect(s.lastAscendRoll).toBeNull();
    });

    it("with a roster: workers gain XP from the fame pool and strokesThisRun resets", () => {
      const w = { ...createWorker(), strokesThisRun: 100 };
      // Pin purchasedNodes so a leaked accelerator from another test can't alter the pool.
      useGameStore.setState({ inspiration: big(1_000_000_000), roster: [w], purchasedNodes: {}, lastAscendRoll: null });
      performAscendOrchestrator(useGameStore.getState);
      const after = useGameStore.getState();
      expect(after.roster[0]!.strokesThisRun).toBe(0);
      // fameGain at 1e9 inspi = floor((9-4)^5 × 3.2) = 10000 → pool ≈ 10000 → ~2 levels
      // for a fresh worker (first level costs 3000 under the 3000×1.9^(L-1) curve).
      // MUST be `> 1`: a worker starts at level 1 and level only increases, so `>= 1`
      // would pass even if applyAscendXp did nothing.
      expect(after.roster[0]!.level).toBeGreaterThan(1);
    });
  });
});
