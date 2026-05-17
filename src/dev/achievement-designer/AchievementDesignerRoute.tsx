import type { JSX } from "react";
import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAchievementDesignerState } from "./useAchievementDesignerState";
import { saveToFile } from "./api";
import { uuid } from "./storage";
import type { DesignEffect } from "./types";
import styles from "./AchievementDesignerRoute.module.css";

type Status = "saved" | "dirty" | "saving";

const KNOWN_EFFECT_KINDS = [
  "paint_mastery_flat",
  "canvas_gold_pct",
  "speed_pct",
  "inspi_pct",
];

const KNOWN_STATS = [
  "lifetime.canvasesSold",
  "lifetime.critsLanded",
  "lifetime.maxComboChain",
  "lifetime.workshopItemsCrafted",
  "lifetime.workshopItemsFused",
  "lifetime.schoolResearchesCompleted",
  "lifetime.schoolTiersPassed",
  "lifetime.officeWorkersHired",
  "lifetime.goldEarned",
  "lifetime.ascensions",
  "run.canvasesSold",
  "run.critsLanded",
  "run.currentCritStreak",
  "run.maxCritStreak",
  "run.maxComboChain",
  "run.goldEarned",
  "run.workshopItemsCrafted",
  "run.schoolResearchesCompleted",
];

const CATEGORIES = ["canvas", "workshop", "ascension", "school_office", "secret"] as const;
const OPS = [">=", ">", "==", "<=", "<"] as const;

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
        <Link className={styles.link} to="/dev/school-designer">→ School</Link>
        <Link className={styles.link} to="/tree">← Game</Link>
      </div>

      <div className={styles.content}>
        {design.map((ach) => (
          <div key={ach.id} className={styles.card}>
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
              <select
                className={`${styles.select} ${styles.selectStat}`}
                value={ach.condition.stat}
                onChange={(e) => { markDirty(); actions.updateAchievement(ach.id, { condition: { ...ach.condition, stat: e.target.value } }); }}
              >
                {KNOWN_STATS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                className={`${styles.select} ${styles.selectOp}`}
                value={ach.condition.op}
                onChange={(e) => { markDirty(); actions.updateAchievement(ach.id, { condition: { ...ach.condition, op: e.target.value as typeof ach.condition.op } }); }}
              >
                {OPS.map((op) => <option key={op} value={op}>{op}</option>)}
              </select>
              <input
                className={`${styles.input} ${styles.inputNum}`}
                type="number"
                value={ach.condition.value}
                onChange={(e) => { markDirty(); actions.updateAchievement(ach.id, { condition: { ...ach.condition, value: Number(e.target.value) } }); }}
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
