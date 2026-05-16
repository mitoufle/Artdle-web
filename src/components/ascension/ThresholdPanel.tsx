import type { JSX } from "react";
import { Hoverable } from "@/ui/widgets/Hoverable";
import { CurrencyAmount } from "@/ui/widgets/CurrencyAmount";
import styles from "./ThresholdPanel.module.css";

interface Props {
  currentInspi: string;
}

const THRESHOLD_HOVER_BODY = (
  <>
    <div>9,999     → 0 (blocked)</div>
    <div>10,000    → 1</div>
    <div>100,000   → 3</div>
    <div>1,000,000 → 102</div>
    <div>1B        → 10,000</div>
  </>
);

/**
 * Right-rail readout of the current inspiration. There is no fixed palier;
 * players ascend whenever they want and the fame formula determines reward.
 */
export function ThresholdPanel({ currentInspi }: Props): JSX.Element {
  return (
    <Hoverable
      as="div"
      title="Inspiration → Fame"
      body={THRESHOLD_HOVER_BODY}
      footer="max(1, ⌊(log₁₀(inspi)−4)⁵ × 3.2⌋) above the 10k gate."
    >
      <section
        className={styles.panel}
        aria-label="Inspiration"
        data-testid="threshold-panel"
      >
        <div className={styles.subhead}>Current inspiration</div>
        <div className={styles.value}>
          <CurrencyAmount kind="inspi" value={currentInspi} size={24} />
        </div>
      </section>
    </Hoverable>
  );
}
