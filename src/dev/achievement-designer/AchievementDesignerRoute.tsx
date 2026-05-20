import type { JSX } from "react";
import { useState, useCallback } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useAchievementDesignerState } from "./useAchievementDesignerState";
import { DevTabBar } from "../DevTabBar";
import { saveToFile } from "./api";
import { SortableCard } from "./SortableCard";
import { groupByCategory } from "./groupByCategory";
import { CategoryGroup } from "./CategoryGroup";
import styles from "./AchievementDesignerRoute.module.css";

type Status = "saved" | "dirty" | "saving";

const KNOWN_EFFECT_KINDS = [
  "paint_mastery_flat",
  "canvas_gold_pct",
  "speed_pct",
  "inspi_pct",
];

export function AchievementDesignerRoute(): JSX.Element {
  const { design, actions } = useAchievementDesignerState();
  const [status, setStatus] = useState<Status>("saved");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggleCategory = useCallback((category: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  const usedKinds = new Set(design.flatMap((a) => a.effects.map((e) => e.kind)));
  const effectKindOptions = [...new Set([...KNOWN_EFFECT_KINDS, ...usedKinds])].filter((k) => k !== "");

  const markDirty = useCallback(() => setStatus("dirty"), []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeAch = design.find((a) => a.id === activeId);
    const overAch = design.find((a) => a.id === overId);
    if (!activeAch || !overAch) return;
    if (activeAch.category !== overAch.category) return;
    const toIndex = design.findIndex((a) => a.id === overId);
    markDirty();
    actions.moveAchievement(activeId, toIndex);
  }, [design, actions, markDirty]);

  const handleSave = useCallback(async () => {
    setStatus("saving");
    const result = await saveToFile(design);
    setStatus(result.ok ? "saved" : "dirty");
  }, [design]);

  return (
    <div className={styles.layout}>
      <div className={styles.topBar}>
        <span className={styles.title}>Achievement Designer</span>
        <span className={
          status === "saved" ? styles.statusSaved :
          status === "saving" ? styles.statusSaving :
          styles.statusDirty
        }>
          {status === "saved" ? "Saved" : status === "saving" ? "Saving…" : "Unsaved changes"}
        </span>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={handleSave}
          type="button"
        >
          Save to file
        </button>
        <button
          className={styles.btn}
          onClick={() => { actions.resetAll(); setStatus("saved"); }}
          type="button"
        >
          Reset
        </button>
      </div>
      <DevTabBar />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className={styles.content}>
          {groupByCategory(design).map((group) => (
            <CategoryGroup
              key={group.category}
              category={group.category}
              count={group.achievements.length}
              expanded={expanded.has(group.category)}
              onToggle={() => toggleCategory(group.category)}
              itemIds={group.achievements.map((a) => a.id)}
            >
              {group.achievements.map((ach) => (
                <SortableCard
                  key={ach.id}
                  ach={ach}
                  effectKindOptions={effectKindOptions}
                  onMarkDirty={markDirty}
                  onUpdateAchievement={actions.updateAchievement}
                  onDeleteAchievement={actions.deleteAchievement}
                  onAddEffect={actions.addEffect}
                  onUpdateEffect={actions.updateEffect}
                  onDeleteEffect={actions.deleteEffect}
                />
              ))}
            </CategoryGroup>
          ))}

          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            type="button"
            onClick={() => { markDirty(); actions.addAchievement(); }}
          >
            + Achievement
          </button>
        </div>
      </DndContext>
    </div>
  );
}
