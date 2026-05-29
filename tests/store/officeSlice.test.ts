import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";
import {
  initialOfficeState,
  getRosterCap,
  createWorker,
  type Worker,
} from "@/store/officeSlice";
import { createBaseStats } from "@/core/workerModel";
import { big } from "@/core/bigNumber";
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
    expect((initialOfficeState as Record<string, unknown>).officeLevel).toBeUndefined();
    expect((initialOfficeState as Record<string, unknown>).queue).toBeUndefined();
    expect((initialOfficeState as Record<string, unknown>).trickleTimer).toBeUndefined();
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
});

describe("getRosterCap", () => {
  it("returns 0 when no roster_slot nodes are purchased", () => {
    const state = { purchasedNodes: {} } as GameStore;
    expect(getRosterCap(state)).toBe(0);
  });
});

describe("reconcileRoster", () => {
  it("spawns level-1 workers up to the roster cap", () => {
    useGameStore.setState({ purchasedNodes: { hire_manager: 2 } });
    useGameStore.getState().reconcileRoster();
    expect(useGameStore.getState().roster.length).toBe(2);
    for (const w of useGameStore.getState().roster) {
      expect(w.level).toBe(1);
      expect(w.stats).toEqual(createBaseStats());
    }
  });

  it("is idempotent — calling twice does not over-spawn", () => {
    useGameStore.setState({ purchasedNodes: { hire_manager: 2 } });
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
});

describe("resetOffice (ascend) — workers persist, run contribution resets", () => {
  it("keeps the roster and its levels/xp but zeroes strokesThisRun", () => {
    const w: Worker = { ...createWorker(), level: 4, xp: big(99), strokesThisRun: 1234 };
    useGameStore.setState({ roster: [w] });
    useGameStore.getState().resetOffice();
    const after = useGameStore.getState().roster;
    expect(after.length).toBe(1);
    expect(after[0]!.level).toBe(4);
    expect(after[0]!.xp.eq(big(99))).toBe(true);
    expect(after[0]!.strokesThisRun).toBe(0);
  });
});
