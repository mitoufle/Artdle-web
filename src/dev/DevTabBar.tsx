import type { JSX } from "react";
import { NavLink } from "react-router-dom";
import styles from "./DevTabBar.module.css";

export function DevTabBar(): JSX.Element {
  return (
    <div className={styles.tabBar}>
      <NavLink
        className={({ isActive }) => `${styles.tab}${isActive ? ` ${styles.tabActive}` : ""}`}
        to="/dev/skill-designer"
      >
        Skill Designer
      </NavLink>
      <NavLink
        className={({ isActive }) => `${styles.tab}${isActive ? ` ${styles.tabActive}` : ""}`}
        to="/dev/school-designer"
      >
        School Designer
      </NavLink>
      <NavLink
        className={({ isActive }) => `${styles.tab}${isActive ? ` ${styles.tabActive}` : ""}`}
        to="/dev/achievement-designer"
      >
        Achievement Designer
      </NavLink>
    </div>
  );
}
