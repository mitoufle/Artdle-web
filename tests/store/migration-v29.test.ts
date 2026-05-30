import { describe, it, expect } from "vitest";
import { migrate } from "@/store";
import { big } from "@/core/bigNumber";
import { createBaseStats } from "@/core/workerModel";
import { WORKER_NAME_POOL } from "@/config/workerNames";

const legacyWorker = () => ({
  id: "legacy-1", classId: "base", level: 3, xp: big(0),
  stats: createBaseStats(), mastery: 0, strokesThisRun: 0,
  // no name, no avatar
});

describe("migrate v28 → v29 (worker name + avatar)", () => {
  it("backfills name + avatar on workers that lack them", () => {
    const result = migrate({ roster: [legacyWorker()] }, 28);
    const w = result.roster[0]!;
    expect(WORKER_NAME_POOL).toContain(w.name);
    expect(w.avatar).toBeGreaterThanOrEqual(1);
    expect(w.avatar).toBeLessThanOrEqual(4);
  });

  it("preserves name + avatar that are already present", () => {
    const result = migrate(
      { roster: [{ ...legacyWorker(), name: "Frida", avatar: 2 }] },
      28,
    );
    const w = result.roster[0]!;
    expect(w.name).toBe("Frida");
    expect(w.avatar).toBe(2);
  });
});
