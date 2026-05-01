import type { Big } from "./bigNumber";
import { big } from "./bigNumber";

const SUFFIXES: ReadonlyArray<readonly [number, string]> = [
  [1e15, "Q"],
  [1e12, "T"],
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
];

/** Short-form: 1234 → "1.23K", 12_345_678 → "12.35M". Negatives keep sign. */
export function formatShort(value: number | Big): string {
  const n = typeof value === "number" ? value : value.toNumber();
  if (!Number.isFinite(n)) return "∞";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);

  for (const [threshold, suffix] of SUFFIXES) {
    if (abs >= threshold) {
      return `${sign}${(abs / threshold).toFixed(2)}${suffix}`;
    }
  }
  // Below 1K: 0 decimal places for integers, 2 for floats with fractional part
  if (Number.isInteger(abs)) return `${sign}${abs}`;
  return `${sign}${abs.toFixed(2)}`;
}

/** Full Decimal-aware short form. Falls back to break_eternity.js scientific for huge values. */
export function formatBig(value: Big): string {
  const n = value.toNumber();
  if (Number.isFinite(n) && Math.abs(n) < 1e18) return formatShort(n);
  // Beyond Quintillion: scientific notation
  return value.toExponential(2);
}

export const _internal = { SUFFIXES, big };
