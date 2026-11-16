import type { CaseStatus } from "@/shared/types/case.type";

export const AWAITING_DECISION_STATUSES: readonly CaseStatus[] = ["PENDING_APPROVAL", "ESCALATED"];

/** How long a decided case stays visible in the queue with its outcome. */
export const OUTCOME_VISIBLE_MS = 12000;

export const SLA_URGENT_SECONDS = 15 * 60;

export const DEFAULT_APPROVE_REASON_CODE = "MEETS_POLICY";
export const DEFAULT_EDIT_REASON_CODE = "ADJUSTED_TERMS";

export const DECISION_LABELS: Record<string, string> = {
  APPROVED: "Approved",
  EDITED_AND_APPROVED: "Edited and approved",
  REJECTED: "Rejected",
};
