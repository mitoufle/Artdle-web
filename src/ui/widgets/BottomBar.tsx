import type { JSX } from "react";
import { CurrencyDisplay } from "./CurrencyDisplay";

export function BottomBar(): JSX.Element {
  return (
    <footer className="flex items-center justify-center gap-6 border-t border-app-panel bg-app-bg px-4 py-2">
      <CurrencyDisplay kind="gold" />
      <CurrencyDisplay kind="inspiration" />
      <CurrencyDisplay kind="fame" />
    </footer>
  );
}
