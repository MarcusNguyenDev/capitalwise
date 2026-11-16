"use client";

import { fetchWorkforce } from "@/shared/api_client/engine_api.client";
import { LIVE_EVENT } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import { Card, EmptyState, ErrorState, LoadingState } from "@/shared/ui/surface.component";

import { useAuditEvents } from "../hooks/use_audit_events.hook";

import { AuditEventRow } from "./audit_event_row.component";
import { AuditFilterBar } from "./audit_filter_bar.component";
import { TamperTestPanel } from "./tamper_test_panel.component";

export function AuditLog() {
  const { event_filter, has_filter, updateFilter, clearFilter, events_query } = useAuditEvents();
  const workforce_query = useLiveQuery(fetchWorkforce, [LIVE_EVENT.STAFF_UPDATED]);
  const event_page = events_query.data;

  return (
    <div className="space-y-5">
      <TamperTestPanel />
      <Card>
        <AuditFilterBar
          event_filter={event_filter}
          event_types={event_page?.event_types ?? []}
          workforce={workforce_query.data}
          has_filter={has_filter}
          onChange={updateFilter}
          onClear={clearFilter}
        />
        <p className="mb-2 mt-5 text-ink-soft">
          {event_page ? `Showing the latest ${event_page.events.length} of ${event_page.total_count} matching records. New records appear at the top.` : ""}
        </p>
        {events_query.error_message ? <ErrorState message={events_query.error_message} /> : null}
        {events_query.is_loading ? <LoadingState label="Loading the audit log" /> : null}
        {event_page && event_page.events.length === 0 ? <EmptyState title="No audit records match these filters" /> : null}
        <ol>
          {(event_page?.events ?? []).map((audit_event) => (
            <AuditEventRow key={audit_event.event_id} audit_event={audit_event} onFilter={updateFilter} />
          ))}
        </ol>
      </Card>
    </div>
  );
}
