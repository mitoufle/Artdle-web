import { describe, it, expect } from "vitest";
import { WORKER_NAME_POOL } from "@/config/workerNames";

describe("WORKER_NAME_POOL", () => {
  it("is a non-empty list of distinct non-empty strings", () => {
    expect(WORKER_NAME_POOL.length).toBeGreaterThanOrEqual(12);
    expect(new Set(WORKER_NAME_POOL).size).toBe(WORKER_NAME_POOL.length);
    for (const n of WORKER_NAME_POOL) {
      expect(typeof n).toBe("string");
      expect(n.length).toBeGreaterThan(0);
    }
  });
});
