"use client";

import { useState } from "react";

import { fetchCases } from "@/shared/api_client/engine_api.client";
import { CASE_EVENTS } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import type { LiveCall } from "@/shared/types/call.type";
import { EmptyState } from "@/shared/ui/empty_state.component";
import { Tabs } from "@/shared/ui/tabs.component";

import { CallSummaryTab } from "./call_summary_tab.component";
import { CustomerContext } from "./customer_context.component";
import { RelatedCases } from "./related_cases.component";

type ContextTabKey = "SUMMARY" | "CUSTOMER" | "CASES";

/** Beside the transcript: the AI's summary, who the customer is, and the cases raised on the call. */
export function CallContextPanel({ call }: { call: LiveCall }) {
  const [selected_tab, setSelectedTab] = useState<ContextTabKey>("SUMMARY");
  const cases_query = useLiveQuery(() => fetchCases({ call_id: call.call_id }), CASE_EVENTS, call.call_id);
  const related_cases = cases_query.data ?? [];

  return (
    <Tabs
      label="Call context"
      selected_key={selected_tab}
      onSelect={setSelectedTab}
      className="h-full"
      list_class_name="px-3"
      panel_class_name="overflow-y-auto"
      tabs={[
        { key: "SUMMARY", label: "Summary", content: <CallSummaryTab call={call} /> },
        {
          key: "CUSTOMER",
          label: "Customer",
          content: call.customer_id ? (
            <CustomerContext customer_id={call.customer_id} />
          ) : (
            <EmptyState title="Caller not recognised" description="The caller's number did not match a customer." />
          ),
        },
        { key: "CASES", label: "Cases", count: related_cases.length, content: <RelatedCases related_cases={related_cases} is_loading={cases_query.is_loading} /> },
      ]}
    />
  );
}
