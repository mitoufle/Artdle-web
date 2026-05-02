import type { StateCreator } from "zustand";

/**
 * Persisted view identifier. Renames require a save migration.
 */
export type ViewId = "home" | "painting" | "ascension" | "skills";

export interface ViewState {
  /** Last-active view; persisted via the existing partialize. Default "home". */
  currentView: ViewId;
}

export interface ViewSlice extends ViewState {
  /** Switch the active view. TS literal union enforces validity at call sites. */
  setView: (v: ViewId) => void;
}

export const initialViewState: ViewState = Object.freeze({
  currentView: "home",
}) as ViewState;

export const createViewSlice: StateCreator<ViewSlice, [], [], ViewSlice> = (set) => ({
  ...initialViewState,
  setView: (v) => set({ currentView: v }),
});
