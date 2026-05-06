import type { JSX } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useGameStore } from "@/store";
import styles from "./TopBar.module.css";

const NAV_ITEMS: ReadonlyArray<{ to: string; label: string }> = [
  { to: "/tree",          label: "Tree" },
  { to: "/painting",      label: "Painting" },
  { to: "/ascension",     label: "Ascension" },
  { to: "/constellation", label: "Constellation" },
];

/**
 * Wipe persisted save + designer drafts and reload. Dev-only convenience for
 * the unreleased game; will be removed before public ship.
 */
async function resetAllProgress(): Promise<void> {
  const ok = window.confirm(
    "Reset ALL progress? This wipes the save (gold, fame, tree, canvas, workshop, skill tree) and the designer draft.",
  );
  if (!ok) return;
  try {
    await useGameStore.persist.clearStorage();
  } catch {
    // ignore — reload will reseed
  }
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
  window.location.reload();
}

export function TopBar(): JSX.Element {
  const { pathname } = useLocation();
  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <span className={styles.brandA}>A</span>
        <span>RTDLE</span>
      </div>
      <nav className={styles.nav} aria-label="Primary">
        {NAV_ITEMS.map(({ to, label }) => {
          const isActive = pathname === to;
          const className = isActive
            ? `${styles.navItem as string} ${styles.navItemActive as string}`
            : (styles.navItem as string);
          return (
            <NavLink
              key={to}
              to={to}
              end
              className={className}
              data-active={isActive ? "true" : undefined}
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && <span className={styles.flourish} aria-hidden="true">✦</span>}
              <span>{label}</span>
              {isActive && <span className={styles.flourish} aria-hidden="true">✦</span>}
            </NavLink>
          );
        })}
      </nav>
      <div className={styles.meta} aria-label="Autosave status">
        <button
          type="button"
          className={styles.resetBtn}
          onClick={() => void resetAllProgress()}
          title="DEV: wipe all progress and reload"
          data-testid="dev-reset-progress"
        >
          ↻ reset
        </button>
        <span>Saved</span>
      </div>
    </header>
  );
}
