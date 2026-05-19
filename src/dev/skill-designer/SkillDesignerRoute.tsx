import type { JSX } from "react";
import { useState, useCallback } from "react";
import { useDesignerState } from "./useDesignerState";
import { DevTabBar } from "../DevTabBar";
import { saveToFile } from "./api";
import { validateDesign } from "./validation";
import { NodeListRail } from "./NodeListRail";
import { DesignerCanvas } from "./DesignerCanvas";
import { NodeForm } from "./NodeForm";
import { ExportModal } from "./ExportModal";
import styles from "./SkillDesignerRoute.module.css";

type Status = "saved" | "dirty" | "saving";

export function SkillDesignerRoute(): JSX.Element {
  const { design, selectedId, actions } = useDesignerState();
  const [status, setStatus] = useState<Status>("saved");
  const [exportOpen, setExportOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const issues = validateDesign(design.nodes);
  const selectedNode =
    selectedId !== null ? design.nodes.find((n) => n.id === selectedId) ?? null : null;

  const handleSave = useCallback(async () => {
    setStatus("saving");
    const designToSave = {
      ...design,
      designedAt: new Date().toISOString(),
    };
    const result = await saveToFile(designToSave);
    setStatus(result.ok ? "saved" : "dirty");
  }, [design]);

  const handleMove = useCallback(
    (id: string, position: { x: number; y: number }) => {
      actions.updateNode(id, { position });
      setStatus("dirty");
    },
    [actions],
  );

  const wrapAction = useCallback(<T extends (...args: never[]) => unknown>(fn: T): T => {
    return ((...args: Parameters<T>) => {
      setStatus("dirty");
      return fn(...args);
    }) as T;
  }, []);

  return (
    <div className={styles.layout}>
      <div className={styles.topBar}>
        <span className={styles.title}>Skill Designer</span>
        <span className={
          status === "saved" ? styles.statusSaved :
          status === "saving" ? styles.statusSaving :
          styles.statusDirty
        }>
          {status === "saved" ? "Saved" : status === "saving" ? "Saving…" : "Unsaved changes"}
        </span>
        {issues.length > 0 && (
          <span className={styles.issues}>⚠ {issues.length} issue{issues.length === 1 ? "" : "s"}</span>
        )}
        <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={handleSave}>
          Save to file
        </button>
        <button className={styles.btn} type="button" onClick={() => setExportOpen(true)}>
          Export JSON
        </button>
        {confirming ? (
          <>
            <span className={styles.confirmPrompt}>Discard changes and reload from file?</span>
            <button className={styles.btnDanger} type="button" onClick={() => { setConfirming(false); actions.resetAll(); setStatus("saved"); }}>
              Yes, reset
            </button>
            <button className={styles.btn} type="button" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className={styles.btn} type="button" onClick={() => setConfirming(true)}>
            Reset
          </button>
        )}
      </div>
      <DevTabBar />
      <div className={styles.panes}>
        <NodeListRail
          nodes={design.nodes}
          selectedId={selectedId}
          onSelect={actions.selectNode}
          onAdd={wrapAction(actions.addNode)}
        />
        <DesignerCanvas
          nodes={design.nodes}
          selectedId={selectedId}
          onSelect={actions.selectNode}
          onMove={handleMove}
        />
        <NodeForm
          node={selectedNode}
          allNodes={design.nodes}
          onChange={wrapAction(actions.updateNode)}
          onDelete={wrapAction(actions.deleteNode)}
        />
      </div>
      <ExportModal open={exportOpen} design={design} onClose={() => setExportOpen(false)} />
    </div>
  );
}
