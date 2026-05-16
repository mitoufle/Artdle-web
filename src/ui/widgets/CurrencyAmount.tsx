import type { JSX } from "react";

const ICON_SRC = {
  gold:  "/assets/artdle/Currency/coin.png",
  inspi: "/assets/artdle/Currency/Inspiration.png",
  fame:  "/assets/artdle/Currency/fame.png",
  pm:    "/assets/artdle/Currency/Painting_mastery.png",
} as const;

export type CurrencyKind = keyof typeof ICON_SRC;

interface Props {
  kind: CurrencyKind;
  value: string | number;
  size?: number;
}

export function CurrencyAmount({ kind, value, size = 18 }: Props): JSX.Element {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <img
        src={ICON_SRC[kind]}
        width={size}
        height={size}
        aria-hidden="true"
        style={{ imageRendering: "pixelated", flexShrink: 0 }}
      />
      {value}
    </span>
  );
}
