import type { JSX } from "react";
import { useEffect, useState } from "react";
import { useGameStore, SAVE_VERSION } from "@/store";
import {
  buildBugReport,
  issueBody,
  issueTitle,
  type BugReportContext,
} from "@/core/bugReport";
import styles from "./BugReportModal.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Status = "idle" | "submitting" | "success" | "error";

function captureContext(): BugReportContext {
  const s = useGameStore.getState();
  return {
    timestamp: new Date().toISOString(),
    route: window.location.pathname,
    userAgent: navigator.userAgent,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    mode: import.meta.env.MODE,
    playerId: s.playerId,
    saveVersion: SAVE_VERSION,
    gold: s.gold.toString(),
    inspiration: s.inspiration.toString(),
    fame: s.fame.toString(),
  };
}

export function BugReportModal({ open, onClose }: Props): JSX.Element | null {
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Reset transient state whenever the modal is freshly opened.
  useEffect(() => {
    if (open) {
      setStatus("idle");
      setResultUrl(null);
    }
  }, [open]);

  if (!open) return null;

  const canSubmit = description.trim().length > 0 && status !== "submitting";

  async function handleSubmit(): Promise<void> {
    setStatus("submitting");
    try {
      const report = buildBugReport({ description, context: captureContext() });
      const res = await fetch("/api/report-bug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: issueTitle(report), body: issueBody(report) }),
      });
      const data = (await res.json()) as { ok?: boolean; url?: string };
      if (res.ok && data.ok && data.url) {
        setResultUrl(data.url);
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Report a bug"
      onClick={onClose}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>Report a bug</h3>

        {status === "success" ? (
          <div className={styles.successBox}>
            <p>Thanks! Your report was submitted.</p>
            {resultUrl && (
              <a href={resultUrl} target="_blank" rel="noreferrer" className={styles.link}>
                {resultUrl}
              </a>
            )}
            <div className={styles.footer}>
              <button type="button" className={styles.secondaryBtn} onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <label className={styles.label}>
              <span className={styles.labelText}>What went wrong?</span>
              <textarea
                className={styles.textarea}
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the bug and what you were doing…"
                autoFocus
              />
            </label>

            <details className={styles.details}>
              <summary className={styles.summary}>What's included</summary>
              <pre className={styles.context}>
                {JSON.stringify(captureContext(), null, 2)}
              </pre>
            </details>

            {status === "error" && (
              <p className={styles.error}>Couldn&apos;t submit — please try again.</p>
            )}

            <div className={styles.footer}>
              <button type="button" className={styles.secondaryBtn} onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
              >
                {status === "submitting" ? "Submitting…" : "Submit"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
