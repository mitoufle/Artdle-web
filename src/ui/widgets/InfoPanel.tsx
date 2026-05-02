import type { JSX } from "react";
import { useGameStore } from "@/store";

export function InfoPanel(): JSX.Element {
  const title = useGameStore((s) => s.hoverTitle);
  const body = useGameStore((s) => s.hoverBody);
  const footer = useGameStore((s) => s.hoverFooter);
  return (
    <section
      aria-live="polite"
      className="min-h-16 border-t border-b border-app-panel bg-app-panel px-4 py-2 text-sm"
    >
      {title !== "" && <div className="font-semibold">{title}</div>}
      <div className="opacity-90">{body}</div>
      <div className="opacity-60">{footer}</div>
    </section>
  );
}
