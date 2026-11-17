"use client";

import { Badge } from "@/shared/ui/badge.component";
import { Tooltip } from "@/shared/ui/tooltip.component";

import { TIER_DESCRIPTIONS, TIER_NAMES, TIER_TONES } from "./status_wording.constant";

/**
 * "Tier 2 · Approve". Outside of buttons it explains the tier on hover or
 * focus; inside a clickable row pass `has_tooltip={false}` so the row stays
 * one control.
 */
export function TierBadge({ tier, has_tooltip = true }: { tier: number; has_tooltip?: boolean }) {
  const badge = (
    <Badge tone={TIER_TONES[tier] ?? "neutral"}>
      Tier {tier} · {TIER_NAMES[tier] ?? "Unknown"}
    </Badge>
  );
  if (!has_tooltip) {
    return badge;
  }
  return (
    <Tooltip content={TIER_DESCRIPTIONS[tier] ?? `Tier ${tier}`}>
      <span tabIndex={0} className="inline-flex rounded-full">
        {badge}
      </span>
    </Tooltip>
  );
}
