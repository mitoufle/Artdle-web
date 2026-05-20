import type { JSX, ReactNode } from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { AchievementCategory } from "./types";
import styles from "./AchievementDesignerRoute.module.css";

export interface CategoryGroupProps {
  category: AchievementCategory;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  itemIds: ReadonlyArray<string>;
  children: ReactNode;
}

export function CategoryGroup({
  category,
  count,
  expanded,
  onToggle,
  itemIds,
  children,
}: CategoryGroupProps): JSX.Element {
  const bodyId = `category-${category}-body`;
  return (
    <section className={styles.group}>
      <button
        type="button"
        className={styles.groupHeader}
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={bodyId}
      >
        <span className={styles.groupChevron} aria-hidden="true">{expanded ? "▾" : "▸"}</span>
        <span className={styles.groupName}>{category.replace(/_/g, " ")}</span>
        {" "}
        <span className={styles.groupCount}>({count})</span>
      </button>
      {expanded && (
        <div id={bodyId} className={styles.groupBody}>
          <SortableContext items={[...itemIds]} strategy={verticalListSortingStrategy}>
            {children}
          </SortableContext>
        </div>
      )}
    </section>
  );
}
