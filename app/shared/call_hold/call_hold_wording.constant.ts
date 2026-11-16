import type { CallHoldReason } from "@/shared/types/call.type";

export const STAFF_HOLD_REASON_LABELS: Record<CallHoldReason, string> = {
  CHECKING_SYSTEM: "Checking the system",
  WAITING_FOR_APP_APPROVAL: "Waiting for app approval",
};

export const CUSTOMER_HOLD_REASON_LABELS: Record<CallHoldReason, string> = {
  CHECKING_SYSTEM: "Checking the system",
  WAITING_FOR_APP_APPROVAL: "Waiting for you to approve in your banking app",
};
