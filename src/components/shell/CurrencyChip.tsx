import type { JSX } from "react";
import styles from "./CurrencyChip.module.css";
import { Hoverable } from "@/ui/widgets/Hoverable";
import { useGameStore } from "@/store";
import { big } from "@/core/bigNumber";
import { formatBig } from "@/core/formatter";
import { inspiPerSec, pmThreshold } from "@/core/balance";
import { getInspiMultiplier, getPmMultiplier } from "@/core/multipliers";
import { TREE_STAGES } from "@/config/treeStages";

export type CurrencyKind = "gold" | "inspi" | "fame" | "pm";

interface Props {
  kind: CurrencyKind;
  label: string;
  value: string;
  rate?: string;
  dimmed?: boolean;
}

function goldBody(): JSX.Element {
  const s = useGameStore.getState();
  return (
    <>
      <div>Current: {formatBig(s.gold)}</div>
      <div>Lifetime: {formatBig(s.lifetimeGold)}</div>
    </>
  );
}

function inspiBody(): JSX.Element {
  const s = useGameStore.getState();
  const parts = TREE_STAGES.flatMap((stage) =>
    stage.parts.map((p) => ({
      level: s.partLevels[p.id] ?? 0,
      rate: p.rate,
    })),
  );
  const currentInspiPerSec = inspiPerSec(parts, getInspiMultiplier(s));
  return (
    <>
      <div>Current: {formatBig(s.inspiration)}</div>
      <div>Per second: {formatBig(currentInspiPerSec)}</div>
      <div>Ascend gate: 10,000 (current curve floors fame at 1)</div>
    </>
  );
}

function fameBody(): JSX.Element {
  const s = useGameStore.getState();
  const pastRunsTotal = s.pastRuns.reduce((acc, r) => acc + r.fame, 0);
  const lifetime = big(pastRunsTotal);
  return (
    <>
      <div>Current: {formatBig(s.fame)}</div>
      <div>Lifetime earned: {formatBig(lifetime)}</div>
      <div>Ascends: {s.ascendCount}</div>
    </>
  );
}

function pmBody(): JSX.Element {
  const s = useGameStore.getState();
  return (
    <>
      <div>Current: {formatBig(s.paintMastery)} PM</div>
      <div>Multiplier: ×{getPmMultiplier(s).toFixed(2)}</div>
      <div>Next tick at: {formatBig(pmThreshold(s.lifetimeGold))} g lifetime</div>
    </>
  );
}

const HOVER_CONTENT: Record<
  CurrencyKind,
  { title: string; body: () => JSX.Element; footer: string }
> = {
  gold: {
    title: "Gold",
    body: goldBody,
    footer: "Spent on tree upgrades and tier upgrades.",
  },
  inspi: {
    title: "Inspiration",
    body: inspiBody,
    footer: "Convert to fame via Ascend.",
  },
  fame: {
    title: "Fame",
    body: fameBody,
    footer: "Permanent currency. Spent in the constellation.",
  },
  pm: {
    title: "Paint Mastery",
    body: pmBody,
    footer: "Survives ascends. Boosts canvas gold output.",
  },
};

/**
 * Single currency chip: pixel icon + Cinzel label + mono value (+ optional rate).
 *
 * The `dimmed` prop signals "irrelevant for current route" — chip stays visible
 * but at 28% opacity + 0.4 saturation per handoff §IA. Container components
 * (e.g., BottomBar) compute dimmed-ness from the active route.
 */
export function CurrencyChip({ kind, label, value, rate, dimmed }: Props): JSX.Element {
  const content = HOVER_CONTENT[kind];
  return (
    <Hoverable
      as="div"
      title={content.title}
      body={content.body}
      footer={content.footer}
    >
      <div
        className={styles.chip}
        data-testid={`currency-chip-${kind}`}
        data-kind={kind}
        data-dimmed={dimmed ? "true" : undefined}
      >
        <span className={styles.icon} data-icon={kind} aria-hidden="true" />
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>{value}</span>
        {rate && <span className={styles.rate}>{rate}</span>}
      </div>
    </Hoverable>
  );
}
