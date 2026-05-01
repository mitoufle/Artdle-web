import type { StateCreator } from "zustand";
import { big, type Big } from "@/core/bigNumber";

export type CurrencyKey = "gold" | "inspiration" | "fame";

export interface CurrencyState {
  gold: Big;
  inspiration: Big;
  fame: Big;
}

export interface CurrencySlice extends CurrencyState {
  /** Add `amount` to the named currency. Negative amounts are rejected (use `spend`). */
  add: (key: CurrencyKey, amount: Big) => void;
  /** Try to spend `amount`. Returns true on success, false if insufficient balance. */
  spend: (key: CurrencyKey, amount: Big) => boolean;
  /** Reset gold + inspiration to 0 (used by ascend). Fame is preserved across ascends. */
  resetRunCurrencies: () => void;
}

const initialState: CurrencyState = {
  gold: big(0),
  inspiration: big(0),
  fame: big(0),
};

export const createCurrencySlice: StateCreator<CurrencySlice, [], [], CurrencySlice> = (set, get) => ({
  ...initialState,

  add: (key, amount) => {
    if (amount.lt(0)) return; // refuse negative add
    set((s) => ({ [key]: s[key].add(amount) }) as Partial<CurrencyState>);
  },

  spend: (key, amount) => {
    const cur = get()[key];
    if (cur.lt(amount)) return false;
    set((s) => ({ [key]: s[key].sub(amount) }) as Partial<CurrencyState>);
    return true;
  },

  resetRunCurrencies: () => set({ gold: big(0), inspiration: big(0) }),
});
