import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import {
  initialOfficeState,
  getRosterCap,
  getWorkerSpawnBonuses,
  getWorkerXpGrowth,
  createWorker,
  type Worker,
} from "@/store/officeSlice";
import { createBaseStats } from "@/core/workerModel";
import { WORKER_NAME_POOL } from "@/config/workerNames";
import { setSeed } from "@/core/rng";
import { big } from "@/core/bigNumber";
import { migrate } from "@/store";
import type { GameStore } from "@/store";

beforeEach(() => {
  useGameStore.setState({
    roster: [],
    purchasedNodes: {},
  });
});

describe("initialOfficeState", () => {
  it("starts with an empty roster and no legacy office fields", () => {
    expect(initialOfficeState.roster).toEqual([]);
    expect((initialOfficeState as unknown as Record<string, unknown>).officeLevel).toBeUndefined();
    expect((initialOfficeState as unknown as Record<string, unknown>).queue).toBeUndefined();
    expect((initialOfficeState as unknown as Record<string, unknown>).trickleTimer).toBeUndefined();
  });
});

describe("office worker skill-node selectors", () => {
  it("getWorkerSpawnBonuses reads food_regulation / robin_hood / blury_hand by capability", () => {
    expect(getWorkerSpawnBonuses({ purchasedNodes: {} })).toEqual({
      foodRegulation: 0, robinHoodLevels: 0, bluryHandLevels: 0, handcraftedBrushLevels: 0,
    });
    expect(getWorkerSpawnBonuses({
      purchasedNodes: { food_regulation: 1, robin_hood: 3, blury_hand: 1, handcrafted_brush: 2 },
    })).toEqual({ foodRegulation: 1, robinHoodLevels: 3, bluryHandLevels: 1, handcraftedBrushLevels: 2 });
  });

  it("getWorkerXpGrowth lowers growth by 0.05 per learning_curve level, floored at 1.0", () => {
    expect(getWorkerXpGrowth({ purchasedNodes: {} })).toBeCloseTo(1.5, 9);
    expect(getWorkerXpGrowth({ purchasedNodes: { learning_curve: 1 } })).toBeCloseTo(1.45, 9);
  });

  it("reconcileRoster spawns workers with skill-node-boosted base stats", () => {
    useGameStore.setState({
      roster: [],
      // entrepreneur + hire_manager give roster slots; robin_hood boosts goldPct.
      purchasedNodes: { entrepreneur: 1, robin_hood: 2, blury_hand: 1 },
    });
    useGameStore.getState().reconcileRoster();
    const roster = useGameStore.getState().roster;
    expect(roster.length).toBeGreaterThan(0);
    expect(roster[0]!.stats.goldPct).toBeCloseTo(0.14, 9); // 2 × 0.07
    expect(roster[0]!.stats.speed).toBeCloseTo(1.10, 9);   // +10% from blury_hand
  });
});

describe("createWorker", () => {
  it("spawns a fresh level-1 worker with base stats and zeroed run/meta fields", () => {
    const w = createWorker();
    expect(w.level).toBe(1);
    expect(w.classId).toBe("base");
    expect(w.xp.eq(big(0))).toBe(true);
    expect(w.mastery).toBe(0);
    expect(w.strokesThisRun).toBe(0);
    expect(w.stats).toEqual(createBaseStats());
    expect(typeof w.id).toBe("string");
    expect(w.id.length).toBeGreaterThan(0);
  });

  it("gives every worker a distinct id", () => {
    const a = createWorker();
    const b = createWorker();
    expect(a.id).not.toBe(b.id);
  });

  it("assigns a name from the pool and an avatar in 1..4", () => {
    const w = createWorker();
    expect(WORKER_NAME_POOL).toContain(w.name);
    expect(Number.isInteger(w.avatar)).toBe(true);
    expect(w.avatar).toBeGreaterThanOrEqual(1);
    expect(w.avatar).toBeLessThanOrEqual(4);
  });
});

describe("getRosterCap", () => {
  it("returns 0 when no roster_slot nodes are purchased", () => {
    const state = { purchasedNodes: {} } as GameStore;
    expect(getRosterCap(state)).toBe(0);
  });
});

