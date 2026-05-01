import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbAdapter } from "@/systems/persistence";
import { createMetaSlice, type MetaSlice } from "./metaSlice";
import { createCurrencySlice, type CurrencySlice } from "./currencySlice";
import { createHoverInfoSlice, type HoverInfoSlice } from "./hoverInfoSlice";
import { big } from "@/core/bigNumber";

export type GameStore = MetaSlice & CurrencySlice & HoverInfoSlice;

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
 * Big values (break_eternity.js Decimal) need custom serialisation —
 * JSON.stringify drops methods. We round-trip Big values via a marker shape.
 */
type SerializedBig = { __big: string };
const isSerializedBig = (v: unknown): v is SerializedBig =>
  typeof v === "object" && v !== null && "__big" in v;

const serializer = {
  reviver: (_key: string, value: unknown): unknown => {
    if (isSerializedBig(value)) return big(value.__big);
    return value;
  },
  replacer: (_key: string, value: unknown): unknown => {
    // Decimal instances have a `toJSON` method; we wrap them in our marker shape.
    if (value && typeof value === "object" && "toJSON" in value && typeof (value as { toJSON: unknown }).toJSON === "function") {
      return { __big: String(value) };
    }
    return value;
  },
};

export const useGameStore = create<GameStore>()(
  persist(
    (...a) => ({
      ...createMetaSlice(...a),
      ...createCurrencySlice(...a),
      ...createHoverInfoSlice(...a),
    }),
    {
      name: SAVE_KEY,
      version: SAVE_VERSION,
      storage: createJSONStorage(() => idbAdapter, serializer),
      migrate,
      partialize: (s) => {
        // Exclude transient hover-info from save.
        const { hoverTitle: _t, hoverBody: _b, hoverFooter: _f, ...rest } = s;
        return rest as Omit<GameStore, "hoverTitle" | "hoverBody" | "hoverFooter">;
      },
    },
  ),
);
