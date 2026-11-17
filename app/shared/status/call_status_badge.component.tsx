import type { CallStatus } from "@/shared/types/call.type";
import { Badge } from "@/shared/ui/badge.component";

import { CALL_STATUS_LABELS, CALL_STATUS_TONES } from "./status_wording.constant";

export function CallStatusBadge({ status, staff_name }: { status: CallStatus; staff_name?: string | null }) {
  return (
    <Badge tone={CALL_STATUS_TONES[status]} has_dot is_pulsing={status === "NEEDS_ATTENTION"}>
      {CALL_STATUS_LABELS[status]}
      {status === "HUMAN_ACTIVE" && staff_name ? `: ${staff_name}` : ""}
    </Badge>
  );
}
