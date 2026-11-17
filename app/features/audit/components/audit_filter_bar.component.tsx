import { Search, X } from "lucide-react";

import type { AuditEventFilter } from "@/shared/types/case.type";
import type { Workforce } from "@/shared/types/resources.type";
import { Button } from "@/shared/ui/button.component";

import { ACTOR_TYPE_LABELS, ACTOR_TYPES, CALL_ID_PREVIEW_LENGTH } from "../constants/audit_view.constant";
import { describeAuditEventType } from "../utils/describe_audit_event.util";

const SELECT_CLASS_NAME = "h-9 rounded-md border border-line-strong bg-white px-2.5 text-sm";

interface AuditFilterBarProps {
  event_filter: AuditEventFilter;
  event_types: string[];
  workforce: Workforce | null;
  has_filter: boolean;
  onChange: (filter_change: AuditEventFilter) => void;
  onClear: () => void;
}

function listActorOptions(workforce: Workforce | null): { value: string; label: string }[] {
  const staff_options = (workforce?.staff ?? []).map((staff_member) => ({ value: staff_member.staff_id, label: staff_member.name }));
  const agent_options = (workforce?.ai_agents ?? []).map((ai_agent) => ({ value: ai_agent.agent_id, label: ai_agent.display_name }));
  return [...staff_options, ...agent_options];
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full bg-info-soft pl-2.5 pr-1 text-xs font-semibold text-info">
      {label}
      <button type="button" aria-label={`Remove filter ${label}`} onClick={onRemove} className="inline-flex size-5 items-center justify-center rounded-full hover:bg-white">
        <X className="size-3" aria-hidden />
      </button>
    </span>
  );
}

/** Search first; who and what as dropdowns; call and case filters appear as chips when set from a row or a link. */
export function AuditFilterBar({ event_filter, event_types, workforce, has_filter, onChange, onClear }: AuditFilterBarProps) {
  return (
    <div className="flex flex-col gap-2 border-b border-line bg-white px-6 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Search the audit log</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <input
            type="search"
            className="h-9 w-full rounded-md border border-line-strong bg-white pl-8 pr-3 text-sm placeholder:text-ink-faint"
            placeholder="Search any text in the record"
            value={event_filter.search ?? ""}
            onChange={(change_event) => onChange({ search: change_event.target.value })}
          />
        </label>
        <select aria-label="Who acted" className={SELECT_CLASS_NAME} value={event_filter.actor_type ?? ""} onChange={(change_event) => onChange({ actor_type: change_event.target.value })}>
          <option value="">Anyone</option>
          {ACTOR_TYPES.map((actor_type) => (
            <option key={actor_type} value={actor_type}>
              {ACTOR_TYPE_LABELS[actor_type]}
            </option>
          ))}
        </select>
        <select aria-label="Person or agent" className={SELECT_CLASS_NAME} value={event_filter.actor_id ?? ""} onChange={(change_event) => onChange({ actor_id: change_event.target.value })}>
          <option value="">Any person or agent</option>
          {listActorOptions(workforce).map((actor_option) => (
            <option key={actor_option.value} value={actor_option.value}>
              {actor_option.label}
            </option>
          ))}
        </select>
        <select aria-label="Event" className={SELECT_CLASS_NAME} value={event_filter.event_type ?? ""} onChange={(change_event) => onChange({ event_type: change_event.target.value })}>
          <option value="">Any event</option>
          {event_types.map((event_type) => (
            <option key={event_type} value={event_type}>
              {describeAuditEventType(event_type)}
            </option>
          ))}
        </select>
        <Button variant="ghost" disabled={!has_filter} onClick={onClear}>
          Clear
        </Button>
      </div>
      {event_filter.call_id || event_filter.case_number ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-faint">Only:</span>
          {event_filter.call_id ? <FilterChip label={`Call ${event_filter.call_id.slice(0, CALL_ID_PREVIEW_LENGTH)}`} onRemove={() => onChange({ call_id: undefined })} /> : null}
          {event_filter.case_number ? <FilterChip label={event_filter.case_number} onRemove={() => onChange({ case_number: undefined })} /> : null}
        </div>
      ) : null}
    </div>
  );
}