describe("reconcileRoster", () => {
  it("spawns level-1 workers up to the roster cap", () => {
    // entrepreneur + hire_manager each grant 1 roster_slot (both maxLevel 1) → cap 2.
    useGameStore.setState({ purchasedNodes: { entrepreneur: 1, hire_manager: 1 } });
    useGameStore.getState().reconcileRoster();
    expect(useGameStore.getState().roster.length).toBe(2);
    for (const w of useGameStore.getState().roster) {
      expect(w.level).toBe(1);
      expect(w.stats).toEqual(createBaseStats());
    }
  });

  it("is idempotent — calling twice does not over-spawn", () => {
    useGameStore.setState({ purchasedNodes: { entrepreneur: 1, hire_manager: 1 } });
    useGameStore.getState().reconcileRoster();
    useGameStore.getState().reconcileRoster();
    expect(useGameStore.getState().roster.length).toBe(2);
  });

  it("never despawns when the roster already exceeds the cap", () => {
    const existing: Worker[] = [createWorker(), createWorker(), createWorker()];
    useGameStore.setState({ roster: existing, purchasedNodes: { hire_manager: 1 } });
    useGameStore.getState().reconcileRoster();
    expect(useGameStore.getState().roster.length).toBe(3);
  });

  it("does nothing when the cap is 0", () => {
    useGameStore.getState().reconcileRoster();
    expect(useGameStore.getState().roster.length).toBe(0);
  });

  it("normalizes colliding avatars so each worker is visually distinct", () => {
    const a = { ...createWorker(), avatar: 2 };
    const b = { ...createWorker(), avatar: 2 };
    const c = { ...createWorker(), avatar: 2 };
    useGameStore.setState({ roster: [a, b, c], purchasedNodes: { hire_manager: 3 } });
    useGameStore.getState().reconcileRoster();
    const avatars = useGameStore.getState().roster.map((w) => w.avatar);
    expect(new Set(avatars).size).toBe(avatars.length); // all distinct
    for (const av of avatars) {
      expect(av).toBeGreaterThanOrEqual(1);
      expect(av).toBeLessThanOrEqual(4);
    }
  });

  it("normalizes colliding names so each worker is uniquely named", () => {
    const a = { ...createWorker(), name: "Vincent" };
    const b = { ...createWorker(), name: "Vincent" };
    const c = { ...createWorker(), name: "Vincent" };
    useGameStore.setState({ roster: [a, b, c], purchasedNodes: { hire_manager: 3 } });
    useGameStore.getState().reconcileRoster();
    const names = useGameStore.getState().roster.map((w) => w.name);
    expect(new Set(names).size).toBe(names.length); // all distinct
    expect(names[0]).toBe("Vincent"); // first occurrence kept
  });
});

describe("buying a roster_slot node spawns a worker", () => {
  it("reconciles the roster after a successful purchase", () => {
    // hire_manager's prereq chain is entrepreneur → food_regulation → robin_hood,
    // so seed those at level 1 to satisfy the parent gate.
    useGameStore.setState({
      roster: [],
      purchasedNodes: { entrepreneur: 1, food_regulation: 1, robin_hood: 1 },
      devFreeNodes: true,
    });
    const ok = useGameStore.getState().buyNode("hire_manager");
    expect(ok).toBe(true);
    expect(useGameStore.getState().roster.length).toBe(getRosterCap(useGameStore.getState()));
    expect(useGameStore.getState().roster.length).toBeGreaterThan(0);
    useGameStore.setState({ devFreeNodes: false });
  });
});

describe("v26 save → migrate drops legacy fields; reconcile fills roster", () => {
  it("migrate strips officeLevel/officeXp/queue/trickleTimer and empties roster", () => {
    const old = {
      officeLevel: 5,
      officeXp: big(123),
      queue: [{ id: "c1" }],
      trickleTimer: 9,
      roster: [{ id: "legacy", class: "generalist", tier: "common", level: 3, xp: big(50), affixes: [] }],
      purchasedNodes: { hire_manager: 2 },
    };
    const migrated = migrate(old, 26) as unknown as Record<string, unknown>;
    expect(migrated.officeLevel).toBeUndefined();
    expect(migrated.officeXp).toBeUndefined();
    expect(migrated.queue).toBeUndefined();
    expect(migrated.trickleTimer).toBeUndefined();
    expect(migrated.roster).toEqual([]);
  });

  it("after migrate, reconcileRoster spawns level-1 workers for unlocked slots", () => {
    useGameStore.setState({ roster: [], purchasedNodes: { entrepreneur: 1, hire_manager: 1 } });
    useGameStore.getState().reconcileRoster();
    expect(useGameStore.getState().roster.length).toBe(2);
    expect(useGameStore.getState().roster.every((w) => w.level === 1)).toBe(true);
  });
});

