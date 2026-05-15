import type { JSX } from "react";
import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useDesignerState } from "./useDesignerState";
import { saveToFile } from "./api";
import { validateDesign } from "./validation";
import { ActionBar, type ActionBarStatus } from "./ActionBar";
import { NodeListRail } from "./NodeListRail";
import { DesignerCanvas } from "./DesignerCanvas";
import { NodeForm } from "./NodeForm";
import { ExportModal } from "./ExportModal";
import styles from "./SkillDesignerRoute.module.css";

export function SkillDesignerRoute(): JSX.Element {
  const { design, selectedId, actions } = useDesignerState();
  const [status, setStatus] = useState<ActionBarStatus>("saved");
  const [exportOpen, setExportOpen] = useState(false);

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
      <ActionBar
        status={status}
        issueCount={issues.length}
        onSave={handleSave}
        onExport={() => setExportOpen(true)}
        onReset={actions.resetAll}
      />
      <div className={styles.devLink}>
        <Link
          to="/dev/school-designer"
          style={{ color: "#60a5fa", fontSize: 12, textDecoration: "none", padding: "4px 8px" }}
        >
          → School Designer
        </Link>
      </div>
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
