import type { AuditEvent } from "@/shared/types/case.type";
import type { BadgeTone } from "@/shared/ui/badge.component";

export const ACTOR_TYPES: readonly AuditEvent["actor_type"][] = ["AI", "STAFF", "CUSTOMER", "SYSTEM"];

export const ACTOR_TYPE_LABELS: Record<AuditEvent["actor_type"], string> = {
  AI: "AI",
  STAFF: "Staff",
  CUSTOMER: "Customer",
  SYSTEM: "System",
};

export const ACTOR_TYPE_TONES: Record<AuditEvent["actor_type"], BadgeTone> = {
  AI: "info",
  STAFF: "strong",
  CUSTOMER: "positive",
  SYSTEM: "neutral",
};

export const AUDIT_PAGE_SIZE = 150;
export const EXPLAINER_CASE_LIMIT = 200;
export const CALL_ID_PREVIEW_LENGTH = 8;
