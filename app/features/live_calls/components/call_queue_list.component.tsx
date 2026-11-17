import { Headphones } from "lucide-react";

import { CUSTOMER_PHONE_PATH } from "@/features/console_shell/constants/navigation.constant";
import { EmptyState } from "@/shared/ui/empty_state.component";
import { ErrorState } from "@/shared/ui/error_state.component";
import { SkeletonList } from "@/shared/ui/skeleton.component";

import type { LiveCallGroup } from "../sorting/group_live_calls.util";
import { CallQueueItem } from "./call_queue_item.component";

interface CallQueueListProps {
  call_groups: LiveCallGroup[];
  list_element_id: string;
  is_loading: boolean;
  error_message: string | null;
  selected_call_id: string | null;
  highlighted_call_id: string | null;
  current_time_ms: number | null;
  onOpen: (call_id: string) => void;
}

/** Every live call, grouped by who has it, with the calls waiting for a person on top. */
export function CallQueueList({ call_groups, list_element_id, is_loading, error_message, selected_call_id, highlighted_call_id, current_time_ms, onOpen }: CallQueueListProps) {
  if (error_message) {
    return <ErrorState className="m-3" title="Could not load live calls" message={error_message} />;
  }
  if (is_loading && call_groups.length === 0) {
    return <SkeletonList label="Loading live calls" />;
  }
  if (call_groups.length === 0) {
    return (
      <EmptyState
        icon={<Headphones aria-hidden />}
        title="No live calls right now"
        description="Calls appear here the moment the AI answers. Start the simulator above, or place a call from the customer phone."
        action={
          <a href={CUSTOMER_PHONE_PATH} target="_blank" rel="noreferrer" className="text-sm font-semibold text-info hover:underline">
            Open the customer phone
          </a>
        }
      />
    );
  }
  return (
    <div id={list_element_id}>
      {call_groups.map((call_group) => (
        <section key={call_group.status} aria-label={call_group.title}>
          <h3 className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-canvas/95 px-4 py-1.5 text-xs font-semibold text-ink-soft backdrop-blur">
            {call_group.title}
            <span className="tabular-nums text-ink-faint">{call_group.calls.length}</span>
          </h3>
          <ul>
            {call_group.calls.map((call) => (
              <CallQueueItem
                key={call.call_id}
                call={call}
                is_selected={call.call_id === selected_call_id}
                is_highlighted={call.call_id === highlighted_call_id}
                current_time_ms={current_time_ms}
                onOpen={onOpen}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
