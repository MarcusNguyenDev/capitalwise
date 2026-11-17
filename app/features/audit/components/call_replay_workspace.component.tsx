"use client";

import { CirclePlay } from "lucide-react";

import { fetchCallTimeline, fetchEndedCalls } from "@/shared/api_client/engine_api.client";
import { formatDateTime, formatDuration } from "@/shared/format/format_values.util";
import { useListNavigation } from "@/shared/keyboard/use_list_navigation.hook";
import { LIVE_EVENT } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import { useQueryParam } from "@/shared/navigation/use_query_param.hook";
import { EmptyState } from "@/shared/ui/empty_state.component";
import { ErrorState } from "@/shared/ui/error_state.component";
import { PageHeader } from "@/shared/ui/page_header.component";
import { QueueItem } from "@/shared/ui/queue_item.component";
import { SkeletonDetail, SkeletonList } from "@/shared/ui/skeleton.component";
import { SplitView } from "@/shared/ui/split_view.component";

import { CallReplayPlayer } from "./call_replay_player.component";

const NO_REFRESH_EVENTS: readonly string[] = [];
const ENDED_CALL_LIST_ELEMENT_ID = "ended_call_list";

function TimelinePanel({ call_id, onClose }: { call_id: string; onClose: () => void }) {
  const timeline_query = useLiveQuery(() => fetchCallTimeline(call_id), NO_REFRESH_EVENTS, call_id);
  if (timeline_query.data) {
    return <CallReplayPlayer timeline={timeline_query.data} onClose={onClose} />;
  }
  return timeline_query.error_message ? (
    <ErrorState className="m-6" title="Could not load the call" message={timeline_query.error_message} onRetry={timeline_query.reload} />
  ) : (
    <SkeletonDetail label="Loading the call" />
  );
}

/** Call replay: every ended call, replayed at 4x with its turns, system checks and interventions. */
export function CallReplayWorkspace() {
  const ended_calls_query = useLiveQuery(fetchEndedCalls, [LIVE_EVENT.CALL_ENDED]);
  const [selected_call_id, setSelectedCallId] = useQueryParam("call");
  const ended_calls = ended_calls_query.data ?? [];
  const shown_call_id = selected_call_id ?? ended_calls[0]?.call_id ?? null;
  const list_navigation = useListNavigation({
    item_ids: ended_calls.map((ended_call) => ended_call.call_id),
    selected_id: shown_call_id,
    onOpen: setSelectedCallId,
    list_element_id: ENDED_CALL_LIST_ELEMENT_ID,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Call replay" description="Replay an ended call at 4x speed: what was said, what the AI checked, and where staff stepped in." />
      <SplitView
        list_label="Ended calls"
        has_selection={selected_call_id !== null}
        list={
          <div className="min-h-0 flex-1 overflow-y-auto">
            {ended_calls_query.error_message ? <ErrorState className="m-3" message={ended_calls_query.error_message} onRetry={ended_calls_query.reload} /> : null}
            {ended_calls_query.is_loading ? <SkeletonList label="Loading ended calls" /> : null}
            {!ended_calls_query.is_loading && ended_calls.length === 0 ? (
              <EmptyState icon={<CirclePlay aria-hidden />} title="No ended calls yet" description="Calls appear here when they finish." />
            ) : null}
            <ul id={ENDED_CALL_LIST_ELEMENT_ID}>
              {ended_calls.map((ended_call) => (
                <QueueItem
                  key={ended_call.call_id}
                  item_id={ended_call.call_id}
                  is_selected={ended_call.call_id === shown_call_id}
                  is_highlighted={ended_call.call_id === list_navigation.highlighted_id}
                  onOpen={() => setSelectedCallId(ended_call.call_id)}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-semibold">{ended_call.customer_name ?? "Unknown caller"}</span>
                    <span className="shrink-0 text-sm tabular-nums text-ink-faint">{formatDuration(ended_call.duration_seconds)}</span>
                  </span>
                  <span className="block truncate text-sm text-ink-soft">{ended_call.intent ?? "No intent recorded"}</span>
                  <span className="block text-xs text-ink-faint">
                    {formatDateTime(ended_call.started_at)} · {ended_call.turn_count} turns
                  </span>
                </QueueItem>
              ))}
            </ul>
          </div>
        }
        detail={
          shown_call_id ? (
            <TimelinePanel key={shown_call_id} call_id={shown_call_id} onClose={() => setSelectedCallId(null)} />
          ) : (
            <EmptyState className="flex-1" icon={<CirclePlay aria-hidden />} title="Pick an ended call to replay it" />
          )
        }
      />
    </div>
  );
}
