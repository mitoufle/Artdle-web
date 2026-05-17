import type { JSX, ReactNode } from "react";
import { useState } from "react";
import { useGameStore } from "@/store";
import { ACHIEVEMENTS, type Achievement, type AchievementCategory } from "@/config/achievementConfig";
import { Hoverable } from "@/ui/widgets/Hoverable";
import styles from "./AchievementsRoute.module.css";

const CATEGORIES: { id: AchievementCategory; label: string }[] = [
  { id: "canvas",        label: "Canvas" },
  { id: "workshop",      label: "Workshop" },
  { id: "ascension",     label: "Ascension" },
  { id: "school_office", label: "School & Office" },
  { id: "secret",        label: "Secrets" },
];

function effectLabel(kind: string, value: number): string {
  if (kind === "paint_mastery_flat") return `+${value} PM`;
  if (kind === "canvas_gold_pct") return `+${Math.round(value * 100)}% canvas gold`;
  if (kind === "speed_pct") return `+${Math.round(value * 100)}% speed`;
  if (kind === "inspi_pct") return `+${Math.round(value * 100)}% inspiration`;
  return `+${value} ${kind}`;
}

function achievementBody(a: Achievement): ReactNode {
  return (
    <>
      <div>{a.description}</div>
      {a.effects.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {a.effects.map((e, i) => (
            <div key={i}>{effectLabel(e.kind, e.value)}</div>
          ))}
        </div>
      )}
    </>
  );
}

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
                  <Hoverable
                    key={a.id}
                    as="div"
                    title={`${a.icon} ${a.name}`}
                    body={() => achievementBody(a)}
                  >
                    <div className={styles.tile}>
                      <span className={styles.icon}>{a.icon}</span>
                      <span className={styles.tileName}>{a.name}</span>
                    </div>
                  </Hoverable>
                ))}
              </div>
            </section>
          );
        })
      )}
    </section>
  );
}
