import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store";

describe("uiSlice", () => {
  beforeEach(() => {
    useGameStore.setState({ workshopPopupOpen: false });
  });

  it("defaults workshopPopupOpen to false", () => {
    expect(useGameStore.getState().workshopPopupOpen).toBe(false);
  });

  it("openWorkshopPopup() flips workshopPopupOpen to true", () => {
    useGameStore.getState().openWorkshopPopup();
    expect(useGameStore.getState().workshopPopupOpen).toBe(true);
  });

  it("closeWorkshopPopup() flips workshopPopupOpen to false", () => {
    useGameStore.setState({ workshopPopupOpen: true });
    useGameStore.getState().closeWorkshopPopup();
    expect(useGameStore.getState().workshopPopupOpen).toBe(false);
  });
});
