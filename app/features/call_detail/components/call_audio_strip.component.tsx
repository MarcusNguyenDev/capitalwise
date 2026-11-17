import { Headphones } from "lucide-react";

import type { CallRoomParticipant } from "@/features/voice/livekit/call_room.type";
import { joinClassNames } from "@/shared/ui/join_class_names.util";

interface CallAudioStripProps {
  participants: CallRoomParticipant[] | null;
  can_play_audio: boolean;
  notice: string | null;
  onUnlockAudio: () => void;
}

/** Shown only while listening: who is in the call and who is speaking. */
export function CallAudioStrip({ participants, can_play_audio, notice, onUnlockAudio }: CallAudioStripProps) {
  if (!participants && !notice) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-canvas px-5 py-2 text-sm" aria-label="In the call">
      {participants ? <Headphones className="size-4 text-info" aria-hidden /> : null}
      {participants?.map((participant) => (
        <span
          key={participant.identity}
          data-call-room-identity={participant.identity}
          data-is-speaking={participant.is_speaking}
          className={joinClassNames(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
            participant.is_speaking ? "bg-positive-soft text-positive" : "bg-white text-ink-soft ring-1 ring-line",
          )}
        >
          <span className={joinClassNames("size-1.5 rounded-full", participant.is_speaking ? "animate-pulse-dot bg-positive" : "bg-ink-faint")} aria-hidden />
          {participant.name}
          {participant.is_speaking ? <span className="sr-only"> is speaking</span> : null}
        </span>
      ))}
      {participants && !can_play_audio ? (
        <button type="button" onClick={onUnlockAudio} className="text-sm font-semibold text-info underline">
          Click to hear the call
        </button>
      ) : null}
      {notice ? <span className="text-warning">{notice}</span> : null}
    </div>
  );
}
