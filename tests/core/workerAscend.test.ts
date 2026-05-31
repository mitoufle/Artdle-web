import { describe, it, expect, beforeEach } from "vitest";
import { setSeed } from "@/core/rng";
import { big } from "@/core/bigNumber";
import {
  splitAscendPool,
  applyAscendXpToWorker,
  countWorkerLevelGains,
  previewAscendLevelGains,
} from "@/core/workerAscend";
import { createWorker } from "@/store/officeSlice";
import { WORKER_BASELINE_XP_FRACTION, workerXpToNext } from "@/core/balance";
import { rng } from "@/core/rng";

function workerWith(over: Partial<ReturnType<typeof createWorker>>) {
  return { ...createWorker(), ...over };
}

describe("countWorkerLevelGains", () => {
  beforeEach(() => setSeed(7));

  it("returns 0 when the share can't reach the next level", () => {
    const w = createWorker(); // level 1, cost to L2 = 1000
    expect(countWorkerLevelGains(w, big(999))).toBe(0);
  });

  it("matches the level delta actually applied by applyAscendXpToWorker", () => {
    for (const share of [big(1000), big(2500), big(7000), big(50000)]) {
      const w = createWorker();
      const applied = applyAscendXpToWorker(w, share);
      expect(countWorkerLevelGains(w, share)).toBe(applied.levelAfter - applied.levelBefore);
    }
  });

  it("does not consume the RNG (safe to call every render in a preview)", () => {
    setSeed(42);
    const before = rng();
    setSeed(42);
    countWorkerLevelGains(createWorker(), big(100000));
    const after = rng();
    expect(after).toBe(before);
  });
});

describe("previewAscendLevelGains", () => {
  beforeEach(() => setSeed(7));

  it("is 0 for an empty roster", () => {
    expect(previewAscendLevelGains(big(100000), [])).toBe(0);
  });

  it("sums the level gains the roster would get from the pool", () => {
    const roster = [
      workerWith({ strokesThisRun: 100 }),
      workerWith({ strokesThisRun: 0 }),
    ];
    const pool = big(8000);
    const shares = splitAscendPool(pool, roster);
    const expected = roster.reduce((sum, w, i) => sum + countWorkerLevelGains(w, shares[i]!), 0);
    expect(previewAscendLevelGains(pool, roster)).toBe(expected);
    expect(expected).toBeGreaterThan(0);
  });
});

describe("splitAscendPool", () => {
  it("returns [] for an empty roster", () => {
    expect(splitAscendPool(big(100), [])).toEqual([]);
  });

  it("baseline floor: a zero-stroke worker still gets XP (never a trap)", () => {
    const a = workerWith({ strokesThisRun: 100 });
    const b = workerWith({ strokesThisRun: 0 });
    const [sa, sb] = splitAscendPool(big(100), [a, b]);
    expect(sb!.gt(0)).toBe(true);
    expect(sa!.gt(sb!)).toBe(true);
    expect(sa!.add(sb!).toNumber()).toBeCloseTo(100, 6);
  });

  it("Σstrokes==0 falls back to an equal split", () => {
    const a = workerWith({ strokesThisRun: 0 });
    const b = workerWith({ strokesThisRun: 0 });
    const [sa, sb] = splitAscendPool(big(100), [a, b]);
    expect(sa!.toNumber()).toBeCloseTo(50, 6);
    expect(sb!.toNumber()).toBeCloseTo(50, 6);
  });

  it("baseline fraction controls floor vs contribution", () => {
    const a = workerWith({ strokesThisRun: 1 });
    const b = workerWith({ strokesThisRun: 0 });
    const [sa, sb] = splitAscendPool(big(100), [a, b], 1);
    expect(sa!.toNumber()).toBeCloseTo(50, 6);
    expect(sb!.toNumber()).toBeCloseTo(50, 6);
  });
});

describe("applyAscendXpToWorker", () => {
  beforeEach(() => setSeed(7));

  it("no level-up when the share is below the next-level cost", () => {
    const w = createWorker(); // level 1, xp 0; workerXpToNext(1) === 1000
    const r = applyAscendXpToWorker(w, big(1));
    expect(r.levelAfter).toBe(1);
    expect(r.worker.xp.toNumber()).toBeCloseTo(1, 6);
    expect(r.worker.stats).toEqual(w.stats);
  });

  it("levels up and rolls stat increments; mastery tracks levels", () => {
    const w = createWorker();
    const r = applyAscendXpToWorker(w, big(20000));
    expect(r.levelAfter).toBeGreaterThan(r.levelBefore);
    expect(r.worker.level).toBe(r.levelAfter);
    expect(r.worker.mastery).toBe(w.mastery + (r.levelAfter - r.levelBefore));
    const grew =
      r.statsAfter.goldPct > r.statsBefore.goldPct ||
      r.statsAfter.speed > r.statsBefore.speed ||
      r.statsAfter.critChance > r.statsBefore.critChance ||
      r.statsAfter.strokesPerCrit > r.statsBefore.strokesPerCrit ||
      r.statsAfter.comboChance > r.statsBefore.comboChance;
    expect(grew).toBe(true);
  });

  it("carries leftover XP toward the next level", () => {
    const w = createWorker();
    const cost1 = workerXpToNext(1).toNumber(); // === 1000
    const r = applyAscendXpToWorker(w, big(cost1 + 3));
    expect(r.levelAfter).toBe(2);
    expect(r.worker.xp.toNumber()).toBeCloseTo(3, 4);
  });

  // ANCHOR-SHAPE ACCEPTANCE CHECK (LOCKED): levels-per-ascend stays bounded as the
  // pool grows; high-level workers gain few levels; a realistic max fame (1e4)
  // never drives a worker near the level cap.
  it("levels-per-ascend stays bounded and does not accelerate (fame anchor sanity)", () => {
    const fresh = createWorker();                            // level 1
    const veteran = { ...createWorker(), level: 50, xp: big(0) };
    const POOL = big(10_000);
    const freshGain = applyAscendXpToWorker(fresh, POOL).levelAfter - 1;
    const vetGain = applyAscendXpToWorker(veteran, POOL).levelAfter - 50;
    // At growth 1.9 a 10k pool gives a FRESH worker 2 levels (3000+5700 = 8700 ≤ 10k,
    // the 3rd level costs 10830 > the 1300 remainder) and a level-50 veteran 0 (their
    // next level alone dwarfs 10k). vetGain==0 is INTENTIONAL. Rails assert cap-safety
    // (freshGain << LEVEL_UP_CAP) and the fresh>vet catch-up shape.
    expect(freshGain).toBeGreaterThan(vetGain);
    expect(freshGain).toBeLessThan(200);
    expect(vetGain).toBeLessThan(20);
  });
});
