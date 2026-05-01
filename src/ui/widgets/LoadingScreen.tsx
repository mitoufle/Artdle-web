import type { JSX } from "react";

export function LoadingScreen(): JSX.Element {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-app-bg text-app-text">
      <div className="text-2xl">Loading…</div>
    </div>
  );
}
