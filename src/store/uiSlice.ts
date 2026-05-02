import type { StateCreator } from "zustand";

export interface UiState {
  /** Transient — stripped from partialize. Refresh closes the popup. */
  workshopPopupOpen: boolean;
}

export interface UiSlice extends UiState {
  openWorkshopPopup: () => void;
  closeWorkshopPopup: () => void;
}

export const initialUiState: UiState = Object.freeze({
  workshopPopupOpen: false,
}) as UiState;

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  ...initialUiState,
  openWorkshopPopup: () => set({ workshopPopupOpen: true }),
  closeWorkshopPopup: () => set({ workshopPopupOpen: false }),
});
