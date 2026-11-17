"use client";

import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { formatDateTime, formatDuration } from "@/shared/format/format_values.util";
import { CallIdentityBadge } from "@/shared/status/call_identity_badge.component";
import { UNIDENTIFIED_CALLER_NAME } from "@/shared/status/status_wording.constant";
import type { CallTimeline } from "@/shared/types/case.type";
import { EmptyState } from "@/shared/ui/empty_state.component";
import { IconButton } from "@/shared/ui/icon_button.component";

import { REPLAY_TAIL_MS } from "../constants/replay.constant";
import { useTimelineReplay } from "../hooks/use_timeline_replay.hook";
import { compressTimelineGaps } from "../utils/compress_timeline_gaps.util";
import { ReplayControls } from "./replay_controls.component";
import { ReplayEventItem } from "./replay_event.component";

export function CallReplayPlayer({ timeline, onClose }: { timeline: CallTimeline; onClose: () => void }) {
  const replay_events = useMemo(() => compressTimelineGaps(timeline.events), [timeline.events]);
  const duration_ms = (replay_events.at(-1)?.replay_offset_ms ?? 0) + REPLAY_TAIL_MS;
  const replay = useTimelineReplay(duration_ms);
  const shown_events = replay_events.filter((replay_event) => replay_event.replay_offset_ms <= replay.position_ms);
  const transcript_ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcript_ref.current?.scrollTo({ top: transcript_ref.current.scrollHeight, behavior: "smooth" });
  }, [shown_events.length]);

  return (
    <article aria-label={`Replay of the call with ${timeline.call.customer_name ?? "unknown caller"}`} className="flex min-h-0 flex-1 animate-fade-in flex-col bg-white">
      <header className="flex items-start gap-4 border-b border-line px-5 py-3.5">
        <IconButton label="Back to the list" icon={<ArrowLeft className="size-4" aria-hidden />} onClick={onClose} className="lg:hidden" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{timeline.call.customer_name ?? UNIDENTIFIED_CALLER_NAME}</h2>
            {timeline.call.identity_level === undefined ? null : <CallIdentityBadge call={{ ...timeline.call, identity_verified: timeline.call.identity_verified ?? false }} />}
          </div>
          <p className="text-sm text-ink-soft">
            {timeline.call.intent ?? "No intent recorded"} · {formatDateTime(timeline.call.started_at)} · {formatDuration(timeline.call.duration_seconds)} call. Long
            silences are shortened.
          </p>
        </div>
      </header>
      {replay_events.length === 0 ? (
        <EmptyState className="flex-1" title="This call has no recorded events to replay" />
      ) : (
        <>
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
          <div ref={transcript_ref} className="min-h-0 flex-1 overflow-y-auto px-5 py-4" role="log" aria-label="Replayed conversation">
            <ol className="mx-auto flex max-w-3xl flex-col gap-3">
              {shown_events.map((replay_event) => (
                <ReplayEventItem key={replay_event.replay_key} replay_event={replay_event} />
              ))}
            </ol>
          </div>
        </>
      )}
    </article>
  );
}
