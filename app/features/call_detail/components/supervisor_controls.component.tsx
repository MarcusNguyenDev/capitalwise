"use client";

import type { LiveCall } from "@/shared/types/call.type";

import { useSupervisorActions } from "../hooks/use_supervisor_actions.hook";
import { TakeoverReplyBox } from "./takeover_reply_box.component";
import { WhisperBox } from "./whisper_box.component";

/** Under the transcript: whisper to the AI while it has the call, or talk and type to the customer after a takeover. */
export function SupervisorControls({ call }: { call: LiveCall }) {
  const supervisor_actions = useSupervisorActions(call.call_id);

  if (call.status === "ENDED") {
    return <p className="rounded-xl bg-surface px-4 py-3 text-center text-ink-soft">This call has ended. The full trail is in Audit and explainability.</p>;
  }

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      {call.status === "HUMAN_ACTIVE" ? (
        <TakeoverReplyBox
          call_id={call.call_id}
          can_use_audio={call.channel !== "SIMULATED"}
          is_disabled={supervisor_actions.is_busy}
          onSendReply={supervisor_actions.sendReply}
        />
      ) : (
        <WhisperBox is_disabled={supervisor_actions.is_busy} onWhisper={supervisor_actions.whisperInstruction} />
      )}
    </div>
  );
}
