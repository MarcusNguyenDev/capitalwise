"use client";

import { useState } from "react";

import { Button } from "@/shared/ui/button.component";

import { useStaffTalk } from "../hooks/use_staff_talk.hook";
import type { StaffTalkState } from "../hooks/use_staff_talk.hook";

interface TakeoverReplyBoxProps {
  call_id: string;
  /** Simulated calls have no phone on the other end to carry audio. */
  can_use_audio: boolean;
  is_disabled: boolean;
  onSendReply: (reply: string) => Promise<boolean>;
}

const TALK_BUTTON_LABELS: Record<StaffTalkState, string> = {
  OFF: "Talk",
  CONNECTING: "Connecting…",
  LIVE: "Mic live · Stop",
};

function describeAudio(can_use_audio: boolean, talk_state: StaffTalkState, fallback_notice: string | null): string {
  if (!can_use_audio) {
    return "This is a simulated call with no audio. Type your replies.";
  }
  if (fallback_notice) {
    return fallback_notice;
  }
  return talk_state === "LIVE" ? "The customer can hear you now." : "Speak with your microphone, or type and your reply is spoken to the customer.";
}

/** While a staff member has the call: speak through the microphone, or type replies that the phone reads out. */
export function TakeoverReplyBox({ call_id, can_use_audio, is_disabled, onSendReply }: TakeoverReplyBoxProps) {
  const [reply, setReply] = useState("");
  const staff_talk = useStaffTalk(call_id);
  const is_talking = staff_talk.talk_state !== "OFF";

  const submitReply = async () => {
    const trimmed_reply = reply.trim();
    if (trimmed_reply && (await onSendReply(trimmed_reply))) {
      setReply("");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-info">You have the call. The AI is silent.</p>
        <button
          type="button"
          disabled={!can_use_audio}
          aria-pressed={is_talking}
          onClick={is_talking ? staff_talk.stopTalking : staff_talk.startTalking}
          className={`flex items-center gap-2 rounded-full px-4 py-1.5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${staff_talk.talk_state === "LIVE" ? "animate-attention bg-accent text-white" : "border border-line bg-white text-ink hover:bg-surface"}`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${staff_talk.talk_state === "LIVE" ? "bg-white" : staff_talk.talk_state === "CONNECTING" ? "animate-pulse bg-warning" : "bg-ink-faint"}`} />
          {TALK_BUTTON_LABELS[staff_talk.talk_state]}
        </button>
      </div>
      <p className={`text-sm ${staff_talk.fallback_notice ? "text-warning" : "text-ink-soft"}`}>
        {describeAudio(can_use_audio, staff_talk.talk_state, staff_talk.fallback_notice)}
      </p>
      <form
        className="flex gap-2"
        onSubmit={(submit_event) => {
          submit_event.preventDefault();
          void submitReply();
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 outline-none focus:border-info"
          placeholder="Type a reply to the customer"
          value={reply}
          disabled={is_disabled}
          onChange={(change_event) => setReply(change_event.target.value)}
        />
        <Button type="submit" variant="primary" disabled={is_disabled || reply.trim() === ""}>
          Send
        </Button>
      </form>
    </div>
  );
}
