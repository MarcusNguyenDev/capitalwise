"use client";

import { useEffect, useRef } from "react";

import type { CallRoomState } from "@/features/voice/livekit/call_room.type";
import { readActiveHold } from "@/shared/call_hold/apply_call_hold.util";
import { CUSTOMER_HOLD_REASON_LABELS } from "@/shared/call_hold/call_hold_wording.constant";
import { formatDuration, secondsBetween } from "@/shared/format/format_values.util";
import type { CallHold, CallMode, LiveCall } from "@/shared/types/call.type";

import type { CaptionSpeaker, PhoneCaption } from "../session/phone_call_session.type";
import { PhoneIcon } from "./phone_icon.component";

interface PhoneCallScreenProps {
  bank_name: string;
  call: LiveCall | null;
  call_mode: CallMode | null;
  captions: PhoneCaption[];
  human_staff_name: string | null;
  call_seconds: number;
  current_time_ms: number | null;
  call_audio: CallRoomState | null;
  onHangUp: () => void;
  onUnlockAudio: () => void;
  onMicrophoneMutedChange: (is_muted: boolean) => void;
}

const CAPTION_CLASS_NAMES: Record<CaptionSpeaker, string> = {
  AI: "self-start rounded-bl-md bg-white/10 text-white",
  STAFF: "self-start rounded-bl-md bg-info text-white",
  CUSTOMER: "self-end rounded-br-md bg-white text-ink",
  SYSTEM: "self-center bg-transparent text-center text-sm text-white/70",
};

function describeSpeaker(speaker: CaptionSpeaker, human_staff_name: string | null): string | null {
  if (speaker === "AI") {
    return "AI specialist";
  }
  if (speaker === "STAFF") {
    return human_staff_name ?? "Specialist";
  }
  return speaker === "CUSTOMER" ? "You" : null;
}

function LiveCaptions({ captions, human_staff_name }: { captions: PhoneCaption[]; human_staff_name: string | null }) {
  const scroll_area_ref = useRef<HTMLDivElement>(null);
  const latest_caption = captions[captions.length - 1];

  useEffect(() => {
    scroll_area_ref.current?.scrollTo({ top: scroll_area_ref.current.scrollHeight, behavior: "smooth" });
  }, [captions.length, latest_caption?.text]);

  return (
    <div ref={scroll_area_ref} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-5 py-3" aria-live="polite">
      {captions.length === 0 ? <p className="m-auto animate-pulse text-white/60">Connecting you now…</p> : null}
      {captions.map((caption) => {
        const speaker_label = describeSpeaker(caption.speaker, human_staff_name);
        return (
          <div key={caption.caption_id} className={`max-w-[88%] animate-slide-in rounded-2xl px-3.5 py-2 ${CAPTION_CLASS_NAMES[caption.speaker]}`}>
            {speaker_label ? <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{speaker_label}</p> : null}
            <p className="leading-snug">{caption.text}</p>
          </div>
        );
      })}
    </div>
  );
}

function HoldNotice({ hold, current_time_ms }: { hold: CallHold; current_time_ms: number | null }) {
  const hold_seconds = current_time_ms === null ? 0 : secondsBetween(hold.started_at, current_time_ms);

  return (
    <div className="mt-3 animate-slide-down rounded-xl bg-warning px-4 py-2.5" role="status">
      <p className="flex items-center justify-center gap-2 text-lg font-semibold">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" aria-hidden />
        On hold <span className="tabular-nums">{formatDuration(hold_seconds)}</span>
      </p>
      <p className="text-sm text-white/85">{CUSTOMER_HOLD_REASON_LABELS[hold.reason]}</p>
    </div>
  );
}

