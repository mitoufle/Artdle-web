import type { JSX } from "react";

export function LoadingScreen(): JSX.Element {
  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", alignItems: "center", justifyContent: "center" }}>
      <div>Loading…</div>
    </div>
  );
}
