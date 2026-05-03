import type { JSX } from "react";
import { useGameStore } from "@/store";
import { tierUpgradeCost, MAX_TIER, canvasGold, canvasTime, pmGainPerSale, pmThreshold } from "@/core/balance";
import { formatBig } from "@/core/formatter";
import { Hoverable } from "@/ui/widgets/Hoverable";
import { getCanvasGoldMultiplier, getPmMultiplier } from "@/core/multipliers";

/**
 * Inline tier-upgrade button on PaintingView.
 *
 * - At tier < MAX_TIER: label = "⬆ Tier {N+1} — {cost} g"; disabled when gold < cost.
 * - At tier === MAX_TIER: label = "Tier MAX"; always disabled.
 *
 * Hover (factory bodies) shows current tier's gold/sale, time/sale, pm/sale,
 * and the deltas vs next tier.
 */
export function TierUpgradeButton(): JSX.Element {
  const tier = useGameStore((s) => s.canvasTier);
  const gold = useGameStore((s) => s.gold);
  const upgradeTier = useGameStore((s) => s.upgradeTier);

  const isMax = tier >= MAX_TIER;
  const cost = isMax ? null : tierUpgradeCost(tier);
  const insufficient = cost !== null && gold.lt(cost);
  const disabled = isMax || insufficient;

  const label = isMax
    ? "Tier MAX"
    : `⬆ Tier ${tier + 1} — ${formatBig(cost!)} g`;

  const title = isMax ? "Maximum tier reached" : "Upgrade canvas tier";

  return (
    <Hoverable
      title={title}
      body={() => {
        const s = useGameStore.getState();
        const t = s.canvasTier;
        const goldMult = getCanvasGoldMultiplier(s) * getPmMultiplier(s);
        const curGold = canvasGold(t, goldMult);
        const curTime = canvasTime(t);
        const curPm = pmGainPerSale(curGold, s.lifetimeGold);
        const threshold = pmThreshold(s.lifetimeGold);

        if (t >= MAX_TIER) {
          return `Canvas at tier ${MAX_TIER}. No further upgrades in v1.1.\nCurrent: ${formatBig(curGold)} g/sale, ${curTime}s/sale, ${formatBig(curPm)} PM/sale (threshold: 1 PM per ${formatBig(threshold)} g).`;
        }

        const nextGold = canvasGold(t + 1, goldMult);
        const nextTime = canvasTime(t + 1);
        const nextPm = pmGainPerSale(nextGold, s.lifetimeGold);
        return [
          `Current tier ${t}: ${formatBig(curGold)} g/sale, ${curTime}s/sale, ${formatBig(curPm)} PM/sale.`,
          `Next tier ${t + 1}: ${formatBig(nextGold)} g/sale, ${nextTime}s/sale, ${formatBig(nextPm)} PM/sale.`,
          `PM threshold: 1 PM per ${formatBig(threshold)} g.`,
        ].join("\n");
      }}
      footer={() => (isMax ? "" : `Cost: ${formatBig(cost!)} g`)}
    >
      <button
        type="button"
        onClick={upgradeTier}
        disabled={disabled}
        data-testid="tier-upgrade-button"
      >
        {label}
      </button>
    </Hoverable>
  );
}
