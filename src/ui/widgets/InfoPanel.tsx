import type { JSX } from "react";
import { useGameStore } from "@/store";

export function InfoPanel(): JSX.Element {
  const title = useGameStore((s) => s.hoverTitle);
  const body = useGameStore((s) => s.hoverBody);
  const footer = useGameStore((s) => s.hoverFooter);
  return (
    <section
      aria-live="polite"
      className="h-20 overflow-hidden border-t border-b border-app-panel bg-app-panel px-4 py-2 text-sm"
    >
      {/* Title is gated against empty render because hoverTitle is a string;
          body and footer are ReactNode and render harmlessly when empty. */}
      {title !== "" && <div className="font-semibold">{title}</div>}
      <div className="opacity-90">{body}</div>
      <div className="opacity-60">{footer}</div>
    </section>
  );
}
