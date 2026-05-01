import type { StateCreator } from "zustand";
import type { ReactNode } from "react";

export interface HoverInfoState {
  hoverTitle: string;
  hoverBody: ReactNode;
  hoverFooter: ReactNode;
}

export interface HoverInfoSlice extends HoverInfoState {
  pushHoverInfo: (title: string, body: ReactNode, footer: ReactNode) => void;
  clearHoverInfo: () => void;
}

const empty: HoverInfoState = {
  hoverTitle: "",
  hoverBody: "",
  hoverFooter: "",
};

export const createHoverInfoSlice: StateCreator<HoverInfoSlice, [], [], HoverInfoSlice> = (set) => ({
  ...empty,
  pushHoverInfo: (title, body, footer) => set({ hoverTitle: title, hoverBody: body, hoverFooter: footer }),
  clearHoverInfo: () => set(empty),
});
