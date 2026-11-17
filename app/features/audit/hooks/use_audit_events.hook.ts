"use client";

import { useState } from "react";

import { fetchAuditEvents } from "@/shared/api_client/engine_api.client";
import { ANY_ACTIVITY_EVENTS } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import type { AuditEventFilter } from "@/shared/types/case.type";

import { AUDIT_PAGE_SIZE } from "../constants/audit_view.constant";

const CALL_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The api rejects a call id that is not a complete UUID, so a half-typed one is held back.
function buildRequestFilter(event_filter: AuditEventFilter): AuditEventFilter {
  const has_complete_call_id = CALL_ID_PATTERN.test(event_filter.call_id?.trim() ?? "");
  return { ...event_filter, call_id: has_complete_call_id ? event_filter.call_id?.trim() : undefined, limit: AUDIT_PAGE_SIZE };
}

/** The filtered audit stream, reloaded whenever anything happens on the floor. `initial_filter` comes from a deep link. */
export function useAuditEvents(initial_filter: AuditEventFilter = {}) {
  const [event_filter, setEventFilter] = useState<AuditEventFilter>(initial_filter);
  const request_filter = buildRequestFilter(event_filter);
  const events_query = useLiveQuery(() => fetchAuditEvents(request_filter), ANY_ACTIVITY_EVENTS, JSON.stringify(request_filter));

  const updateFilter = (filter_change: AuditEventFilter) => setEventFilter((current_filter) => ({ ...current_filter, ...filter_change }));
  const clearFilter = () => setEventFilter({});
  const has_filter = Object.values(event_filter).some((filter_value) => filter_value !== undefined && filter_value !== "");

  return { event_filter, has_filter, updateFilter, clearFilter, events_query };
}
