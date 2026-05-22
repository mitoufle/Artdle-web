import type { JSX } from "react";
import { formatBig } from "@/core/formatter";
import { formatElapsed } from "@/core/formatElapsed";
import type { CatchupResult } from "@/systems/catchup";
import styles from "./CatchupRecapModal.module.css";

export function CatchupRecapModal({
  result,
  onContinue,
}: {
  result: CatchupResult;
  onContinue: () => void;
}): JSX.Element {
  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        <h2 className={styles.title}>You were away for {formatElapsed(result.elapsedSeconds)}</h2>
        <dl className={styles.stats}>
          <dt>Gold earned</dt><dd>+{formatBig(result.goldGained)}</dd>
          <dt>Inspiration</dt><dd>+{formatBig(result.inspiGained)}</dd>
          <dt>Canvases sold</dt><dd>{result.canvasesSold}</dd>
          <dt>Items crafted</dt><dd>{result.itemsCrafted}</dd>
          <dt>Paint mastery</dt><dd>+{formatBig(result.paintMasteryGained)}</dd>
        </dl>
        {result.achievementsUnlocked.length > 0 && (
          <div className={styles.achievements}>
            <h3>Achievements unlocked:</h3>
            <ul>
              {result.achievementsUnlocked.map((id) => <li key={id}>✦ {id}</li>)}
            </ul>
          </div>
        )}
        <button className={styles.continueBtn} onClick={onContinue}>Continue</button>
      </div>
    </div>
  );
}
