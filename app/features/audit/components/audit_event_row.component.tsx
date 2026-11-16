import { formatCodeLabel, formatDateTime, formatFactValue } from "@/shared/format/format_values.util";
import type { AuditEvent, AuditEventFilter } from "@/shared/types/case.type";
import { Chip } from "@/shared/ui/chip.component";

import { ACTOR_TYPE_TONES, CALL_ID_PREVIEW_LENGTH } from "../constants/audit_view.constant";

import { JsonBlock } from "./json_block.component";

const DETAIL_PREVIEW_ENTRY_COUNT = 3;

const FILTER_LINK_CLASS_NAME = "rounded-md border border-line px-2 py-0.5 font-mono text-sm text-ink-soft hover:border-accent hover:text-accent";

function summariseDetail(detail: Record<string, unknown>): string {
  return Object.entries(detail ?? {})
    .filter(([, value]) => value !== null && typeof value !== "object")
    .slice(0, DETAIL_PREVIEW_ENTRY_COUNT)
    .map(([key, value]) => `${key.replaceAll("_", " ")}: ${formatFactValue(value)}`)
    .join(" · ");
}

export function AuditEventRow({ audit_event, onFilter }: { audit_event: AuditEvent; onFilter: (filter_change: AuditEventFilter) => void }) {
  return (
    <li className="animate-slide-down border-t border-line first:border-t-0">
      <details className="group px-2 py-2.5">
        <summary className="grid list-none grid-cols-[4.5rem_9.5rem_15rem_16rem_1fr_auto] items-center gap-3">
          <span className="font-mono text-sm text-ink-faint">#{audit_event.event_id}</span>
          <span className="text-ink-soft">{formatDateTime(audit_event.occurred_at)}</span>
          <span className="flex items-center gap-2 truncate">
            <Chip tone={ACTOR_TYPE_TONES[audit_event.actor_type] ?? "neutral"}>{formatCodeLabel(audit_event.actor_type)}</Chip>
            <span className="truncate font-semibold">{audit_event.actor_name ?? audit_event.actor_id ?? ""}</span>
          </span>
          <span className="font-mono font-semibold">{audit_event.event_type}</span>
          <span className="truncate text-ink-soft">{summariseDetail(audit_event.detail)}</span>
          <span className="flex items-center gap-2">
            {audit_event.case_number ? (
              <button
                type="button"
                className={FILTER_LINK_CLASS_NAME}
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
            <span className="text-ink-faint transition-transform group-open:rotate-90">›</span>
          </span>
        </summary>
        <div className="mt-2 pl-[4.5rem]">
          <JsonBlock value={audit_event.detail} />
        </div>
      </details>
    </li>
  );
}
