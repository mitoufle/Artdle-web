import type { JSX } from "react";
import { useState, useCallback } from "react";
import { useSchoolDesignerState } from "./useSchoolDesignerState";
import { DevTabBar } from "../DevTabBar";
import { saveToFile } from "./api";
import { uuid } from "./storage";
import type { DesignResearchEffect } from "./types";
import styles from "./SchoolDesignerRoute.module.css";

type Status = "saved" | "dirty" | "saving";

const KNOWN_EFFECT_KINDS = [
  "canvas_gold_pct",
  "speed_pct",
  "worker_xp_pct",
  "+% inspiration gain",
  "+% Fame gain",
  "School Research flat reduction (mnt)",
  "Item min/max affix magnitude",
];

export function SchoolDesignerRoute(): JSX.Element {
  const { design, actions } = useSchoolDesignerState();
  const [status, setStatus] = useState<Status>("saved");

  const usedKinds = new Set(
    design.flatMap((t) => t.researches.flatMap((r) => r.effects.map((e) => e.kind))),
  );
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
      </div>
      <DevTabBar />

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
                      value={Math.round(research.durationSeconds / 60)}
                      min={1}
                      title="Duration (minutes)"
                      onChange={(e) => { markDirty(); actions.updateResearch(tier.tier, research.id, { durationSeconds: Number(e.target.value) * 60 }); }}
                    />
                    <span className={styles.durationLabel}>m</span>
                    <button
                      className={styles.researchDelete}
                      onClick={() => { markDirty(); actions.deleteResearch(tier.tier, research.id); }}
                      type="button"
                    >
                      ✕
                    </button>
                  </div>

                  <div className={styles.effects}>
                    {research.effects.map((effect) => {
                      const isCustomKind = !KNOWN_EFFECT_KINDS.includes(effect.kind);
                      return (
                      <div key={effect.id} className={styles.effectRow}>
                        <select
                          data-testid="effect-kind-select"
                          className={styles.effectKindInput}
                          value={isCustomKind ? "__custom__" : effect.kind}
                          onChange={(e) => {
                            markDirty();
                            const v = e.target.value;
                            const newKind = v === "__custom__" ? "" : v;
                            const newEffects: ReadonlyArray<DesignResearchEffect> = research.effects.map((ef) =>
                              ef.id === effect.id ? { ...ef, kind: newKind } : ef,
                            );
                            actions.updateResearch(tier.tier, research.id, { effects: newEffects });
                          }}
                        >
                          {effectKindOptions.map((k) => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                          <option value="__custom__">custom…</option>
                        </select>
                        {isCustomKind && (
                          <input
                            data-testid="effect-kind-custom-input"
                            className={styles.effectKindInput}
                            type="text"
                            value={effect.kind}
                            placeholder="effect kind"
                            onChange={(e) => {
                              markDirty();
                              const newEffects: ReadonlyArray<DesignResearchEffect> = research.effects.map((ef) =>
                                ef.id === effect.id ? { ...ef, kind: e.target.value } : ef,
                              );
                              actions.updateResearch(tier.tier, research.id, { effects: newEffects });
                            }}
                          />
                        )}
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
                    );})}
                    <button
                      className={styles.addEffectBtn}
                      type="button"
                      onClick={() => {
                        markDirty();
                        const newEffects: ReadonlyArray<DesignResearchEffect> = [
                          ...research.effects,
                          { id: uuid(), kind: "canvas_gold_pct", value: 0 },
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

    </div>
  );
}
