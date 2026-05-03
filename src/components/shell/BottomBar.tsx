import type { JSX } from "react";
import { useLocation } from "react-router-dom";
import { useGameStore } from "@/store";
import { formatBig } from "@/core/formatter";
import { CurrencyChip, type CurrencyKind } from "./CurrencyChip";
import styles from "./BottomBar.module.css";

/**
 * Per-route prominence map.
 * - /tree: gold + inspi (the gold→tree→inspi loop)
 * - /painting: gold + PM (the canvas earns gold and PM)
 * - /ascension: inspi + fame (inspi converts to fame at the threshold)
 * - /constellation: fame (the only spend currency on this route)
 *
 * Currencies not in the prominent set dim per handoff §IA: 28% opacity,
 * 0.4 saturation. Dim transitions take 200ms ease.
 */
const ROUTE_PROMINENCE: Record<string, ReadonlySet<CurrencyKind>> = {
  "/tree":          new Set(["gold", "inspi"]),
  "/painting":      new Set(["gold", "pm"]),
  "/ascension":     new Set(["inspi", "fame"]),
  "/constellation": new Set(["fame"]),
};

const DEFAULT_PROMINENT: ReadonlySet<CurrencyKind> = new Set(["gold", "inspi"]);

function isProminent(kind: CurrencyKind, pathname: string): boolean {
  const set = ROUTE_PROMINENCE[pathname] ?? DEFAULT_PROMINENT;
  return set.has(kind);
}

export function BottomBar(): JSX.Element {
  const gold = useGameStore((s) => s.gold);
  const inspiration = useGameStore((s) => s.inspiration);
  const fame = useGameStore((s) => s.fame);
  const paintMastery = useGameStore((s) => s.paintMastery);
  const { pathname } = useLocation();

  return (
    <footer className={styles.bar}>
      <div className={styles.chips}>
        <CurrencyChip
          kind="gold"
          label="Gold"
          value={formatBig(gold)}
          dimmed={!isProminent("gold", pathname)}
        />
        <CurrencyChip
          kind="inspi"
          label="Inspi"
          value={formatBig(inspiration)}
          dimmed={!isProminent("inspi", pathname)}
        />
        <CurrencyChip
          kind="fame"
          label="Fame"
          value={formatBig(fame)}
          dimmed={!isProminent("fame", pathname)}
        />
        <CurrencyChip
          kind="pm"
          label="PM"
          value={formatBig(paintMastery)}
          dimmed={!isProminent("pm", pathname)}
        />
      </div>
    </footer>
  );
}
