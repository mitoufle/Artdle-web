import type { JSX } from "react";
import { useState, useCallback } from "react";
import { useAchievementDesignerState } from "./useAchievementDesignerState";
import { DevTabBar } from "../DevTabBar";
import { saveToFile } from "./api";
import { uuid } from "./storage";
import type { DesignEffect, DesignCondition, AchievementOp } from "./types";
import styles from "./AchievementDesignerRoute.module.css";

type Status = "saved" | "dirty" | "saving";

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
  return { stat: m[1].trim(), op: m[2] as AchievementOp, value: Number(m[3]) };
}

// Fully controlled. `value` is the raw text the designer typed (the source of
// truth, persisted in the design model). It never reverts on blur or re-render.
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

export function AchievementDesignerRoute(): JSX.Element {
  const { design, actions } = useAchievementDesignerState();
  const [status, setStatus] = useState<Status>("saved");

  const usedKinds = new Set(design.flatMap((a) => a.effects.map((e) => e.kind)));
  const effectKindOptions = [...new Set([...KNOWN_EFFECT_KINDS, ...usedKinds])].filter((k) => k !== "");

  const markDirty = useCallback(() => setStatus("dirty"), []);

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

      <div className={styles.content}>
        {design.map((ach, i) => (
          <div key={i} className={styles.card}>
            <div className={styles.cardHeader}>
              <input
                className={`${styles.input} ${styles.inputIcon}`}
                value={ach.icon}
                placeholder="icon"
                onChange={(e) => { markDirty(); actions.updateAchievement(ach.id, { icon: e.target.value }); }}
              />
              <input
                className={`${styles.input} ${styles.inputId}`}
                value={ach.id}
                placeholder="id"
                onChange={(e) => { markDirty(); actions.updateAchievement(ach.id, { id: e.target.value }); }}
              />
              <input
                className={`${styles.input} ${styles.inputName}`}
                value={ach.name}
                placeholder="Name"
                onChange={(e) => { markDirty(); actions.updateAchievement(ach.id, { name: e.target.value }); }}
              />
              <select
                className={styles.select}
                value={ach.category}
                onChange={(e) => { markDirty(); actions.updateAchievement(ach.id, { category: e.target.value as typeof ach.category }); }}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                className={styles.deleteBtn}
                onClick={() => { markDirty(); actions.deleteAchievement(ach.id); }}
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
                onChange={(e) => { markDirty(); actions.updateAchievement(ach.id, { description: e.target.value }); }}
              />
            </div>

            <div className={styles.conditionRow}>
              <span className={styles.conditionLabel}>if</span>
              <ConditionInput
                value={ach.conditionText ?? formatCondition(ach.condition)}
                onChange={(text, parsed) => {
                  markDirty();
                  actions.updateAchievement(ach.id, {
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
                        markDirty();
                        const v = e.target.value;
                        const newKind = v === "__custom__" ? "" : v;
                        actions.updateEffect(ach.id, effect.id, { kind: newKind });
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
                        onChange={(e) => { markDirty(); actions.updateEffect(ach.id, effect.id, { kind: e.target.value }); }}
                      />
                    )}
                    <input
                      className={`${styles.input} ${styles.effectValueInput}`}
                      type="number"
                      step="0.01"
                      value={effect.value}
                      title="Value (0.15 = 15%)"
                      onChange={(e) => { markDirty(); actions.updateEffect(ach.id, effect.id, { value: Number(e.target.value) }); }}
                    />
                    <button
                      className={styles.effectDelete}
                      type="button"
                      onClick={() => { markDirty(); actions.deleteEffect(ach.id, effect.id); }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
              <button
                className={styles.addEffectBtn}
                type="button"
                onClick={() => {
                  markDirty();
                  actions.addEffect(ach.id);
                  // Assign a stable id via uuid — addEffect in the hook does this internally
                }}
              >
                + effect
              </button>
            </div>
          </div>
        ))}

        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          type="button"
          onClick={() => { markDirty(); actions.addAchievement(); }}
        >
          + Achievement
        </button>
      </div>
    </div>
  );
}
