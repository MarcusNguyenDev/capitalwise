"use client";

import { useEffect, useMemo, useRef } from "react";

import { formatDateTime, formatDuration } from "@/shared/format/format_values.util";
import type { CallTimeline } from "@/shared/types/case.type";
import { EmptyState } from "@/shared/ui/surface.component";

import { REPLAY_TAIL_MS } from "../constants/replay.constant";
import { useTimelineReplay } from "../hooks/use_timeline_replay.hook";
import { compressTimelineGaps } from "../utils/compress_timeline_gaps.util";

import { ReplayControls } from "./replay_controls.component";
import { ReplayEventItem } from "./replay_event.component";

export function CallReplayPlayer({ timeline }: { timeline: CallTimeline }) {
  const replay_events = useMemo(() => compressTimelineGaps(timeline.events), [timeline.events]);
  const duration_ms = (replay_events.at(-1)?.replay_offset_ms ?? 0) + REPLAY_TAIL_MS;
  const replay = useTimelineReplay(duration_ms);
  const shown_events = replay_events.filter((replay_event) => replay_event.replay_offset_ms <= replay.position_ms);
  const transcript_ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scrolls only the transcript box; scrollIntoView would also move the page.
    transcript_ref.current?.scrollTo({ top: transcript_ref.current.scrollHeight, behavior: "smooth" });
  }, [shown_events.length]);

  if (replay_events.length === 0) {
    return <EmptyState title="This call has no recorded events to replay" />;
  }
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-3xl font-bold">{timeline.call.customer_name ?? "Unknown caller"}</h2>
        <p className="text-lg text-ink-soft">
          {timeline.call.intent ?? "No intent recorded"} · {formatDateTime(timeline.call.started_at)} · {formatDuration(timeline.call.duration_seconds)} call.
          Long silences are shortened in the replay.
        </p>
      </div>
      <ReplayControls
        replay_events={replay_events}
        duration_ms={duration_ms}
        position_ms={replay.position_ms}
        shown_event_count={shown_events.length}
        is_playing={replay.is_playing}
        is_finished={replay.is_finished}
        onTogglePlayback={replay.togglePlayback}
        onRestart={replay.restart}
        onSeek={replay.seekTo}
      />
      <div ref={transcript_ref} className="h-[calc(100vh-27rem)] min-h-96 overflow-y-auto rounded-2xl border border-line bg-white p-6">
        <ol className="space-y-4">
          {shown_events.map((replay_event) => (
            <ReplayEventItem key={replay_event.replay_key} replay_event={replay_event} />
          ))}
        </ol>
      </div>
    </div>
  );
}
