"use client";

import type { Caller } from "@/shared/types/resources.type";
import { joinClassNames } from "@/shared/ui/join_class_names.util";

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
    <fieldset disabled={is_disabled} className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1.5 text-xs font-semibold text-ink-faint">Who is calling</legend>
      {HERO_PERSONAS.map((hero_persona) => {
        const caller = callers.find((known_caller) => known_caller.customer_id === hero_persona.customer_id);
        if (!caller) {
          return null;
        }
        const is_selected = caller.customer_id === selected_customer_id;
        return (
          <label
            key={caller.customer_id}
            className={joinClassNames(
              "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus",
              is_selected ? "border-ink/40 bg-canvas" : "border-line bg-white hover:bg-canvas",
            )}
          >
            <input
              type="radio"
              name="caller"
              className="size-4 accent-ink"
              value={caller.customer_id}
              checked={is_selected}
              onChange={() => onSelect(caller.customer_id)}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{hero_persona.title ?? caller.full_name}</span>
              <span className={joinClassNames("block text-xs text-ink-soft", !hero_persona.is_unscripted && "truncate")}>{hero_persona.story_label}</span>
              {hero_persona.is_unscripted ? <span className="block text-xs text-ink-faint">Live only · calls as {caller.full_name}</span> : null}
            </span>
            {/* The unscripted caller's number shows on the phone; its row needs the width for the explanation. */}
            {hero_persona.is_unscripted ? null : <span className="hidden text-xs tabular-nums text-ink-faint sm:block">{formatMobileNumber(caller.mobile_phone)}</span>}
          </label>
        );
      })}
      {other_callers.length > 0 ? (
        <label className="mt-1 flex flex-col gap-1 text-xs font-medium text-ink-faint">
          Someone else
          <select
            className="h-9 rounded-md border border-line-strong bg-white px-2.5 text-sm text-ink"
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
    </fieldset>
  );
}
