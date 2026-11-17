"use client";

import { Lock, ScrollText } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { fetchWorkforce } from "@/shared/api_client/engine_api.client";
import { LIVE_EVENT } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import type { AuditEventFilter } from "@/shared/types/case.type";
import { Badge } from "@/shared/ui/badge.component";
import { EmptyState } from "@/shared/ui/empty_state.component";
import { ErrorState } from "@/shared/ui/error_state.component";
import { PageHeader } from "@/shared/ui/page_header.component";
import { SkeletonList } from "@/shared/ui/skeleton.component";

import { useAuditEvents } from "../hooks/use_audit_events.hook";
import { AuditEventRow } from "./audit_event_row.component";
import { AuditFilterBar } from "./audit_filter_bar.component";
import { TamperTestDialog } from "./tamper_test_dialog.component";

function AuditLogView({ initial_filter }: { initial_filter: AuditEventFilter }) {
  const { event_filter, has_filter, updateFilter, clearFilter, events_query } = useAuditEvents(initial_filter);
  const workforce_query = useLiveQuery(fetchWorkforce, [LIVE_EVENT.STAFF_UPDATED]);
  const event_page = events_query.data;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Audit log"
        meta={
          <Badge tone="strong" icon={<Lock className="size-3" aria-hidden />}>
            Append-only · tamper-evident
          </Badge>
        }
        description="Every action by the AI, staff, customers and the system. Records can be added but never changed."
        actions={<TamperTestDialog />}
      />
      <AuditFilterBar
        event_filter={event_filter}
        event_types={event_page?.event_types ?? []}
        workforce={workforce_query.data}
        has_filter={has_filter}
        onChange={updateFilter}
        onClear={clearFilter}
      />
      <div className="min-h-0 flex-1 overflow-y-auto bg-white">
        {events_query.error_message ? <ErrorState className="m-6" title="Could not load the audit log" message={events_query.error_message} onRetry={events_query.reload} /> : null}
        {events_query.is_loading && !event_page ? <SkeletonList label="Loading the audit log" row_count={8} /> : null}
        {event_page && event_page.events.length === 0 ? (
          <EmptyState icon={<ScrollText aria-hidden />} title="No records match these filters" description="Clear a filter or search for something else." />
        ) : null}
        {event_page && event_page.events.length > 0 ? (
          <>
            <p className="px-6 py-2 text-xs text-ink-faint" aria-live="polite">
              Latest {event_page.events.length} of {event_page.total_count} matching records. New records appear at the top. Expand a row for its raw detail.
            </p>
            <ol className="border-t border-line">
              {event_page.events.map((audit_event) => (
                <AuditEventRow key={audit_event.event_id} audit_event={audit_event} onFilter={updateFilter} />
              ))}
            </ol>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Every event on the floor, newest first, filterable; `?call=` and `?case=` open it already narrowed. */
export function AuditLogWorkspace() {
  const search_params = useSearchParams();
  const call_id = search_params.get("call") ?? undefined;
  const case_number = search_params.get("case") ?? undefined;
  return <AuditLogView key={`${call_id}|${case_number}`} initial_filter={{ call_id, case_number }} />;
}
