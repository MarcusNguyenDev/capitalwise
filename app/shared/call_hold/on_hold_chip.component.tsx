import { formatDuration, secondsBetween } from "@/shared/format/format_values.util";
import type { CallHold } from "@/shared/types/call.type";
import { Chip } from "@/shared/ui/chip.component";

import { STAFF_HOLD_REASON_LABELS } from "./call_hold_wording.constant";

interface OnHoldChipProps {
  hold: CallHold;
  current_time_ms: number | null;
  should_show_reason?: boolean;
}

/** "On hold 0:12" while the AI checks the bank's systems or waits for the customer to approve in their app. */
export function OnHoldChip({ hold, current_time_ms, should_show_reason = false }: OnHoldChipProps) {
  const hold_seconds = current_time_ms === null ? 0 : secondsBetween(hold.started_at, current_time_ms);

  return (
    <Chip tone="warning" className="animate-fade-in">
      <span className="h-2 w-2 animate-pulse rounded-full bg-warning" aria-hidden />
      On hold <span className="tabular-nums">{formatDuration(hold_seconds)}</span>
      {should_show_reason ? <span className="font-normal">· {STAFF_HOLD_REASON_LABELS[hold.reason]}</span> : null}
    </Chip>
  );
}
