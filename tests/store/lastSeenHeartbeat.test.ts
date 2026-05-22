import { describe, expect, it, beforeEach } from "vitest";
import { useGameStore, _resetHeartbeat } from "@/store";

describe("lastSeen heartbeat", () => {
  beforeEach(() => {
    _resetHeartbeat();
  });

  it("updates lastSeen every ~10 simulated seconds in tickAll", () => {
    const fakeNow = 1_700_001_000_000;
    const realNow = Date.now;
    Date.now = () => fakeNow;
    try {
      useGameStore.setState({ lastSeen: 0 });
      // 5 second tick — should NOT update yet
      useGameStore.getState().tickAll(5);
      expect(useGameStore.getState().lastSeen).toBe(0);
      // 6 more seconds — accumulator crosses 10s
      useGameStore.getState().tickAll(6);
      expect(useGameStore.getState().lastSeen).toBe(fakeNow);
    } finally {
      Date.now = realNow;
    }
  });

  it("does not update on delta=0 idle frames", () => {
    const fakeNow = 1_700_002_000_000;
    const realNow = Date.now;
    Date.now = () => fakeNow;
    try {
      useGameStore.setState({ lastSeen: 0 });
      // 100 idle frames
      for (let i = 0; i < 100; i++) useGameStore.getState().tickAll(0);
      expect(useGameStore.getState().lastSeen).toBe(0);
    } finally {
      Date.now = realNow;
    }
  });
});
