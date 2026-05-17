import type { JSX } from "react";
import { useState } from "react";
import { useGameStore } from "@/store";
import { ACHIEVEMENTS, type AchievementCategory } from "@/config/achievementConfig";
import styles from "./AchievementsRoute.module.css";

const CATEGORIES: { id: AchievementCategory; label: string }[] = [
  { id: "canvas",        label: "Canvas" },
  { id: "workshop",      label: "Workshop" },
  { id: "ascension",     label: "Ascension" },
  { id: "school_office", label: "School & Office" },
  { id: "secret",        label: "Secrets" },
];

export function AchievementsRoute(): JSX.Element {
  const completedAchievements = useGameStore((s) => s.completedAchievements);
  const [filter, setFilter] = useState<AchievementCategory | "all">("all");

  const completed = ACHIEVEMENTS.filter((a) => completedAchievements[a.id]);
  const visible =
    filter === "all" ? completed : completed.filter((a) => a.category === filter);

  // Total PM earned from achievements
  let totalPmFromAchievements = 0;
  for (const a of completed) {
    for (const e of a.effects) {
      if (e.kind === "paint_mastery_flat") totalPmFromAchievements += e.value;
    }
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Achievements</h1>
        <p className={styles.subtitle}>
          {completed.length} / {ACHIEVEMENTS.length} completed · {totalPmFromAchievements} PM
          earned
        </p>
      </header>

      <div className={styles.filterBar}>
        <button
          type="button"
          className={filter === "all" ? styles.filterChipActive : styles.filterChip}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        {CATEGORIES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={filter === id ? styles.filterChipActive : styles.filterChip}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className={styles.empty}>No achievements completed yet in this category.</p>
      ) : (
        CATEGORIES.filter(({ id }) => filter === "all" || filter === id).map(({ id, label }) => {
          const group = visible.filter((a) => a.category === id);
          if (group.length === 0) return null;
          return (
            <section key={id} className={styles.category}>
              <h2 className={styles.categoryLabel}>{label}</h2>
              <div className={styles.grid}>
                {group.map((a) => (
                  <div
                    key={a.id}
                    className={styles.tile}
                    title={`${a.name}: ${a.description}`}
                  >
                    <span className={styles.icon}>{a.icon}</span>
                    <span className={styles.tileName}>{a.name}</span>
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}
    </section>
  );
}
