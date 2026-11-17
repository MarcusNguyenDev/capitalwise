"use client";

import { Mic, MicOff } from "lucide-react";
import type { RefObject } from "react";

import { Button } from "@/shared/ui/button.component";

import type { StaffCallAudio, StaffTalkState } from "../hooks/use_staff_call_audio.hook";
import { MessageComposer } from "./message_composer.component";

interface ReplyComposerProps {
  customer_first_name: string;
  staff_call_audio: StaffCallAudio;
  is_disabled: boolean;
  input_ref: RefObject<HTMLInputElement | null>;
  onSendReply: (reply: string) => Promise<boolean>;
}

const TALK_LABELS: Record<StaffTalkState, string> = { OFF: "Use microphone", CONNECTING: "Connecting…", LIVE: "Mute microphone" };

function describeAudio(staff_call_audio: StaffCallAudio): string {
  if (!staff_call_audio.can_use_audio) {
    return "This simulated call has no audio. Your typed replies are shown to the customer.";
  }
  if (staff_call_audio.notice) {
    return staff_call_audio.notice;
  }
  return staff_call_audio.talk_state === "LIVE"
    ? "Your microphone is live: the customer can hear you."
    : "Typed replies are spoken to the customer in the staff voice. Or turn on your microphone to talk.";
}

/** Once you have taken over: type replies the customer hears, or talk through your microphone. */
export function ReplyComposer({ customer_first_name, staff_call_audio, is_disabled, input_ref, onSendReply }: ReplyComposerProps) {
  const is_talking = staff_call_audio.talk_state !== "OFF";
  return (
    <div className="border-t border-info/30 bg-info-soft/40 px-5 py-3">
      <MessageComposer
        label={`Reply to ${customer_first_name}`}
        placeholder={`Reply to ${customer_first_name}…`}
        send_label="Send"
        is_disabled={is_disabled}
        input_ref={input_ref}
        onSend={onSendReply}
        helper={describeAudio(staff_call_audio)}
        trailing={
          staff_call_audio.can_use_audio ? (
            <Button
              aria-pressed={staff_call_audio.talk_state === "LIVE"}
              variant={staff_call_audio.talk_state === "LIVE" ? "primary" : "secondary"}
              is_loading={staff_call_audio.talk_state === "CONNECTING"}
              icon={staff_call_audio.talk_state === "LIVE" ? <MicOff className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />}
              onClick={is_talking ? staff_call_audio.stopTalking : staff_call_audio.startTalking}
            >
              {TALK_LABELS[staff_call_audio.talk_state]}
            </Button>
          ) : null
        }
      />
    </div>
  );
}
