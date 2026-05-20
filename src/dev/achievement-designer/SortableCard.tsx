import type { JSX } from "react";
import type { DesignAchievement, DesignCondition, AchievementOp } from "./types";
import styles from "./AchievementDesignerRoute.module.css";

const KNOWN_EFFECT_KINDS = [
  "paint_mastery_flat",
  "canvas_gold_pct",
  "speed_pct",
  "inspi_pct",
];

const CATEGORIES = ["canvas", "workshop", "ascension", "school_office", "secret"] as const;

const CONDITION_RE = /^(.+?)\s*(>=|<=|==|>|<)\s*(-?\d+(?:\.\d+)?)$/;

function formatCondition(c: DesignCondition): string {
  return `${c.stat} ${c.op} ${c.value}`;
}

function parseCondition(text: string): DesignCondition | null {
  const m = text.trim().match(CONDITION_RE);
  if (!m) return null;
  return { stat: m[1]!.trim(), op: m[2]! as AchievementOp, value: Number(m[3]!) };
}

function ConditionInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (text: string, parsed: DesignCondition | null) => void;
}): JSX.Element {
  const valid = parseCondition(value) !== null;
  return (
    <input
      className={`${styles.input} ${styles.inputCondition}${valid ? "" : ` ${styles.inputInvalid}`}`}
      value={value}
      placeholder="stat >= value  (e.g. lifetime.canvasesSold >= 10)"
      onChange={(e) => onChange(e.target.value, parseCondition(e.target.value))}
    />
  );
}

export interface SortableCardProps {
  ach: DesignAchievement;
  effectKindOptions: ReadonlyArray<string>;
  onMarkDirty: () => void;
  onUpdateAchievement: (id: string, patch: Partial<Omit<DesignAchievement, "effects">>) => void;
  onDeleteAchievement: (id: string) => void;
  onAddEffect: (achievementId: string) => void;
  onUpdateEffect: (achievementId: string, effectId: string, patch: Partial<{ kind: string; value: number }>) => void;
  onDeleteEffect: (achievementId: string, effectId: string) => void;
}

export function SortableCard({
  ach,
  effectKindOptions,
  onMarkDirty,
  onUpdateAchievement,
  onDeleteAchievement,
  onAddEffect,
  onUpdateEffect,
  onDeleteEffect,
}: SortableCardProps): JSX.Element {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <input
          className={`${styles.input} ${styles.inputIcon}`}
          value={ach.icon}
          placeholder="icon"
          onChange={(e) => { onMarkDirty(); onUpdateAchievement(ach.id, { icon: e.target.value }); }}
        />
        <input
          className={`${styles.input} ${styles.inputId}`}
          value={ach.id}
          placeholder="id"
          onChange={(e) => { onMarkDirty(); onUpdateAchievement(ach.id, { id: e.target.value }); }}
        />
        <input
          className={`${styles.input} ${styles.inputName}`}
          value={ach.name}
          placeholder="Name"
          onChange={(e) => { onMarkDirty(); onUpdateAchievement(ach.id, { name: e.target.value }); }}
        />
        <select
          className={styles.select}
          value={ach.category}
          onChange={(e) => { onMarkDirty(); onUpdateAchievement(ach.id, { category: e.target.value as typeof ach.category }); }}
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          className={styles.deleteBtn}
          onClick={() => { onMarkDirty(); onDeleteAchievement(ach.id); }}
          type="button"
          title="Delete achievement"
        >
          ✕
        </button>
      </div>

      <div className={styles.descRow}>
        <input
          className={`${styles.input} ${styles.inputDesc}`}
          value={ach.description}
          placeholder="Description"
          onChange={(e) => { onMarkDirty(); onUpdateAchievement(ach.id, { description: e.target.value }); }}
        />
      </div>

      <div className={styles.conditionRow}>
        <span className={styles.conditionLabel}>if</span>
        <ConditionInput
          value={ach.conditionText ?? formatCondition(ach.condition)}
          onChange={(text, parsed) => {
            onMarkDirty();
            onUpdateAchievement(ach.id, {
              conditionText: text,
              ...(parsed ? { condition: parsed } : {}),
            });
          }}
        />
      </div>

      <div className={styles.effects}>
        {ach.effects.map((effect) => {
          const isCustomKind = !KNOWN_EFFECT_KINDS.includes(effect.kind);
          return (
            <div key={effect.id} className={styles.effectRow}>
              <select
                className={styles.effectKindSelect}
                value={isCustomKind ? "__custom__" : effect.kind}
                onChange={(e) => {
                  onMarkDirty();
                  const v = e.target.value;
                  const newKind = v === "__custom__" ? "" : v;
                  onUpdateEffect(ach.id, effect.id, { kind: newKind });
                }}
              >
                {effectKindOptions.map((k) => <option key={k} value={k}>{k}</option>)}
                <option value="__custom__">custom…</option>
              </select>
              {isCustomKind && (
                <input
                  className={`${styles.input} ${styles.effectKindInput}`}
                  type="text"
                  value={effect.kind}
                  placeholder="effect kind"
                  onChange={(e) => { onMarkDirty(); onUpdateEffect(ach.id, effect.id, { kind: e.target.value }); }}
                />
              )}
              <input
                className={`${styles.input} ${styles.effectValueInput}`}
                type="number"
                step="0.01"
                value={effect.value}
                title="Value (0.15 = 15%)"
                onChange={(e) => { onMarkDirty(); onUpdateEffect(ach.id, effect.id, { value: Number(e.target.value) }); }}
              />
              <button
                className={styles.effectDelete}
                type="button"
                onClick={() => { onMarkDirty(); onDeleteEffect(ach.id, effect.id); }}
              >
                ✕
              </button>
            </div>
          );
        })}
        <button
          className={styles.addEffectBtn}
          type="button"
          onClick={() => { onMarkDirty(); onAddEffect(ach.id); }}
        >
          + effect
        </button>
      </div>
    </div>
  );
}
