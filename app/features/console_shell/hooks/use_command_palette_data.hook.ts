"use client";

import { fetchLiveCalls } from "@/shared/api_client/core_api.client";
import { fetchApprovalInbox, fetchCallers, fetchCases } from "@/shared/api_client/engine_api.client";
import { CALL_EVENTS, CASE_EVENTS } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";

const RECENT_CASE_LIMIT = 40;
const NO_REFRESH_EVENTS: readonly string[] = [];

/** What the command palette can jump to. Loaded only while the palette is open. */
export function useCommandPaletteData() {
  const live_calls_query = useLiveQuery(fetchLiveCalls, CALL_EVENTS);
  const inbox_query = useLiveQuery(fetchApprovalInbox, CASE_EVENTS);
  const recent_cases_query = useLiveQuery(() => fetchCases({ limit: RECENT_CASE_LIMIT }), CASE_EVENTS);
  const callers_query = useLiveQuery(fetchCallers, NO_REFRESH_EVENTS);
  const pending_case_numbers = new Set((inbox_query.data ?? []).map((pending_case) => pending_case.case_number));

  return {
    live_calls: (live_calls_query.data ?? []).filter((call) => call.status !== "ENDED"),
    pending_cases: inbox_query.data ?? [],
    decided_cases: (recent_cases_query.data ?? []).filter((recent_case) => !pending_case_numbers.has(recent_case.case_number)),
    callers: callers_query.data ?? [],
    is_loading: live_calls_query.is_loading || inbox_query.is_loading,
  };
}
