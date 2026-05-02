import type { JSX, ReactNode } from "react";
import { useGameStore } from "@/store";

interface Props {
  title: string | (() => string);
  body: ReactNode | (() => ReactNode);
  footer?: ReactNode | (() => ReactNode);
  /**
   * Wrapper element. Default `"span"` is valid phrasing content for inline
   * children (`<button>`, `<span>`). Use `"div"` when wrapping block-level
   * children (`<h2>`, `<p>`, `<section>`) to avoid React's `validateDOMNesting`
   * dev-mode warning.
   */
  as?: "span" | "div";
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
 * unchanged — string is assignable to `string | (() => string)`. Phase 5
 * follow-up added the `as` prop so callers wrapping block-level children can
 * opt into a `<div>` wrapper without producing HTML-nesting warnings.
 */
export function Hoverable({
  title,
  body,
  footer,
  as,
  children,
}: Props): JSX.Element {
  const pushHoverInfo = useGameStore((s) => s.pushHoverInfo);
  const clearHoverInfo = useGameStore((s) => s.clearHoverInfo);
  const Tag = as ?? "span";
  return (
    <Tag
      onMouseEnter={() =>
        pushHoverInfo(resolve(title), resolve(body), resolve(footer ?? ""))
      }
      onMouseLeave={() => clearHoverInfo()}
    >
      {children}
    </Tag>
  );
}
