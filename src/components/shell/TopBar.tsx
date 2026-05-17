import type { JSX } from "react";
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useGameStore } from "@/store";
import { persistedAdapter } from "@/systems/persistence";
import { useMusic } from "@/ui/hooks/useMusic";
import { MusicControls } from "./MusicControls";
import styles from "./TopBar.module.css";

const NAV_ITEMS: ReadonlyArray<{ to: string; label: string }> = [
  { to: "/tree",          label: "Tree" },
  { to: "/painting",      label: "Painting" },
  { to: "/ascension",     label: "Ascension" },
  { to: "/constellation", label: "Constellation" },
  { to: "/achievements",  label: "Achievements" },
];

async function wipeAndReload(): Promise<void> {
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
  persistedAdapter.discard(); // cancel pending write so beforeunload flush cannot restore the save
  window.location.reload();
}

export function TopBar(): JSX.Element {
  const { pathname } = useLocation();
  const [confirming, setConfirming] = useState(false);
  const music = useMusic();

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
        <MusicControls controls={music} />
        {confirming ? (
          <>
            <span className={styles.confirmPrompt}>Wipe all progress?</span>
            <button
              type="button"
              className={styles.confirmYes}
              onClick={() => void wipeAndReload()}
            >
              Yes
            </button>
            <button
              type="button"
              className={styles.confirmNo}
              onClick={() => setConfirming(false)}
            >
              No
            </button>
          </>
        ) : (
          <button
            type="button"
            className={styles.resetBtn}
            onClick={() => setConfirming(true)}
            title="DEV: wipe all progress and reload"
            data-testid="dev-reset-progress"
          >
            ↻ reset
          </button>
        )}
        <span>Saved</span>
      </div>
    </header>
  );
}