function SpeakingDot({ is_speaking }: { is_speaking: boolean }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full transition-colors ${is_speaking ? "animate-pulse bg-positive" : "bg-white/25"}`} aria-hidden />;
}

interface SpeakingWithProps {
  human_staff_name: string | null;
  call_audio: CallRoomState | null;
  /** Only a live call carries the AI's voice in the room; scripted lines are spoken on the phone itself. */
  is_ai_in_room: boolean;
}

/** Who has the call right now and whether they are talking, read from the LiveKit room. */
function SpeakingWith({ human_staff_name, call_audio, is_ai_in_room }: SpeakingWithProps) {
  const speaking_roles = new Set((call_audio?.participants ?? []).filter((participant) => participant.is_speaking).map((participant) => participant.role));

  if (human_staff_name) {
    return (
      <p className="mt-3 flex animate-slide-down items-center justify-center gap-2 rounded-xl bg-info px-4 py-2.5 text-lg font-semibold" role="status">
        <SpeakingDot is_speaking={speaking_roles.has("STAFF")} />
        You&apos;re speaking with {human_staff_name} from our team
      </p>
    );
  }
  return (
    <p className="mt-3 flex items-center justify-center gap-2 text-white/60">
      {call_audio && is_ai_in_room ? <SpeakingDot is_speaking={speaking_roles.has("AI_SPECIALIST")} /> : null}
      Speaking with the AI specialist. This call is recorded.
    </p>
  );
}

function MicrophoneButton({ call_audio, onMicrophoneMutedChange }: { call_audio: CallRoomState; onMicrophoneMutedChange: (is_muted: boolean) => void }) {
  const is_muted = call_audio.is_microphone_muted;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        aria-pressed={is_muted}
        aria-label={is_muted ? "Unmute" : "Mute"}
        onClick={() => onMicrophoneMutedChange(!is_muted)}
        className={`flex h-14 w-14 items-center justify-center rounded-full text-sm font-semibold transition-colors ${is_muted ? "bg-white text-ink" : "bg-white/15 text-white hover:bg-white/25"}`}
      >
        {is_muted ? "Muted" : "Mute"}
      </button>
      <span className="flex items-center gap-1.5 text-sm text-white/60">
        <SpeakingDot is_speaking={call_audio.is_local_speaking && !is_muted} />
        {is_muted ? "Mic off" : "Mic on"}
      </span>
    </div>
  );
}

/** The in-call screen: who the customer is speaking with, hold state, live captions for both sides and Hang up. */
export function PhoneCallScreen({
  bank_name,
  call,
  call_mode,
  captions,
  human_staff_name,
  call_seconds,
  current_time_ms,
  call_audio,
  onHangUp,
  onUnlockAudio,
  onMicrophoneMutedChange,
}: PhoneCallScreenProps) {
  const hold = call ? readActiveHold(call) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col text-white">
      <div className="px-6 pb-3 pt-4 text-center">
        <p className="text-2xl font-bold">{bank_name}</p>
        <p className="mt-0.5 text-lg tabular-nums text-white/70">{formatDuration(call_seconds)}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="rounded-full bg-white/10 px-3 py-1">{call_mode === "LIVE" ? "Live voice" : "Scripted demo"}</span>
          {call?.identity_verified ? <span className="animate-fade-in rounded-full bg-positive px-3 py-1 font-semibold">✓ Identity confirmed</span> : null}
        </div>
        <SpeakingWith human_staff_name={human_staff_name} call_audio={call_audio} is_ai_in_room={call_mode === "LIVE"} />
        {hold ? <HoldNotice hold={hold} current_time_ms={current_time_ms} /> : null}
        {call_audio && !call_audio.can_play_audio ? (
          <button type="button" onClick={onUnlockAudio} className="mt-3 rounded-xl bg-white px-4 py-2 font-semibold text-ink">
            Tap to hear the call
          </button>
        ) : null}
      </div>
      <LiveCaptions captions={captions} human_staff_name={human_staff_name} />
      <div className="flex items-start justify-center gap-10 pb-6 pt-3">
        {call_audio?.is_microphone_published ? <MicrophoneButton call_audio={call_audio} onMicrophoneMutedChange={onMicrophoneMutedChange} /> : null}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onHangUp}
            aria-label="Hang up"
            className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-accent text-white shadow-lg transition-transform hover:scale-105"
          >
            <PhoneIcon class_name="h-9 w-9 rotate-[135deg]" />
          </button>
          <span className="text-sm text-white/60">Hang up</span>
        </div>
      </div>
    </div>
  );
}
