import { describe, it, expect } from "vitest";
import { big } from "@/core/bigNumber";
import { workerXpToNext, XP_GOLD_FRACTION } from "@/core/balance";
import { useGameStore } from "@/store";

describe("awardOfficeXp — equal share + mirror to office.xp", () => {
  it("divides the gold-fraction pot equally across roster", () => {
    useGameStore.setState({
      officeLevel: 0,
      officeXp: big(0),
      roster: [
        { id: "w1", class: "generalist" as const, tier: "common" as const, level: 1, xp: big(0), affixes: [] },
        { id: "w2", class: "generalist" as const, tier: "common" as const, level: 1, xp: big(0), affixes: [] },
      ],
    });
    const goldSold = big(1000);
    useGameStore.getState().awardOfficeXp(goldSold);
    const pot = goldSold.mul(XP_GOLD_FRACTION);   // 10 XP
    const perWorker = pot.div(2);                  // 5 XP each
    const s = useGameStore.getState();
    expect(s.roster[0]!.xp.toNumber()).toBeCloseTo(perWorker.toNumber(), 4);
    expect(s.roster[1]!.xp.toNumber()).toBeCloseTo(perWorker.toNumber(), 4);
    expect(s.officeXp.toNumber()).toBeCloseTo(pot.toNumber(), 4);
  });

  it("levels up a worker when xp ≥ workerXpToNext(level)", () => {
    const initialXp = workerXpToNext(1);   // exact cost to level up from 1 → 2
    useGameStore.setState({
      officeLevel: 0,
      officeXp: big(0),
      roster: [
        { id: "w1", class: "generalist" as const, tier: "common" as const, level: 1, xp: initialXp, affixes: [] },
      ],
    });
    // Award tiny gold — level-up resolution fires because xp >= threshold.
    useGameStore.getState().awardOfficeXp(big(1));
    const s = useGameStore.getState();
    expect(s.roster[0]!.level).toBe(2);
    // XP carries over (any overflow into the next level's bucket).
  });

  it("noop when roster is empty", () => {
    useGameStore.setState({ officeLevel: 0, officeXp: big(0), roster: [] });
    useGameStore.getState().awardOfficeXp(big(1000));
    // officeXp still receives the pot per the spec — Office Level is mirror-of-pot.
    expect(useGameStore.getState().officeXp.toNumber()).toBeGreaterThan(0);
  });
});
