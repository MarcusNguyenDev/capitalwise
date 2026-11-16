"use client";

import { useCurrentTime } from "@/shared/format/use_current_time.hook";
import type { LiveCall } from "@/shared/types/call.type";
import { EmptyState, ErrorState, LoadingState } from "@/shared/ui/surface.component";

import { sortLiveCalls } from "../sorting/sort_live_calls.util";
import { CallTile } from "./call_tile.component";

interface LiveCallsGridProps {
  live_calls: LiveCall[];
  is_loading: boolean;
  error_message: string | null;
  selected_call_id: string | null;
  onSelect: (call_id: string) => void;
}

export function LiveCallsGrid({ live_calls, is_loading, error_message, selected_call_id, onSelect }: LiveCallsGridProps) {
  const current_time_ms = useCurrentTime();
  const sorted_calls = sortLiveCalls(live_calls);

  return (
    <section className="min-w-0">
      <p className="mb-3 text-ink-soft">Calls needing a person rise to the top. Click a call to listen in.</p>
      {error_message ? <ErrorState message={error_message} /> : null}
      {is_loading && !error_message ? <LoadingState label="Loading live calls" /> : null}
      {!is_loading && !error_message && sorted_calls.length === 0 ? (
        <EmptyState title="No live conversations" description="Start the simulation, or place a call from the customer phone." />
      ) : null}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))] gap-4">
        {sorted_calls.map((call) => (
          <CallTile key={call.call_id} call={call} is_selected={call.call_id === selected_call_id} current_time_ms={current_time_ms} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}
