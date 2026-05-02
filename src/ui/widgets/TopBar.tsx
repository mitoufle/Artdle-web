import type { JSX } from "react";
import { useGameStore } from "@/store";
import type { ViewId } from "@/store/viewSlice";

interface NavButtonProps {
  id: ViewId;
  label: string;
}

function NavButton({ id, label }: NavButtonProps): JSX.Element {
  const currentView = useGameStore((s) => s.currentView);
  const setView = useGameStore((s) => s.setView);
  const isActive = currentView === id;
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={() => setView(id)}
      className={
        "rounded px-3 py-1 text-sm transition-colors " +
        (isActive ? "bg-app-panel text-app-text" : "text-app-text/60 hover:text-app-text")
      }
    >
      {label}
    </button>
  );
}

export function TopBar(): JSX.Element {
  return (
    <header className="flex items-center justify-between border-b border-app-panel bg-app-bg px-4 py-2">
      <strong className="text-lg tracking-wide">Artdle</strong>
      <nav className="flex gap-1">
        <NavButton id="home" label="Home" />
        <NavButton id="painting" label="Painting" />
        <NavButton id="ascension" label="Ascension" />
        <NavButton id="skills" label="Skills" />
      </nav>
      <span className="text-xs opacity-40">v0.1</span>
    </header>
  );
}
