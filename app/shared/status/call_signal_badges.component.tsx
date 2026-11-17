import { BadgeCheck } from "lucide-react";

import type { LiveCall } from "@/shared/types/call.type";
import { Badge } from "@/shared/ui/badge.component";

import { RISK_LABELS, RISK_TONES, SENTIMENT_LABELS, SENTIMENT_TONES } from "./status_wording.constant";

/**
 * Only the signals worth a glance: risk when it is not low, mood when it is
 * not calm, and identity once verified. Calm, low-risk calls show nothing.
 */
export function CallSignalBadges({ call, should_show_identity = false }: { call: LiveCall; should_show_identity?: boolean }) {
  return (
    <>
      {call.risk_level !== "LOW" ? <Badge tone={RISK_TONES[call.risk_level]}>{RISK_LABELS[call.risk_level]}</Badge> : null}
      {call.sentiment !== "NEUTRAL" && call.sentiment !== "POSITIVE" ? (
        <Badge tone={SENTIMENT_TONES[call.sentiment]}>{SENTIMENT_LABELS[call.sentiment]}</Badge>
      ) : null}
      {should_show_identity ? (
        call.identity_verified ? (
          <Badge tone="positive" icon={<BadgeCheck className="size-3.5" aria-hidden />}>
            Identity verified
          </Badge>
        ) : (
          <Badge>Not verified yet</Badge>
        )
      ) : null}
    </>
  );
}
