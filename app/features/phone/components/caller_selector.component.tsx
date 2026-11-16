import type { Caller } from "@/shared/types/resources.type";

import { HERO_PERSONAS } from "../constants/hero_persona.constant";
import { formatMobileNumber } from "../format_mobile_number.util";

interface CallerSelectorProps {
  callers: Caller[];
  selected_customer_id: string;
  is_disabled: boolean;
  onSelect: (customer_id: string) => void;
}

/** Simulates caller ID: picking a person here is "their mobile number rang the bank". */
export function CallerSelector({ callers, selected_customer_id, is_disabled, onSelect }: CallerSelectorProps) {
  const hero_customer_ids: string[] = HERO_PERSONAS.map((hero_persona) => hero_persona.customer_id);
  const other_callers = callers.filter((caller) => !hero_customer_ids.includes(caller.customer_id));
  const is_other_selected = other_callers.some((caller) => caller.customer_id === selected_customer_id);

  return (
    <div className="flex flex-col gap-2">
      {HERO_PERSONAS.map((hero_persona) => {
        const caller = callers.find((known_caller) => known_caller.customer_id === hero_persona.customer_id);
        if (!caller) {
          return null;
        }
        const is_selected = caller.customer_id === selected_customer_id;
        return (
          <button
            key={caller.customer_id}
            type="button"
            disabled={is_disabled}
            aria-pressed={is_selected}
            onClick={() => onSelect(caller.customer_id)}
            className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${is_selected ? "border-accent bg-accent-soft" : "border-line bg-white hover:bg-surface"}`}
          >
            <span>
              <span className="block text-lg font-semibold">{caller.full_name}</span>
              <span className="block text-ink-soft">{hero_persona.story_label}</span>
            </span>
            <span className="text-sm text-ink-faint">{formatMobileNumber(caller.mobile_phone)}</span>
          </button>
        );
      })}
      {other_callers.length > 0 ? (
        <label className="mt-2 flex items-center gap-3 text-ink-soft">
          Other callers
          <select
            className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-ink"
            disabled={is_disabled}
            value={is_other_selected ? selected_customer_id : ""}
            onChange={(change_event) => change_event.target.value && onSelect(change_event.target.value)}
          >
            <option value="">Choose a customer</option>
            {other_callers.map((caller) => (
              <option key={caller.customer_id} value={caller.customer_id}>
                {caller.full_name} ({caller.customer_id})
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
