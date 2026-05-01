import type { JSX } from "react";
import { useGameStore } from "@/store";
import { isPlayerId } from "@/core/playerId";

export function App(): JSX.Element {
  const playerId = useGameStore((s) => s.playerId);
  return (
    <main className="flex h-screen w-screen flex-col items-center justify-center bg-app-bg text-app-text">
      <h1 className="mb-4 text-4xl font-bold">Artdle</h1>
      <p className="text-sm opacity-60">v0.1 — scaffold</p>
      <p className="mt-8 text-xs opacity-40">
        playerId: {playerId} {isPlayerId(playerId) ? "✓" : "✗"}
      </p>
    </main>
  );
}
