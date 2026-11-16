"use client";

import Link from "next/link";

import { fetchCases } from "@/shared/api_client/engine_api.client";
import { formatCalendarDate, formatCodeLabel } from "@/shared/format/format_values.util";
import { CASE_EVENTS } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import type { EngineCase } from "@/shared/types/case.type";
import { Chip, TierChip } from "@/shared/ui/chip.component";

function describeHandler(engine_case: EngineCase): string {
  if (engine_case.tier === 1) {
    return "Completed automatically, no staff needed";
  }
  return engine_case.assigned_staff_name ? `Assigned to ${engine_case.assigned_staff_name}` : "Waiting for a specialist";
}

function CasePackCard({ engine_case }: { engine_case: EngineCase }) {
  return (
    <li className="animate-slide-in rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold">{engine_case.case_number}</span>
        <TierChip tier={engine_case.tier} />
        <Chip key={engine_case.status} className="animate-highlight">
          {formatCodeLabel(engine_case.status)}
        </Chip>
      </div>
      <p className="mt-1.5 font-semibold">{formatCodeLabel(engine_case.action_code)}</p>
      <p className="text-ink-soft">{engine_case.summary}</p>
      <p className="mt-1.5 text-sm">
        AI proposed, policy <span className="font-mono font-semibold">{engine_case.matched_rule_id}</span> decided:{" "}
        <span className="font-semibold">{formatCodeLabel(engine_case.recommendation)}</span> ({Math.round(engine_case.confidence * 100)}%)
      </p>
      <p className="text-sm text-ink-soft">{engine_case.route_reason}</p>
      <p className="mt-1.5 text-sm font-semibold">{describeHandler(engine_case)}</p>
      {engine_case.response_due_on ? <p className="text-sm text-ink-soft">Respond by {formatCalendarDate(engine_case.response_due_on)}</p> : null}
      {engine_case.tier > 1 ? (
        <Link href="/approvals" className="mt-1.5 inline-block text-sm font-semibold text-accent hover:underline">
          Open in approvals →
        </Link>
      ) : null}
    </li>
  );
}

/** Case packs raised on this call, kept current as policy routes them and staff decide them. */
export function RelatedCases({ call_id }: { call_id: string }) {
  const cases_query = useLiveQuery(() => fetchCases({ call_id }), CASE_EVENTS, call_id);
  const related_cases = cases_query.data ?? [];

  if (related_cases.length === 0) {
    return <p className="text-ink-faint">{cases_query.is_loading ? "Loading cases" : "No case raised on this call yet"}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {related_cases.map((engine_case) => (
        <CasePackCard key={engine_case.case_number} engine_case={engine_case} />
      ))}
    </ul>
  );
}
