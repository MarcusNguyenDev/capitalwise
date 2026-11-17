import type { CaseStatus, CustomerNotification } from "@/shared/types/case.type";

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

export const AUTO_DECLINED_EXPLANATION = "Policy declined this on the call. Nothing was carried out; the customer was told why and offered a specialist review.";

/** Policy decided these on the call, so the headline says what happened rather than what was recommended. */
export const AUTO_DECIDED_HEADLINES: Partial<Record<CaseStatus, string>> = {
  AUTO_EXECUTED: "Done automatically by policy",
  AUTO_DECLINED: "Declined by policy on the call",
};

export const CUSTOMER_MESSAGE_CHANNEL_LABELS: Partial<Record<CustomerNotification["channel"], string>> = {
  SMS: "SMS sent to the customer",
  LETTER: "Letter sent to the customer",
};
