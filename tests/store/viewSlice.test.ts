import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";

describe("viewSlice", () => {
  beforeEach(() => {
    useGameStore.setState({ currentView: "home" });
  });

  it("defaults currentView to 'home'", () => {
    expect(useGameStore.getState().currentView).toBe("home");
  });

  it("setView('painting') updates currentView", () => {
    useGameStore.getState().setView("painting");
    expect(useGameStore.getState().currentView).toBe("painting");
  });

  it("setView('ascension') updates currentView", () => {
    useGameStore.getState().setView("ascension");
    expect(useGameStore.getState().currentView).toBe("ascension");
  });

  it("setView('skills') updates currentView", () => {
    useGameStore.getState().setView("skills");
    expect(useGameStore.getState().currentView).toBe("skills");
  });

  it("setView round-trips through every ViewId", () => {
    const ids = ["home", "painting", "ascension", "skills"] as const;
    for (const id of ids) {
      useGameStore.getState().setView(id);
      expect(useGameStore.getState().currentView).toBe(id);
    }
  });
});
