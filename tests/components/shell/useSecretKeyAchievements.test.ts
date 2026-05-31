import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSecretKeyAchievements } from "@/components/shell/useSecretKeyAchievements";
import { useGameStore } from "@/store";

beforeEach(() => {
  useGameStore.setState((s) => ({
    completedAchievements: {},
    activeNotification: null,
    notificationQueue: [],
    statsLifetime: { ...s.statsLifetime, fPresses: 0 },
  }));
});

describe("useSecretKeyAchievements", () => {
  it("pressing F unlocks Pay Respect", () => {
    renderHook(() => useSecretKeyAchievements(true));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "f" }));
    expect(useGameStore.getState().statsLifetime.fPresses).toBe(1);
    expect(useGameStore.getState().completedAchievements.Pay_respect).toBe(true);
  });

  it("ignores F while typing in a text field", () => {
    renderHook(() => useSecretKeyAchievements(true));
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "f", bubbles: true }));
    expect(useGameStore.getState().statsLifetime.fPresses).toBe(0);
    expect(useGameStore.getState().completedAchievements.Pay_respect).toBeUndefined();
    document.body.removeChild(input);
  });

  it("ignores F when a modifier is held (e.g. Ctrl+F)", () => {
    renderHook(() => useSecretKeyAchievements(true));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "f", ctrlKey: true }));
    expect(useGameStore.getState().statsLifetime.fPresses).toBe(0);
  });

  it("does nothing when disabled (dev routes)", () => {
    renderHook(() => useSecretKeyAchievements(false));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "f" }));
    expect(useGameStore.getState().statsLifetime.fPresses).toBe(0);
  });
});
