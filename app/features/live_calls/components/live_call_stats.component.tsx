"use client";

import { fetchDashboardKpis } from "@/shared/api_client/engine_api.client";
import { formatMilliseconds } from "@/shared/format/format_values.util";
import { CALL_EVENTS, CASE_EVENTS, LIVE_EVENT } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import { Stat } from "@/shared/ui/stat.component";

const STATS_REFRESH_EVENTS = [...CALL_EVENTS, ...CASE_EVENTS, LIVE_EVENT.STAFF_UPDATED] as const;

function formatCount(count: number | undefined): string {
  return count === undefined ? "–" : String(count);
}

/** Today at a glance, in one slim row so the queue keeps the space. */
export function LiveCallStats() {
  const kpis = useLiveQuery(fetchDashboardKpis, STATS_REFRESH_EVENTS).data;

  return (
    <dl className="grid shrink-0 grid-cols-3 gap-x-5 gap-y-4 border-b border-line bg-white px-5 py-5 sm:grid-cols-4 sm:px-7 2xl:grid-cols-7" aria-label="Today at a glance">
      <Stat label="Live calls" value={formatCount(kpis?.live_calls)} />
      <Stat label="AI handling" value={formatCount(kpis?.handled_by_ai)} />
      <Stat label="Need attention" value={formatCount(kpis?.needing_attention)} is_highlighted={(kpis?.needing_attention ?? 0) > 0} />
      <Stat label="With a person" value={formatCount(kpis?.with_humans)} />
      <Stat label="Avg AI response" value={formatMilliseconds(kpis?.avg_ai_response_ms)} />
      <Stat label="Auto-resolved today" value={formatCount(kpis?.cases_auto_resolved_today)} />
      <Stat label="Staff available" value={formatCount(kpis?.staff_available)} />
    </dl>
  );
}
