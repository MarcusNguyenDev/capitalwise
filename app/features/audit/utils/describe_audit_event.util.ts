import { formatCodeLabel } from "@/shared/format/format_values.util";
import type { AuditEvent } from "@/shared/types/case.type";

import { AUDIT_EVENT_LABELS, IDENTITY_METHOD_PHRASES, IDENTITY_RESOLUTION_PHRASES, LEVELLED_IDENTITY_EVENTS } from "../constants/audit_event_wording.constant";

/** An event type alone, for filters: "IDENTITY_LOCKED" -> "Identity locked after failed checks". */
export function describeAuditEventType(event_type: string): string {
  return AUDIT_EVENT_LABELS[event_type] ?? formatCodeLabel(event_type);
}

function readIdentityLevel(detail: Record<string, unknown>, method_phrase: string | undefined): number | null {
  if (typeof detail.level === "number") {
    return detail.level;
  }
  // The app check only ever grants level 1, and older records carry no level.
  return method_phrase === IDENTITY_METHOD_PHRASES.APP_PUSH ? 1 : null;
}

/** One event in words, using its detail where it adds meaning: "Identity confirmed by questions, level 2". */
export function describeAuditEvent(audit_event: Pick<AuditEvent, "event_type" | "detail">): string {
  const event_label = describeAuditEventType(audit_event.event_type);
  if (!LEVELLED_IDENTITY_EVENTS.includes(audit_event.event_type)) {
    return event_label;
  }
  const detail = audit_event.detail ?? {};
  const method_phrase = audit_event.event_type === "IDENTITY_VERIFIED" && typeof detail.method === "string" ? IDENTITY_METHOD_PHRASES[detail.method] : undefined;
  const identity_level = readIdentityLevel(detail, method_phrase);
  const method_part = method_phrase ? ` ${method_phrase}` : "";
  const resolution_phrase = typeof detail.resolution === "string" ? IDENTITY_RESOLUTION_PHRASES[detail.resolution] : undefined;
  const resolution_part = resolution_phrase ? ` (${resolution_phrase})` : "";
  const level_part = identity_level === null ? "" : `, level ${identity_level}`;
  return `${event_label}${method_part}${level_part}${resolution_part}`;
}
