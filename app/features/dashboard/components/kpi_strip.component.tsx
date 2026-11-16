"use client";

import { fetchDashboardKpis } from "@/shared/api_client/engine_api.client";
import { formatMilliseconds } from "@/shared/format/format_values.util";
import { CALL_EVENTS, CASE_EVENTS, LIVE_EVENT } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";

const KPI_REFRESH_EVENTS = [...CALL_EVENTS, ...CASE_EVENTS, LIVE_EVENT.STAFF_UPDATED] as const;

interface KpiTileProps {
  label: string;
  value: string;
  is_urgent?: boolean;
}

function KpiTile({ label, value, is_urgent = false }: KpiTileProps) {
  return (
    <div className={`rounded-2xl border px-5 py-2.5 ${is_urgent ? "border-accent bg-accent-soft" : "border-line bg-white"}`}>
      <p className="text-sm font-semibold text-ink-soft">{label}</p>
      {/* Re-keying on the value restarts the highlight animation whenever it changes. */}
      <p key={value} className={`mt-0.5 inline-block animate-highlight rounded-lg px-1 text-4xl font-bold tabular-nums ${is_urgent ? "text-accent" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function formatCount(count: number | undefined): string {
  return count === undefined ? "–" : String(count);
}

export function KpiStrip() {
  const kpis = useLiveQuery(fetchDashboardKpis, KPI_REFRESH_EVENTS).data;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      <KpiTile label="Live calls" value={formatCount(kpis?.live_calls)} />
      <KpiTile label="Handled by AI" value={formatCount(kpis?.handled_by_ai)} />
      <KpiTile label="Needing attention" value={formatCount(kpis?.needing_attention)} is_urgent={(kpis?.needing_attention ?? 0) > 0} />
      <KpiTile label="With humans" value={formatCount(kpis?.with_humans)} />
      <KpiTile label="Avg AI response" value={formatMilliseconds(kpis?.avg_ai_response_ms)} />
      <KpiTile label="Auto-resolved today" value={formatCount(kpis?.cases_auto_resolved_today)} />
      <KpiTile label="Staff available" value={formatCount(kpis?.staff_available)} />
    </div>
  );
}
