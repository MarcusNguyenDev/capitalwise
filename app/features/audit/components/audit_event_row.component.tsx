import { ChevronRight } from "lucide-react";

import { formatCodeLabel, formatDateTime, formatFactValue } from "@/shared/format/format_values.util";
import type { AuditEvent, AuditEventFilter } from "@/shared/types/case.type";
import { Badge } from "@/shared/ui/badge.component";
import { JsonView } from "@/shared/ui/json_view.component";

import { ACTOR_TYPE_LABELS, ACTOR_TYPE_TONES, CALL_ID_PREVIEW_LENGTH } from "../constants/audit_view.constant";

const DETAIL_PREVIEW_ENTRY_COUNT = 3;
const FILTER_LINK_CLASS_NAME = "rounded px-1.5 py-0.5 font-mono text-xs text-info hover:bg-info-soft";

function summariseDetail(detail: Record<string, unknown>): string {
  return Object.entries(detail ?? {})
    .filter(([, value]) => value !== null && typeof value !== "object")
    .slice(0, DETAIL_PREVIEW_ENTRY_COUNT)
    .map(([key, value]) => `${key.replaceAll("_", " ")}: ${formatFactValue(value)}`)
    .join(" · ");
}

/** One record: when, who, what happened, and links to narrow the log to its call or case. Raw detail on expand. */
export function AuditEventRow({ audit_event, onFilter }: { audit_event: AuditEvent; onFilter: (filter_change: AuditEventFilter) => void }) {
  return (
    <li className="animate-fade-in border-b border-line">
      <details className="group">
        <summary className="grid list-none grid-cols-[1rem_8.5rem_minmax(9rem,13rem)_minmax(9rem,14rem)_1fr] items-center gap-3 px-6 py-2.5 text-sm hover:bg-canvas max-xl:grid-cols-[1rem_8.5rem_1fr]">
          <ChevronRight className="size-4 text-ink-faint transition-transform group-open:rotate-90" aria-hidden />
          <span className="tabular-nums text-ink-soft">{formatDateTime(audit_event.occurred_at)}</span>
          <span className="flex min-w-0 items-center gap-2">
            <Badge tone={ACTOR_TYPE_TONES[audit_event.actor_type] ?? "neutral"}>{ACTOR_TYPE_LABELS[audit_event.actor_type] ?? audit_event.actor_type}</Badge>
            <span className="truncate">{audit_event.actor_name ?? audit_event.actor_id ?? ""}</span>
          </span>
          <span className="min-w-0 max-xl:col-start-3">
            <span className="block truncate font-medium">{formatCodeLabel(audit_event.event_type)}</span>
          </span>
          <span className="flex min-w-0 items-center justify-end gap-2 max-xl:col-start-3 max-xl:justify-start">
            <span className="min-w-0 flex-1 truncate text-ink-faint">{summariseDetail(audit_event.detail)}</span>
            {audit_event.case_number ? (
              <button
                type="button"
                className={FILTER_LINK_CLASS_NAME}
                title="Show only this case"
                onClick={(click_event) => {
                  click_event.preventDefault();
                  onFilter({ case_number: audit_event.case_number ?? undefined });
                }}
              >
                {audit_event.case_number}
              </button>
            ) : null}
            {audit_event.call_id ? (
              <button
                type="button"
                className={FILTER_LINK_CLASS_NAME}
                title="Show only this call"
                onClick={(click_event) => {
                  click_event.preventDefault();
                  onFilter({ call_id: audit_event.call_id ?? undefined });
                }}
              >
                call {audit_event.call_id.slice(0, CALL_ID_PREVIEW_LENGTH)}
              </button>
            ) : null}
          </span>
        </summary>
        <div className="flex flex-col gap-1 bg-canvas px-6 pb-3 pl-[2.75rem] pt-1 text-xs text-ink-faint">
          <p>
            Record #{audit_event.event_id} · event code <code className="font-mono">{audit_event.event_type}</code>
          </p>
          <JsonView value={audit_event.detail} />
        </div>
      </details>
    </li>
  );
}
