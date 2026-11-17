import type { LiveCall } from "@/shared/types/call.type";
import { Badge } from "@/shared/ui/badge.component";

import { RISK_LABELS, RISK_TONES, SENTIMENT_LABELS, SENTIMENT_TONES } from "./status_wording.constant";

/**
 * Only the signals worth a glance: risk when it is not low, and mood when it
 * is not calm. Calm, low-risk calls show nothing.
 */
export function CallSignalBadges({ call }: { call: LiveCall }) {
  return (
    <>
      {call.risk_level !== "LOW" ? <Badge tone={RISK_TONES[call.risk_level]}>{RISK_LABELS[call.risk_level]}</Badge> : null}
      {call.sentiment !== "NEUTRAL" && call.sentiment !== "POSITIVE" ? (
        <Badge tone={SENTIMENT_TONES[call.sentiment]}>{SENTIMENT_LABELS[call.sentiment]}</Badge>
      ) : null}
    </>
  );
}
