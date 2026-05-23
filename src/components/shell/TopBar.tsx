import type { JSX } from "react";
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useGameStore } from "@/store";
import { persistedAdapter } from "@/systems/persistence";
import { useMusic } from "@/ui/hooks/useMusic";
import { MusicControls } from "./MusicControls";
import treeIcon from "@/assets/bar_icons/tree.png";
import paintingIcon from "@/assets/bar_icons/painting.png";
import musicIcon from "@/assets/bar_icons/music.png";
import sculptureIcon from "@/assets/bar_icons/sculpture.png";
import ascensionIcon from "@/assets/bar_icons/ascension.png";
import constellationIcon from "@/assets/bar_icons/constellation.png";
import achievementsIcon from "@/assets/bar_icons/Achievements.png";
import styles from "./TopBar.module.css";

type NavItem = {
  to: string;
  label: string;
  icon: string;
  locked?: boolean;
};

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { to: "/tree",          label: "Tree",          icon: treeIcon },
  { to: "/painting",      label: "Painting",      icon: paintingIcon },
  { to: "/music",         label: "Music",         icon: musicIcon,      locked: true },
  { to: "/sculpture",     label: "Sculpture",     icon: sculptureIcon,  locked: true },
  { to: "/ascension",     label: "Ascension",     icon: ascensionIcon },
  { to: "/constellation", label: "Constellation", icon: constellationIcon },
  { to: "/achievements",  label: "Achievements",  icon: achievementsIcon },
];

async function wipeAndReload(): Promise<void> {
  // Tell the lifecycle hook to skip its lastSeen `setState` on the imminent
  // beforeunload. Without this, that setState fires the Zustand persist
  // middleware which enqueues a save of the (still-in-memory) progress, and
  // the subsequent flush writes it straight back to IDB — undoing the wipe
  // and only the music (which lives in localStorage) appears reset.
  try {
    sessionStorage.setItem("__skipNextLastSeenWrite", "1");
  } catch {
    // ignore — fallback path still wipes IDB; worst case the lifecycle
    // re-persists state and the next reload after that picks up the wipe.
  }
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
  persistedAdapter.discard(); // cancel any pending write
  window.location.reload();
}

export function TopBar(): JSX.Element {
  const { pathname } = useLocation();
  const [confirming, setConfirming] = useState(false);
  const music = useMusic();

  return (
    <header className={styles.bar}>
      <img src="/artdle_logo.png" alt="Artdle" className={styles.brand} />
      <nav className={styles.nav} aria-label="Primary">
        {NAV_ITEMS.map(({ to, label, icon, locked }) => {
          if (locked) {
            return (
              <span
                key={to}
                className={`${styles.navItem as string} ${styles.navItemLocked as string}`}
                aria-disabled="true"
                aria-label={`${label} (locked)`}
                title={`${label} — coming soon`}
              >
                <img src={icon} alt="" className={styles.navIcon} />
                <svg
                  className={styles.lockBadge}
                  viewBox="0 0 10 10"
                  shapeRendering="crispEdges"
                  aria-hidden="true"
                >
                  {/* shackle */}
                  <rect x="3" y="1" width="4" height="1" fill="#2a2228" />
                  <rect x="3" y="2" width="1" height="2" fill="#2a2228" />
                  <rect x="6" y="2" width="1" height="2" fill="#2a2228" />
                  {/* body */}
                  <rect x="2" y="4" width="6" height="5" fill="#c98a2e" />
                  <rect x="2" y="4" width="6" height="1" fill="#f0c66a" />
                  <rect x="2" y="8" width="6" height="1" fill="#8a5a20" />
                  {/* keyhole */}
                  <rect x="4" y="5" width="2" height="2" fill="#2a2228" />
                  <rect x="4" y="7" width="2" height="1" fill="#2a2228" />
                </svg>
              </span>
            );
          }
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
              aria-label={label}
              title={label}
            >
              <img src={icon} alt="" className={styles.navIcon} />
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
