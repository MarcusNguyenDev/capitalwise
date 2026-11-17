"use client";

import { fetchApprovalInbox, fetchDashboardKpis } from "@/shared/api_client/engine_api.client";
import { CALL_EVENTS, CASE_EVENTS } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";

import type { NavigationCountKey } from "../constants/navigation.constant";

const COUNT_REFRESH_EVENTS = [...CALL_EVENTS, ...CASE_EVENTS] as const;

/** The numbers beside navigation links: calls waiting for a person and cases waiting for a decision. */
export function useNavigationCounts(): Record<NavigationCountKey, number> {
  const kpis_query = useLiveQuery(fetchDashboardKpis, COUNT_REFRESH_EVENTS);
  const inbox_query = useLiveQuery(fetchApprovalInbox, CASE_EVENTS);
  return {
    NEEDS_ATTENTION: kpis_query.data?.needing_attention ?? 0,
    PENDING_APPROVALS: inbox_query.data?.length ?? 0,
  };
}
