import type { JSX } from "react";
import { NavLink, useLocation } from "react-router-dom";
import styles from "./TopBar.module.css";

const NAV_ITEMS: ReadonlyArray<{ to: string; label: string }> = [
  { to: "/tree",          label: "Tree" },
  { to: "/painting",      label: "Painting" },
  { to: "/ascension",     label: "Ascension" },
  { to: "/constellation", label: "Constellation" },
];

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
        <span>Saved</span>
      </div>
    </header>
  );
}