describe("applyAscendXp", () => {
  beforeEach(() => {
    setSeed(1);
    useGameStore.setState({ roster: [], purchasedNodes: {}, lastAscendRoll: null });
  });

  it("is a no-op on an empty roster and clears the roll", () => {
    useGameStore.setState({ lastAscendRoll: [{ id: "x", levelBefore: 1, levelAfter: 2, statsBefore: createBaseStats(), statsAfter: createBaseStats() }] });
    useGameStore.getState().applyAscendXp(big(1000));
    expect(useGameStore.getState().roster).toEqual([]);
    expect(useGameStore.getState().lastAscendRoll).toBeNull();
  });

  it("grants XP, levels workers, captures the roll, and resets strokesThisRun", () => {
    const w = { ...createWorker(), strokesThisRun: 50 };
    useGameStore.setState({ roster: [w] });
    useGameStore.getState().applyAscendXp(big(20000));
    const after = useGameStore.getState();
    expect(after.roster[0]!.level).toBeGreaterThan(1);
    expect(after.roster[0]!.strokesThisRun).toBe(0);
    expect(after.lastAscendRoll).not.toBeNull();
    expect(after.lastAscendRoll![0]!.id).toBe(w.id);
    expect(after.lastAscendRoll![0]!.levelAfter).toBe(after.roster[0]!.level);
  });

  it("applyAscendXp(0) just resets strokesThisRun and keeps the roster (subsumes resetOffice)", () => {
    const w = { ...createWorker(), level: 4, xp: big(99), strokesThisRun: 1234 };
    useGameStore.setState({ roster: [w] });
    useGameStore.getState().applyAscendXp(big(0));
    const after = useGameStore.getState().roster[0]!;
    expect(after.level).toBe(4);
    expect(after.xp.eq(big(99))).toBe(true);
    expect(after.strokesThisRun).toBe(0);
    expect(useGameStore.getState().lastAscendRoll).toBeNull();
  });

  it("accelerator nodes boost the pool (more levels)", () => {
    // Pool 2000 straddles a level boundary on the 1000×1.5 curve: a lone worker
    // reaches L2 (cost 1000) with 1000 to spare, while a +50% pool (3000) also
    // clears L3 (cumulative 2500). Re-tuned with the eased curve (issue #4).
    const base = { ...createWorker(), strokesThisRun: 10 };
    useGameStore.setState({ roster: [base], purchasedNodes: {} });
    useGameStore.getState().applyAscendXp(big(2000));
    const noBoost = useGameStore.getState().roster[0]!.level;

    const base2 = { ...createWorker(), strokesThisRun: 10 };
    useGameStore.setState({ roster: [base2], purchasedNodes: { accelerator: 5 } });
    useGameStore.getState().applyAscendXp(big(2000));
    const boosted = useGameStore.getState().roster[0]!.level;
    // Strict: a +50% pool (accelerator ×5) must produce a strictly higher level —
    // `>=` would pass even if getWorkerXpPoolMultiplier were broken to return 1.
    expect(boosted).toBeGreaterThan(noBoost);
  });

  it("baseline floor: a zero-stroke worker in a mixed roster still gains XP", () => {
    const heavy = { ...createWorker(), strokesThisRun: 1000 };
    const idle = { ...createWorker(), strokesThisRun: 0 };
    useGameStore.setState({ roster: [heavy, idle] });
    useGameStore.getState().applyAscendXp(big(1000));
    const idleAfter = useGameStore.getState().roster[1]!;
    expect(idleAfter.xp.gt(0) || idleAfter.level > 1).toBe(true);
  });

  it("clearAscendRoll nulls the roll (Phase D dismiss hook)", () => {
    useGameStore.setState({ lastAscendRoll: [{ id: "x", levelBefore: 1, levelAfter: 2, statsBefore: createBaseStats(), statsAfter: createBaseStats() }] });
    useGameStore.getState().clearAscendRoll();
    expect(useGameStore.getState().lastAscendRoll).toBeNull();
  });
});

describe("lastAscendRoll is transient (stripped from the save)", () => {
  it("partialize excludes lastAscendRoll", () => {
    useGameStore.setState({ lastAscendRoll: [{ id: "x", levelBefore: 1, levelAfter: 2, statsBefore: createBaseStats(), statsAfter: createBaseStats() }] });
    const persisted = useGameStore.persist.getOptions().partialize!(useGameStore.getState());
    expect((persisted as Record<string, unknown>).lastAscendRoll).toBeUndefined();
  });
});
