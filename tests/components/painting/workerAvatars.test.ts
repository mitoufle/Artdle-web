import { describe, it, expect } from "vitest";
import { WORKER_AVATARS } from "@/components/painting/workerAvatars";

describe("WORKER_AVATARS", () => {
  it("exposes 4 resolved image paths", () => {
    expect(WORKER_AVATARS).toHaveLength(4);
    for (const src of WORKER_AVATARS) {
      expect(typeof src).toBe("string");
      expect(src.length).toBeGreaterThan(0);
    }
  });
});
