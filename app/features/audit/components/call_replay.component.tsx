"use client";

import { useState } from "react";

import { fetchCallTimeline, fetchEndedCalls } from "@/shared/api_client/engine_api.client";
import { formatDateTime, formatDuration } from "@/shared/format/format_values.util";
import { LIVE_EVENT } from "@/shared/live/live_event_names.constant";
import { useLiveQuery } from "@/shared/live/use_live_query.hook";
import type { EndedCallSummary } from "@/shared/types/case.type";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/surface.component";

import { CallReplayPlayer } from "./call_replay_player.component";

interface EndedCallListProps {
  ended_calls: EndedCallSummary[];
  selected_call_id: string | null;
  onSelect: (call_id: string) => void;
}

function EndedCallList({ ended_calls, selected_call_id, onSelect }: EndedCallListProps) {
  return (
    <ul className="max-h-[calc(100vh-16rem)] space-y-1.5 overflow-y-auto pr-1">
      {ended_calls.map((ended_call) => {
        const is_selected = ended_call.call_id === selected_call_id;
        return (
          <li key={ended_call.call_id}>
            <button
              type="button"
              aria-pressed={is_selected}
              className={`w-full rounded-xl border px-4 py-2.5 text-left ${is_selected ? "border-accent bg-accent-soft/50" : "border-line bg-white hover:bg-surface"}`}
              onClick={() => onSelect(ended_call.call_id)}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-lg font-bold">{ended_call.customer_name ?? "Unknown caller"}</span>
                <span className="font-mono text-sm text-ink-soft">{formatDuration(ended_call.duration_seconds)}</span>
              </span>
              <span className="block text-ink-soft">{ended_call.intent ?? "No intent recorded"}</span>
              <span className="block text-sm text-ink-faint">
                {formatDateTime(ended_call.started_at)} · {ended_call.turn_count} turns
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function TimelinePanel({ call_id }: { call_id: string }) {
  const timeline_query = useLiveQuery(() => fetchCallTimeline(call_id), [], call_id);
  if (timeline_query.data) {
    return <CallReplayPlayer timeline={timeline_query.data} />;
  }
  return timeline_query.error_message ? <ErrorState message={timeline_query.error_message} /> : <LoadingState label="Loading the call" />;
}

export function CallReplay() {
  const ended_calls_query = useLiveQuery(fetchEndedCalls, [LIVE_EVENT.CALL_ENDED]);
  const [chosen_call_id, setChosenCallId] = useState<string | null>(null);
  const ended_calls = ended_calls_query.data ?? [];
  const selected_call_id = chosen_call_id ?? ended_calls[0]?.call_id ?? null;

  return (
    <div className="grid grid-cols-[26rem_1fr] items-start gap-8">
      <aside className="sticky top-24">
        {ended_calls_query.error_message ? <ErrorState message={ended_calls_query.error_message} /> : null}
        {ended_calls_query.is_loading ? <LoadingState label="Loading ended calls" /> : null}
        {!ended_calls_query.is_loading && ended_calls.length === 0 ? <EmptyState title="No ended calls yet" /> : null}
        <EndedCallList ended_calls={ended_calls} selected_call_id={selected_call_id} onSelect={setChosenCallId} />
      </aside>
      {selected_call_id ? <TimelinePanel key={selected_call_id} call_id={selected_call_id} /> : <EmptyState title="Pick an ended call to replay it" />}
    </div>
  );
}
