import type { JSX } from "react";
import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useSchoolDesignerState } from "./useSchoolDesignerState";
import { saveToFile } from "./api";
import type { DesignResearchEffect } from "./types";
import styles from "./SchoolDesignerRoute.module.css";

type Status = "saved" | "dirty" | "saving";

const KNOWN_EFFECT_KINDS = [
  "canvas_gold_pct",
  "speed_pct",
  "worker_xp_pct",
];

export function SchoolDesignerRoute(): JSX.Element {
  const { design, actions } = useSchoolDesignerState();
  const [status, setStatus] = useState<Status>("saved");

  const markDirty = useCallback(() => setStatus("dirty"), []);

  const handleSave = useCallback(async () => {
    setStatus("saving");
    const result = await saveToFile(design);
    setStatus(result.ok ? "saved" : "dirty");
  }, [design]);

  return (
    <div className={styles.layout}>
      <div className={styles.topBar}>
        <span className={styles.title}>School Designer</span>
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
        <Link className={styles.link} to="/dev/skill-designer">→ Skill Designer</Link>
      </div>

      <div className={styles.content}>
        {design.map((tier) => (
          <div key={tier.tier} className={styles.tier}>
            <div className={styles.tierHeader}>
              <span className={styles.tierLabel}>Tier {tier.tier}</span>
              <input
                className={styles.tierInput}
                value={tier.label}
                placeholder="Label"
                onChange={(e) => { markDirty(); actions.updateTier(tier.tier, { label: e.target.value }); }}
              />
              <input
                className={`${styles.tierInput} ${styles.examCostInput}`}
                type="number"
                value={tier.examCost}
                min={0}
                title="Exam cost (fame)"
                onChange={(e) => { markDirty(); actions.updateTier(tier.tier, { examCost: Number(e.target.value) }); }}
              />
              <span className={styles.examLabel}>⭐ exam</span>
              <button
                className={styles.tierDelete}
                onClick={() => { markDirty(); actions.deleteTier(tier.tier); }}
                type="button"
                title="Delete tier"
              >
                ✕ tier
              </button>
            </div>

            <div className={styles.researches}>
              {tier.researches.map((research, ri) => (
                <div key={`${tier.tier}_${ri}`} className={styles.research}>
                  <div className={styles.researchRow}>
                    <input
                      className={`${styles.researchInput} ${styles.researchIdInput}`}
                      value={research.id}
                      placeholder="id"
                      onChange={(e) => { markDirty(); actions.updateResearch(tier.tier, research.id, { id: e.target.value }); }}
                    />
                    <input
                      className={`${styles.researchInput} ${styles.researchNameInput}`}
                      value={research.name}
                      placeholder="Name"
                      onChange={(e) => { markDirty(); actions.updateResearch(tier.tier, research.id, { name: e.target.value }); }}
                    />
                    <input
                      className={`${styles.researchInput} ${styles.durationInput}`}
                      type="number"
                      value={research.durationSeconds}
                      min={1}
                      title="Duration (seconds)"
                      onChange={(e) => { markDirty(); actions.updateResearch(tier.tier, research.id, { durationSeconds: Number(e.target.value) }); }}
                    />
                    <span className={styles.durationLabel}>s</span>
                    <button
                      className={styles.researchDelete}
                      onClick={() => { markDirty(); actions.deleteResearch(tier.tier, research.id); }}
                      type="button"
                    >
                      ✕
                    </button>
                  </div>

                  <div className={styles.effects}>
                    {research.effects.map((effect) => (
                      <div key={effect.id} className={styles.effectRow}>
                        <input
                          className={styles.effectKindInput}
                          list="effect-kinds"
                          value={effect.kind}
                          placeholder="kind (e.g. canvas_gold_pct)"
                          onChange={(e) => {
                            markDirty();
                            const newEffects: ReadonlyArray<DesignResearchEffect> = research.effects.map((ef) =>
                              ef.id === effect.id ? { ...ef, kind: e.target.value } : ef,
                            );
                            actions.updateResearch(tier.tier, research.id, { effects: newEffects });
                          }}
                        />
                        <input
                          className={styles.effectValueInput}
                          type="number"
                          step="0.01"
                          min={0}
                          value={effect.value}
                          title="Fractional value (0.15 = 15%)"
                          onChange={(e) => {
                            markDirty();
                            const newEffects: ReadonlyArray<DesignResearchEffect> = research.effects.map((ef) =>
                              ef.id === effect.id ? { ...ef, value: Number(e.target.value) } : ef,
                            );
                            actions.updateResearch(tier.tier, research.id, { effects: newEffects });
                          }}
                        />
                        <button
                          className={styles.effectDelete}
                          type="button"
                          onClick={() => {
                            markDirty();
                            const newEffects = research.effects.filter((ef) => ef.id !== effect.id);
                            actions.updateResearch(tier.tier, research.id, { effects: newEffects });
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      className={styles.addEffectBtn}
                      type="button"
                      onClick={() => {
                        markDirty();
                        const newEffects: ReadonlyArray<DesignResearchEffect> = [
                          ...research.effects,
                          { id: crypto.randomUUID(), kind: "canvas_gold_pct", value: 0 },
                        ];
                        actions.updateResearch(tier.tier, research.id, { effects: newEffects });
                      }}
                    >
                      + effect
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              className={styles.btn}
              type="button"
              onClick={() => { markDirty(); actions.addResearch(tier.tier); }}
            >
              + Research
            </button>
          </div>
        ))}

        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          type="button"
          onClick={() => { markDirty(); actions.addTier(); }}
        >
          + Tier
        </button>
      </div>

      <datalist id="effect-kinds">
        {KNOWN_EFFECT_KINDS.map((k) => <option key={k} value={k} />)}
      </datalist>
    </div>
  );
}
