import type { JSX } from "react";
import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useGameStore } from "@/store";
import { ACHIEVEMENTS, type Achievement, type AchievementCategory } from "@/config/achievementConfig";
import { big } from "@/core/bigNumber";
import { saveToFile } from "./api";
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

const CATEGORIES: AchievementCategory[] = ["canvas", "workshop", "ascension", "school_office", "secret"];

let _idCounter = Date.now();
const uid = () => `a_${(_idCounter++).toString(36)}`;

function defaultAchievement(): Achievement {
  return {
    id: uid(),
    name: "New Achievement",
    description: "",
    icon: "⭐",
    category: "canvas",
    condition: { stat: "lifetime.canvasesSold", op: ">=", value: 1 },
    effects: [],
  };
}

export function AchievementDesignerRoute(): JSX.Element {
  const [design, setDesign] = useState<Achievement[]>(() => [...ACHIEVEMENTS] as Achievement[]);
  const [selected, setSelected] = useState<string | null>(design[0]?.id ?? null);
  const [status, setStatus] = useState<Status>("saved");

  const selectedAch = design.find((a) => a.id === selected) ?? null;

  const markDirty = useCallback(() => setStatus("dirty"), []);

  const update = useCallback((id: string, patch: Partial<Achievement>) => {
    setDesign((prev) => prev.map((a) => a.id === id ? { ...a, ...patch } : a));
    markDirty();
  }, [markDirty]);

  const handleSave = useCallback(async () => {
    setStatus("saving");
    const result = await saveToFile(design);
    setStatus(result.ok ? "saved" : "dirty");
  }, [design]);

  const handleTestFire = useCallback(() => {
    if (!selectedAch) return;
    const state = useGameStore.getState();
    if (!state.completedAchievements[selectedAch.id]) {
      const pmGain = selectedAch.effects
        .filter((e) => e.kind === "paint_mastery_flat")
        .reduce((sum, e) => sum + e.value, 0);
      state.addPaintMastery(big(pmGain));
      useGameStore.setState((s) => ({
        completedAchievements: { ...s.completedAchievements, [selectedAch.id]: true as const },
        notificationQueue: [...s.notificationQueue, { id: selectedAch.id, name: selectedAch.name, icon: selectedAch.icon, effects: selectedAch.effects }],
      }));
      if (!useGameStore.getState().activeNotification) {
        useGameStore.getState().advanceNotification();
      }
    }
  }, [selectedAch]);

  const liveStatValue = selectedAch
    ? (() => {
        const storeState = useGameStore.getState();
        const stat = selectedAch.condition.stat;
        if (stat === "lifetime.goldEarned") return storeState.lifetimeGold.toNumber();
        if (stat === "lifetime.ascensions") return storeState.ascendCount;
        if (stat.startsWith("lifetime.")) return (storeState.statsLifetime as Record<string, number>)[stat.slice(9)] ?? 0;
        if (stat.startsWith("run.")) {
          const v = (storeState.statsRun as Record<string, unknown>)[stat.slice(4)] ?? 0;
          return typeof v === "number" ? v : (v as { toNumber(): number }).toNumber();
        }
        return 0;
      })()
    : null;

  return (
    <div className={styles.layout}>
      <div className={styles.topBar}>
        <span className={styles.title}>Achievement Designer</span>
        <span className={status === "saved" ? styles.statusSaved : status === "saving" ? styles.statusSaving : styles.statusDirty}>
          {status === "saved" ? "Saved" : status === "saving" ? "Saving…" : "Unsaved changes"}
        </span>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave}>Save to file</button>
        <Link className={styles.link} to="/dev/school-designer">→ School Designer</Link>
        <Link className={styles.link} to="/tree">← Game</Link>
      </div>

      <div className={styles.content}>
        <aside className={styles.rail}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => {
            const a = defaultAchievement();
            setDesign((prev) => [...prev, a]);
            setSelected(a.id);
            markDirty();
          }}>+ New Achievement</button>
          <div className={styles.list}>
            {design.map((a) => (
              <button
                key={a.id}
                type="button"
                className={selected === a.id ? `${styles.listItem} ${styles.listItemActive}` : styles.listItem}
                onClick={() => setSelected(a.id)}
              >
                {a.icon} {a.name}
              </button>
            ))}
          </div>
        </aside>

        <main className={styles.form}>
          {!selectedAch ? (
            <p className={styles.empty}>Select an achievement to edit.</p>
          ) : (
            <>
              <div className={styles.row}>
                <label className={styles.label}>ID</label>
                <input className={styles.input} value={selectedAch.id} onChange={(e) => update(selectedAch.id, { id: e.target.value })} />
              </div>
              <div className={styles.row}>
                <label className={styles.label}>Name</label>
                <input className={styles.input} value={selectedAch.name} onChange={(e) => update(selectedAch.id, { name: e.target.value })} />
              </div>
              <div className={styles.row}>
                <label className={styles.label}>Description</label>
                <input className={styles.input} value={selectedAch.description} onChange={(e) => update(selectedAch.id, { description: e.target.value })} />
              </div>
              <div className={styles.row}>
                <label className={styles.label}>Icon</label>
                <input className={styles.iconInput} value={selectedAch.icon} onChange={(e) => update(selectedAch.id, { icon: e.target.value })} />
              </div>
              <div className={styles.row}>
                <label className={styles.label}>Category</label>
                <select className={styles.select} value={selectedAch.category} onChange={(e) => update(selectedAch.id, { category: e.target.value as AchievementCategory })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>Condition</legend>
                <div className={styles.conditionRow}>
                  <select className={styles.select} value={selectedAch.condition.stat} onChange={(e) => update(selectedAch.id, { condition: { ...selectedAch.condition, stat: e.target.value } })}>
                    {KNOWN_STATS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select className={styles.opSelect} value={selectedAch.condition.op} onChange={(e) => update(selectedAch.id, { condition: { ...selectedAch.condition, op: e.target.value as ">=" } })}>
                    {[">=", ">", "==", "<=", "<"].map((op) => <option key={op} value={op}>{op}</option>)}
                  </select>
                  <input className={styles.numInput} type="number" value={selectedAch.condition.value} onChange={(e) => update(selectedAch.id, { condition: { ...selectedAch.condition, value: Number(e.target.value) } })} />
                  {liveStatValue !== null && (
                    <span className={styles.liveValue}>current: {liveStatValue}</span>
                  )}
                </div>
              </fieldset>

              <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>Effects</legend>
                {selectedAch.effects.map((effect, i) => (
                  <div key={i} className={styles.effectRow}>
                    <select className={styles.select} value={effect.kind} onChange={(e) => {
                      const newEffects = selectedAch.effects.map((ef, j) => j === i ? { ...ef, kind: e.target.value } : ef);
                      update(selectedAch.id, { effects: newEffects });
                    }}>
                      {KNOWN_EFFECT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <input className={styles.numInput} type="number" step="0.01" value={effect.value} onChange={(e) => {
                      const newEffects = selectedAch.effects.map((ef, j) => j === i ? { ...ef, value: Number(e.target.value) } : ef);
                      update(selectedAch.id, { effects: newEffects });
                    }} />
                    <button type="button" className={styles.deleteBtn} onClick={() => {
                      update(selectedAch.id, { effects: selectedAch.effects.filter((_, j) => j !== i) });
                    }}>&times;</button>
                  </div>
                ))}
                <button type="button" className={styles.btn} onClick={() => {
                  update(selectedAch.id, { effects: [...selectedAch.effects, { kind: "canvas_gold_pct", value: 0 }] });
                }}>+ Effect</button>
              </fieldset>

              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={handleTestFire}>
                Test Fire
              </button>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
