import type { CaseStatus } from "@/shared/types/case.type";
import { Badge } from "@/shared/ui/badge.component";

import { CASE_STATUS_LABELS, CASE_STATUS_TONES } from "./status_wording.constant";

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return (
    <Badge key={status} tone={CASE_STATUS_TONES[status] ?? "neutral"} className="animate-highlight">
      {CASE_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
