"use client";

import { useState } from "react";

import { CallDetailPanel } from "@/features/call_detail/components/call_detail_panel.component";
import { fetchEscalations } from "@/shared/api_client/engine_api.client";
import { useCurrentTime } from "@/shared/format/use_current_time.hook";
import { useListNavigation } from "@/shared/keyboard/use_list_navigation.hook";
import { CALL_EVENTS, CASE_EVENTS } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import { useQueryParam } from "@/shared/navigation/use_query_param.hook";
import { PageHeader } from "@/shared/ui/page_header.component";
import { SplitView } from "@/shared/ui/split_view.component";
import { Tabs } from "@/shared/ui/tabs.component";

import { useLiveCalls } from "../hooks/use_live_calls.hook";
import { groupLiveCalls } from "../sorting/group_live_calls.util";
import { CallQueueList } from "./call_queue_list.component";
import { EscalationList } from "./escalation_list.component";
import { LiveCallStats } from "./live_call_stats.component";
import { NoCallSelected } from "./no_call_selected.component";
import { SimulatorPopover } from "./simulator_popover.component";

const CALL_LIST_ELEMENT_ID = "live_call_queue";
const ESCALATION_REFRESH_EVENTS = [...CALL_EVENTS, ...CASE_EVENTS] as const;

type QueueTabKey = "CALLS" | "ESCALATIONS";

/** Live calls: the queue on the left, the open call on the right, today's numbers above. */
export function LiveCallsWorkspace() {
  const [selected_call_id, setSelectedCallId] = useQueryParam("call");
  const [queue_tab, setQueueTab] = useState<QueueTabKey>("CALLS");
  const live_calls = useLiveCalls();
  const escalations_query = useLiveQuery(fetchEscalations, ESCALATION_REFRESH_EVENTS);
  const current_time_ms = useCurrentTime();
  const call_groups = groupLiveCalls(live_calls.live_calls);
  const ordered_call_ids = call_groups.flatMap((call_group) => call_group.calls.map((call) => call.call_id));
  const list_navigation = useListNavigation({
    item_ids: ordered_call_ids,
    selected_id: selected_call_id,
    onOpen: setSelectedCallId,
    list_element_id: CALL_LIST_ELEMENT_ID,
    is_enabled: queue_tab === "CALLS",
  });
  const next_attention_call = call_groups.find((call_group) => call_group.status === "NEEDS_ATTENTION")?.calls[0] ?? null;
  const active_call_count = live_calls.live_calls.filter((call) => call.status !== "ENDED").length;
  const escalations = escalations_query.data ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Live calls" actions={<SimulatorPopover />} />
      <LiveCallStats />
      <SplitView
        list_label="Call queue"
        has_selection={selected_call_id !== null}
        list={
          <Tabs
            label="Queue"
            selected_key={queue_tab}
            onSelect={setQueueTab}
            className="flex-1"
            list_class_name="px-3"
            panel_class_name="overflow-y-auto"
            tabs={[
              {
                key: "CALLS",
                label: "Calls",
                count: active_call_count,
                content: (
                  <CallQueueList
                    call_groups={call_groups}
                    list_element_id={CALL_LIST_ELEMENT_ID}
                    is_loading={live_calls.is_loading}
                    error_message={live_calls.error_message}
                    selected_call_id={selected_call_id}
                    highlighted_call_id={list_navigation.highlighted_id}
                    current_time_ms={current_time_ms}
                    onOpen={setSelectedCallId}
                  />
                ),
              },
              {
                key: "ESCALATIONS",
                label: "Escalations",
                count: escalations.length,
                content: (
                  <EscalationList
                    escalations={escalations}
                    is_loading={escalations_query.is_loading}
                    error_message={escalations_query.error_message}
                    selected_call_id={selected_call_id}
                    current_time_ms={current_time_ms}
                    onOpenCall={setSelectedCallId}
                    onRetry={escalations_query.reload}
                  />
                ),
              },
            ]}
          />
        }
        detail={
          selected_call_id ? (
            <CallDetailPanel key={selected_call_id} call_id={selected_call_id} onClose={() => setSelectedCallId(null)} />
          ) : (
            <NoCallSelected next_attention_call={next_attention_call} onOpen={setSelectedCallId} />
          )
        }
      />
    </div>
  );
}
