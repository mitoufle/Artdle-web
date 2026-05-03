import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { persistedAdapter } from "@/systems/persistence";
import { createMetaSlice, type MetaSlice } from "./metaSlice";
import { createCurrencySlice, type CurrencySlice } from "./currencySlice";
import { createHoverInfoSlice, type HoverInfoSlice } from "./hoverInfoSlice";
import { createTreeSlice, type TreeSlice } from "./treeSlice";
import { createCanvasSlice, type CanvasSlice } from "./canvasSlice";
import { createSkillTreeSlice, type SkillTreeSlice } from "./skillTreeSlice";
import { createWorkshopSlice, type WorkshopSlice } from "./workshopSlice";
import { createViewSlice, type ViewSlice } from "./viewSlice";
import { createUiSlice, type UiSlice } from "./uiSlice";
import { big, isBig } from "@/core/bigNumber";

export interface GameTick {
  /**
   * Per-frame orchestrator. Calls `treeTick(delta)` first, then `canvasTick(delta)`.
   * Order is part of the API contract and pinned by tests; future phases that
   * depend on freshly-credited inspiration (none in Phase 2) require tree-first.
   * Idle frames (delta ≤ 0) are no-ops via each child's own early-return guard.
   */
  tickAll: (deltaSeconds: number) => void;
}

export type GameStore =
  & MetaSlice
  & CurrencySlice
  & HoverInfoSlice
  & TreeSlice
  & CanvasSlice
  & SkillTreeSlice
  & WorkshopSlice
  & ViewSlice
  & UiSlice
  & GameTick;

const SAVE_VERSION = 1;
const SAVE_KEY = "artdle-save";

/**
 * v1 has no prior version to migrate from. The chain stub exists so future
 * waves can append migrations without reorganising this file.
 */
const migrate = (persisted: unknown, _fromVersion: number): GameStore => {
  return persisted as GameStore;
};

/**
 * Big values (break_eternity.js Decimal) need custom serialisation.
 * `JSON.stringify` calls `Decimal.toJSON()` BEFORE invoking any replacer,
 * so a replacer-based approach can't see Decimals — they arrive as bare strings.
 * Instead, we walk the partialized state and pre-wrap Bigs as `{ __big: "..." }`
 * markers before `JSON.stringify` ever runs.
 */
type SerializedBig = { __big: string };
const isSerializedBig = (v: unknown): v is SerializedBig =>
  typeof v === "object" && v !== null && "__big" in v;

function serializeBigs(value: unknown): unknown {
  if (isBig(value)) return { __big: value.toString() };
  if (Array.isArray(value)) return value.map(serializeBigs);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value)) {
      out[k] = serializeBigs((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

const reviver = (_key: string, value: unknown): unknown => {
  if (isSerializedBig(value)) return big(value.__big);
  return value;
};

export const useGameStore = create<GameStore>()(
  persist(
    (set, get, store) => ({
      ...createMetaSlice(set, get, store),
      ...createCurrencySlice(set, get, store),
      ...createHoverInfoSlice(set, get, store),
      ...createTreeSlice(set, get, store),
      ...createCanvasSlice(set, get, store),
      ...createSkillTreeSlice(set, get, store),
      ...createWorkshopSlice(set, get, store),
      ...createViewSlice(set, get, store),
      ...createUiSlice(set, get, store),
      tickAll: (deltaSeconds: number) => {
        const s = get();
        s.treeTick(deltaSeconds);
        s.canvasTick(deltaSeconds);
      },
    }),
    {
      name: SAVE_KEY,
      version: SAVE_VERSION,
      storage: createJSONStorage(() => persistedAdapter, { reviver }),
      migrate,
      partialize: (s) => {
        // Exclude transient hover-info + UI + animation-trigger state, then pre-wrap Bigs as `{ __big: "..." }` markers.
        const {
          hoverTitle: _t,
          hoverBody: _b,
          hoverFooter: _f,
          workshopPopupOpen: _w,
          lastSale: _ls,
          ...rest
        } = s;
        return serializeBigs(rest) as unknown as Omit<
          GameStore,
          "hoverTitle" | "hoverBody" | "hoverFooter" | "workshopPopupOpen" | "lastSale"
        >;
      },
    },
  ),
);
