import type { AuditEvent } from "@/shared/types/case.type";
import type { ChipTone } from "@/shared/ui/chip.component";

export const AUDIT_TABS = [
  { key: "AUDIT_LOG", label: "Audit log" },
  { key: "DECISION_EXPLAINER", label: "Decision explainer" },
  { key: "CALL_REPLAY", label: "Call replay" },
] as const;

export type AuditTabKey = (typeof AUDIT_TABS)[number]["key"];

export const ACTOR_TYPES: readonly AuditEvent["actor_type"][] = ["AI", "STAFF", "CUSTOMER", "SYSTEM"];

export const ACTOR_TYPE_TONES: Record<AuditEvent["actor_type"], ChipTone> = {
  AI: "info",
  STAFF: "accent",
  CUSTOMER: "positive",
  SYSTEM: "neutral",
};

export const AUDIT_PAGE_SIZE = 150;
export const EXPLAINER_CASE_LIMIT = 200;
export const CALL_ID_PREVIEW_LENGTH = 8;
