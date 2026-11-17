"use client";

import { useEffect, useRef } from "react";

import { useKeyboardShortcut } from "@/shared/keyboard/use_keyboard_shortcut.hook";
import { useCurrentStaff } from "@/shared/staff/current_staff.provider";
import { ErrorState } from "@/shared/ui/error_state.component";
import { SkeletonDetail } from "@/shared/ui/skeleton.component";

import { useCallDetail } from "../hooks/use_call_detail.hook";
import { useStaffCallAudio } from "../hooks/use_staff_call_audio.hook";
import { useSupervisorActions } from "../hooks/use_supervisor_actions.hook";
import { recordMonitoring } from "../record_monitoring.util";
import { buildTranscriptEntries } from "../transcript/build_transcript_entries.util";
import { CallAudioStrip } from "./call_audio_strip.component";
import { CallContextPanel } from "./call_context_panel.component";
import { CallDetailHeader } from "./call_detail_header.component";
import { CallEndedFooter } from "./call_ended_footer.component";
import { CallStateBanner } from "./call_state_banner.component";
import { CallTranscript } from "./call_transcript.component";
import { ReplyComposer } from "./reply_composer.component";
import { WhisperComposer } from "./whisper_composer.component";

interface CallDetailPanelProps {
  call_id: string;
  onClose: () => void;
}

function readFirstName(customer_name: string | null): string {
  return customer_name?.split(" ")[0] ?? "the customer";
}

/** One call: what is happening now, the conversation with the right message box, and the context beside it. */
export function CallDetailPanel({ call_id, onClose }: CallDetailPanelProps) {
  const call_detail = useCallDetail(call_id);
  const { current_staff_id } = useCurrentStaff();
  const call = call_detail.call;
  const staff_call_audio = useStaffCallAudio(call_id, call);
  const supervisor_actions = useSupervisorActions(call_id);
  const composer_input_ref = useRef<HTMLInputElement>(null);
  const is_live = call !== null && call.status !== "ENDED";

  useEffect(() => {
    recordMonitoring(call_id, current_staff_id);
  }, [call_id, current_staff_id]);

  useKeyboardShortcut("Escape", onClose);
  useKeyboardShortcut("w", () => composer_input_ref.current?.focus(), { is_enabled: is_live });
  useKeyboardShortcut("t", () => void supervisor_actions.takeOver(), { is_enabled: is_live && call?.status !== "HUMAN_ACTIVE" });
  useKeyboardShortcut("l", () => (staff_call_audio.listen_state === "OFF" ? staff_call_audio.startListening() : staff_call_audio.stopListening()), {
    is_enabled: is_live && staff_call_audio.can_use_audio,
  });

  if (!call) {
    return call_detail.error_message ? (
      <ErrorState className="m-6" title="Could not open this call" message={call_detail.error_message} />
    ) : (
      <SkeletonDetail label="Opening the call" />
    );
  }

  const transcript_entries = buildTranscriptEntries(call_detail);

  return (
    <article aria-label={`Call with ${call.customer_name ?? "unknown caller"}`} className="flex min-h-0 flex-1 animate-fade-in flex-col bg-white">
      <CallDetailHeader call={call} staff_call_audio={staff_call_audio} supervisor_actions={supervisor_actions} onClose={onClose} />
      <CallStateBanner call={call} current_staff_id={current_staff_id} />
      {is_live ? (
        <CallAudioStrip
          participants={staff_call_audio.room_state?.participants ?? null}
          can_play_audio={staff_call_audio.room_state?.can_play_audio ?? true}
          notice={staff_call_audio.notice}
          onUnlockAudio={staff_call_audio.unlockAudio}
        />
      ) : null}
      <div className="@container flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto @3xl:flex-row @3xl:overflow-hidden">
          <div className="flex min-h-[26rem] min-w-0 flex-1 flex-col @3xl:min-h-0">
            <CallTranscript entries={transcript_entries} />
            {call.status === "ENDED" ? <CallEndedFooter call_id={call.call_id} /> : null}
            {call.status === "HUMAN_ACTIVE" ? (
              <ReplyComposer
                customer_first_name={readFirstName(call.customer_name)}
                staff_call_audio={staff_call_audio}
                is_disabled={supervisor_actions.is_busy}
                input_ref={composer_input_ref}
                onSendReply={supervisor_actions.sendReply}
              />
            ) : null}
            {call.status === "AI_ACTIVE" || call.status === "NEEDS_ATTENTION" ? (
              <WhisperComposer is_disabled={supervisor_actions.is_busy} input_ref={composer_input_ref} onWhisper={supervisor_actions.whisperInstruction} />
            ) : null}
          </div>
          <aside aria-label="Call context" className="shrink-0 border-t border-line @3xl:w-80 @3xl:border-l @3xl:border-t-0">
            <CallContextPanel call={call} />
          </aside>
        </div>
      </div>
    </article>
  );
}
