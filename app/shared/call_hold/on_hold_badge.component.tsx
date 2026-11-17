import { CirclePause } from "lucide-react";

import { formatDuration, secondsBetween } from "@/shared/format/format_values.util";
import type { CallHold } from "@/shared/types/call.type";
import { Badge } from "@/shared/ui/badge.component";

import { STAFF_HOLD_REASON_LABELS } from "./call_hold_wording.constant";

interface OnHoldBadgeProps {
  hold: CallHold;
  current_time_ms: number | null;
  should_show_reason?: boolean;
}

/** "On hold 0:12" while the AI checks the bank's systems or waits for the customer to approve in their app. */
export function OnHoldBadge({ hold, current_time_ms, should_show_reason = false }: OnHoldBadgeProps) {
  const hold_seconds = current_time_ms === null ? 0 : secondsBetween(hold.started_at, current_time_ms);

  return (
    <Badge tone="attention" icon={<CirclePause className="size-3.5" aria-hidden />} className="animate-fade-in">
      On hold <span className="tabular-nums">{formatDuration(hold_seconds)}</span>
      {should_show_reason ? <span className="font-normal">· {STAFF_HOLD_REASON_LABELS[hold.reason]}</span> : null}
    </Badge>
  );
}
