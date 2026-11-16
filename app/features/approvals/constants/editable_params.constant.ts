import type { ActionCode } from "@/shared/types/case.type";

export const ARRANGEMENT_TYPES = ["REPAYMENT_PAUSE", "REDUCED_REPAYMENTS", "TERM_EXTENSION"] as const;

export const MAX_ARRANGEMENT_MONTHS = 12;

/** Only these actions have terms a reviewer can adjust before approving. */
export const EDITABLE_ACTION_CODES: readonly ActionCode[] = ["REFUND_FEE", "HARDSHIP_REQUEST"];
