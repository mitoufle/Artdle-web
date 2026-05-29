import { type Big } from "@/core/bigNumber";
import type { GameStore } from "@/store";
import type { CurrencyKey } from "@/store/currencySlice";
import type { StatsLifetime, StatsRun } from "@/store/statsSlice";

/** Mutable view of GameStore for draft mutations during simulation. */
export type Mutable<T> = { -readonly [K in keyof T]: T[K] };
export type DraftState = Mutable<GameStore>;

export function addCurrency(draft: DraftState, key: CurrencyKey, amount: Big): void {
  if (amount.lt(0)) return;
  draft[key] = draft[key].add(amount);
}

export function spendCurrency(draft: DraftState, key: CurrencyKey, amount: Big): boolean {
  if (draft[key].lt(amount)) return false;
  draft[key] = draft[key].sub(amount);
  return true;
}

export function trackSaleGoldPure(draft: DraftState, saleGold: Big): void {
  draft.lifetimeGold = draft.lifetimeGold.add(saleGold);
}

export function trackInspirationGainPure(draft: DraftState, amount: Big): void {
  draft.lifetimeInspiration = draft.lifetimeInspiration.add(amount);
}

export function incrementStatPure(
  draft: DraftState,
  namespace: "lifetime" | "run",
  key: string,
  by = 1,
): void {
  if (namespace === "lifetime") {
    const rec = draft.statsLifetime as unknown as Record<string, number>;
    const prev = rec[key] ?? 0;
    draft.statsLifetime = { ...draft.statsLifetime, [key]: prev + by } as StatsLifetime;
  } else {
    const rec = draft.statsRun as unknown as Record<string, unknown>;
    const prev = (rec[key] as number | undefined) ?? 0;
    draft.statsRun = { ...draft.statsRun, [key]: prev + by } as StatsRun;
  }
}

export function patchRunStatsPure(draft: DraftState, patch: Partial<StatsRun>): void {
  draft.statsRun = { ...draft.statsRun, ...patch };
}
