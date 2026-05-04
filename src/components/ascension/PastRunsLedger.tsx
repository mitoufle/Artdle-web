import type { JSX } from "react";
import styles from "./PastRunsLedger.module.css";

interface PastRun {
  fame: number;
  ascendedAt: number;
}

interface Props {
  runs: ReadonlyArray<PastRun>;
  totalFame: number;
}

const VISIBLE = 4;

/**
 * Renders the 4 most-recent ascends (older entries trimmed for compactness)
 * in a mono table format: "Run NN +N {date}". The total fame footer sums
 * ALL runs (not just the visible 4).
 */
export function PastRunsLedger({ runs, totalFame }: Props): JSX.Element {
  if (runs.length === 0) {
    return (
      <section className={styles.panel} aria-label="Past runs ledger">
        <div className={styles.subhead}>Past ascensions</div>
        <div className={styles.empty}>No past ascends — Step Through to begin your ledger.</div>
      </section>
    );
  }

  const startIdx = Math.max(0, runs.length - VISIBLE);
  const visible = runs.slice(startIdx);

  return (
    <section className={styles.panel} aria-label="Past runs ledger">
      <div className={styles.subhead}>Past ascensions</div>
      <ol className={styles.list} start={startIdx + 1}>
        {visible.map((run, i) => {
          const runNum = (startIdx + i + 1).toString().padStart(2, "0");
          const date = new Date(run.ascendedAt).toLocaleDateString();
          return (
            <li key={startIdx + i} className={styles.row}>
              {`Run ${runNum} +${run.fame} ${date}`}
            </li>
          );
        })}
      </ol>
      <div className={styles.footer}>
        ✦ Total · {totalFame} fame ✦
      </div>
    </section>
  );
}
