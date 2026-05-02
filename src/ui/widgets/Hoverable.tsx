import type { JSX, ReactNode } from "react";
import { useGameStore } from "@/store";

interface Props {
  title: string | (() => string);
  body: ReactNode | (() => ReactNode);
  footer?: ReactNode | (() => ReactNode);
  children: ReactNode;
}

const resolve = <T,>(v: T | (() => T)): T =>
  typeof v === "function" ? (v as () => T)() : v;

/**
 * Wrapper that pushes hover content to hoverInfoSlice on mouseEnter and
 * clears it on mouseLeave. Phase 4 built and tested with static-only props.
 * Phase 5 extended Props to support factory callbacks for live values:
 * factories run at hover time inside the event handler (event-handler context
 * satisfies the I-1 view-subscription rule). Static usage continues to work
 * unchanged — string is assignable to `string | (() => string)`.
 */
export function Hoverable({ title, body, footer, children }: Props): JSX.Element {
  const pushHoverInfo = useGameStore((s) => s.pushHoverInfo);
  const clearHoverInfo = useGameStore((s) => s.clearHoverInfo);
  return (
    <span
      onMouseEnter={() =>
        pushHoverInfo(resolve(title), resolve(body), resolve(footer ?? ""))
      }
      onMouseLeave={() => clearHoverInfo()}
    >
      {children}
    </span>
  );
}
