import { formatCodeLabel } from "@/shared/format/format_values.util";
import type { AuditEventFilter } from "@/shared/types/case.type";
import type { Workforce } from "@/shared/types/resources.type";
import { Button } from "@/shared/ui/button.component";

import { ACTOR_TYPES } from "../constants/audit_view.constant";

const FIELD_CLASS_NAME = "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2";

interface AuditFilterBarProps {
  event_filter: AuditEventFilter;
  event_types: string[];
  workforce: Workforce | null;
  has_filter: boolean;
  onChange: (filter_change: AuditEventFilter) => void;
  onClear: () => void;
}

interface FilterFieldProps {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
}

function TextFilter({ label, value, onChange, placeholder }: FilterFieldProps & { placeholder: string }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold uppercase tracking-wide text-ink-faint">{label}</span>
      <input
        type="search"
        className={FIELD_CLASS_NAME}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(change_event) => onChange(change_event.target.value)}
      />
    </label>
  );
}

function SelectFilter({ label, value, onChange, options }: FilterFieldProps & { options: { value: string; label: string }[] }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold uppercase tracking-wide text-ink-faint">{label}</span>
      <select className={FIELD_CLASS_NAME} value={value ?? ""} onChange={(change_event) => onChange(change_event.target.value)}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function listActorOptions(workforce: Workforce | null): { value: string; label: string }[] {
  const staff_options = (workforce?.staff ?? []).map((staff_member) => ({ value: staff_member.staff_id, label: staff_member.name }));
  const agent_options = (workforce?.ai_agents ?? []).map((ai_agent) => ({ value: ai_agent.agent_id, label: ai_agent.display_name }));
  return [...staff_options, ...agent_options];
}

export function AuditFilterBar({ event_filter, event_types, workforce, has_filter, onChange, onClear }: AuditFilterBarProps) {
  return (
    <div className="grid grid-cols-[1fr_1.2fr_1.4fr_1.2fr_1fr_1.6fr_auto] items-end gap-3">
      <SelectFilter
        label="Actor type"
        value={event_filter.actor_type}
        onChange={(actor_type) => onChange({ actor_type })}
        options={ACTOR_TYPES.map((actor_type) => ({ value: actor_type, label: formatCodeLabel(actor_type) }))}
      />
      <SelectFilter label="Actor" value={event_filter.actor_id} onChange={(actor_id) => onChange({ actor_id })} options={listActorOptions(workforce)} />
      <SelectFilter
        label="Event"
        value={event_filter.event_type}
        onChange={(event_type) => onChange({ event_type })}
        options={event_types.map((event_type) => ({ value: event_type, label: formatCodeLabel(event_type) }))}
      />
      <TextFilter label="Call" placeholder="Full call id" value={event_filter.call_id} onChange={(call_id) => onChange({ call_id })} />
      <TextFilter label="Case" placeholder="CASE-…" value={event_filter.case_number} onChange={(case_number) => onChange({ case_number })} />
      <TextFilter label="Search" placeholder="Any text in the record" value={event_filter.search} onChange={(search) => onChange({ search })} />
      <Button variant="ghost" disabled={!has_filter} onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}
