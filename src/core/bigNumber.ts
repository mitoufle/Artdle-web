import Decimal from "break_eternity.js";

export type Big = Decimal;

export const big = (n: number | string): Big => new Decimal(n);

export const ZERO: Big = big(0);
export const ONE: Big = big(1);

export const isBig = (x: unknown): x is Big => x instanceof Decimal;

export const max = (a: Big, b: Big): Big => (a.gte(b) ? a : b);
export const min = (a: Big, b: Big): Big => (a.lte(b) ? a : b);
