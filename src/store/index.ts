import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { idbAdapter } from "@/systems/persistence";
import { createMetaSlice, type MetaSlice } from "./metaSlice";
import { createCurrencySlice, type CurrencySlice } from "./currencySlice";
import { createHoverInfoSlice, type HoverInfoSlice } from "./hoverInfoSlice";
import { createTreeSlice, type TreeSlice } from "./treeSlice";
import { big, isBig } from "@/core/bigNumber";

export type GameStore = MetaSlice & CurrencySlice & HoverInfoSlice & TreeSlice;

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
    (...a) => ({
      ...createMetaSlice(...a),
      ...createCurrencySlice(...a),
      ...createHoverInfoSlice(...a),
      ...createTreeSlice(...a),
    }),
    {
      name: SAVE_KEY,
      version: SAVE_VERSION,
      storage: createJSONStorage(() => idbAdapter, { reviver }),
      migrate,
      partialize: (s) => {
        // Exclude transient hover-info, then pre-wrap Bigs as `{ __big: "..." }` markers.
        const { hoverTitle: _t, hoverBody: _b, hoverFooter: _f, ...rest } = s;
        return serializeBigs(rest) as unknown as Omit<
          GameStore,
          "hoverTitle" | "hoverBody" | "hoverFooter"
        >;
      },
    },
  ),
);
