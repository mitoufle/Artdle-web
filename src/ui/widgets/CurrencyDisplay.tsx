import type { JSX } from "react";
import { useGameStore } from "@/store";
import { formatBig } from "@/core/formatter";

export type CurrencyKind = "gold" | "inspiration" | "fame";

const LABELS: Record<CurrencyKind, string> = {
  gold: "Gold",
  inspiration: "Inspi",
  fame: "Fame",
};

const COLOR_CLASS: Record<CurrencyKind, string> = {
  gold: "text-gold",
  inspiration: "text-inspiration",
  fame: "text-fame",
};

interface Props {
  kind: CurrencyKind;
}

export function CurrencyDisplay({ kind }: Props): JSX.Element {
  const value = useGameStore((s) => s[kind]);
  return (
    <span className={"flex items-baseline gap-1 text-sm " + COLOR_CLASS[kind]}>
      <span className="font-semibold">{LABELS[kind]}:</span>
      <span data-testid={`currency-${kind}`}>{formatBig(value)}</span>
    </span>
  );
}
