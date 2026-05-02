import type { JSX, ReactNode } from "react";
import { useGameStore } from "@/store";

interface Props {
  title: string;
  body: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Wrapper that pushes hover content to hoverInfoSlice on mouseEnter and
 * clears it on mouseLeave. Phase 4 builds and tests this; Phase 5 wraps
 * every interactive element. Kept as a <span> so it doesn't break inline
 * layouts (a <button> child still gets focus + click handling).
 */
export function Hoverable({ title, body, footer, children }: Props): JSX.Element {
  const pushHoverInfo = useGameStore((s) => s.pushHoverInfo);
  const clearHoverInfo = useGameStore((s) => s.clearHoverInfo);
  return (
    <span
      onMouseEnter={() => pushHoverInfo(title, body, footer ?? "")}
      onMouseLeave={() => clearHoverInfo()}
    >
      {children}
    </span>
  );
}
