"use client";

import { BadgeCheck, CirclePause, Keyboard, Mic, MicOff, PhoneOff, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { CallRoomState } from "@/features/voice/livekit/call_room.type";
import { readActiveHold } from "@/shared/call_hold/apply_call_hold.util";
import { CUSTOMER_HOLD_REASON_LABELS } from "@/shared/call_hold/call_hold_wording.constant";
import { formatDuration, secondsBetween } from "@/shared/format/format_values.util";
import type { CallHold, CallMode, LiveCall } from "@/shared/types/call.type";
import { joinClassNames } from "@/shared/ui/join_class_names.util";

import type { CaptionSpeaker, PhoneCaption } from "../session/phone_call_session.type";
import { CallerDetailsCard } from "./caller_details_card.component";
import { TypedMessageBox } from "./typed_message_box.component";

interface PhoneCallScreenProps {
  bank_name: string;
  /** Who is playing the caller (demo): their own details show on the screen. */
  caller_customer_id: string | null;
  call: LiveCall | null;
  call_mode: CallMode | null;
  captions: PhoneCaption[];
  human_staff_name: string | null;
  call_seconds: number;
  current_time_ms: number | null;
  call_audio: CallRoomState | null;
  /** Live calls only: a typed line instead of speech. Resolves false when it was not sent. */
  onSendTypedMessage: (text: string) => Promise<boolean>;
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
    <div ref={scroll_area_ref} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3" role="log" aria-live="polite" aria-label="Live captions">
      {captions.length === 0 ? <p className="m-auto animate-pulse text-white/60">Connecting you now…</p> : null}
      {captions.map((caption) => {
        const speaker_label = describeSpeaker(caption.speaker, human_staff_name);
        return (
          <div key={caption.caption_id} className={joinClassNames("max-w-[85%] animate-slide-in rounded-2xl px-3.5 py-2", CAPTION_CLASS_NAMES[caption.speaker])}>
            {speaker_label ? <p className="text-[0.7rem] font-semibold uppercase tracking-wide opacity-70">{speaker_label}</p> : null}
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
    <div className="mx-4 mt-3 flex animate-slide-down items-center gap-3 rounded-xl bg-white/10 px-4 py-2.5 text-left" role="status">
      <CirclePause className="size-5 shrink-0 text-amber-300" aria-hidden />
      <p className="min-w-0 flex-1">
        <span className="block font-semibold">
          On hold <span className="tabular-nums">{formatDuration(hold_seconds)}</span>
        </span>
        <span className="block text-sm text-white/75">{CUSTOMER_HOLD_REASON_LABELS[hold.reason]}</span>
      </p>
    </div>
  );
}

function SpeakingDot({ is_speaking }: { is_speaking: boolean }) {
  return <span className={joinClassNames("inline-block size-2 rounded-full transition-colors", is_speaking ? "animate-pulse-dot bg-emerald-400" : "bg-white/30")} aria-hidden />;
}

/** Who the customer is talking to right now. A person joining is announced, never silent. */
function SpeakingWith({ human_staff_name, call_audio, is_ai_in_room }: { human_staff_name: string | null; call_audio: CallRoomState | null; is_ai_in_room: boolean }) {
  const speaking_roles = new Set((call_audio?.participants ?? []).filter((participant) => participant.is_speaking).map((participant) => participant.role));

  if (human_staff_name) {
    return (
      <p className="mx-4 mt-3 flex animate-slide-down items-center gap-2.5 rounded-xl bg-info px-4 py-2.5 text-left font-semibold" role="status">
        <UserRound className="size-5 shrink-0" aria-hidden />
        <span className="flex-1">You&apos;re speaking with {human_staff_name} from our team</span>
        <SpeakingDot is_speaking={speaking_roles.has("STAFF")} />
      </p>
    );
  }
  return (
    <p className="mt-2 flex items-center justify-center gap-2 text-sm text-white/65">
      {call_audio && is_ai_in_room ? <SpeakingDot is_speaking={speaking_roles.has("AI_SPECIALIST")} /> : null}
      AI specialist · this call is recorded
    </p>
  );
}

function RoundCallButton({ label, is_pressed, tone, onClick, children }: { label: string; is_pressed?: boolean; tone: "neutral" | "danger"; onClick: () => void; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        aria-label={label}
        aria-pressed={is_pressed}
        onClick={onClick}
        className={joinClassNames(
          "flex items-center justify-center rounded-full transition-transform hover:scale-105",
          tone === "danger" ? "size-[4.25rem] bg-accent text-white shadow-raised" : is_pressed ? "size-14 bg-white text-ink" : "size-14 bg-white/15 text-white hover:bg-white/25",
        )}
      >
        {children}
      </button>
      <span className="text-xs text-white/70">{label}</span>
    </div>
  );
}

/** The in-call screen: who you are speaking with, hold state, live captions for both sides, mute, type instead and hang up. */
export function PhoneCallScreen({
  bank_name,
  caller_customer_id,
  call,
  call_mode,
  captions,
  human_staff_name,
  call_seconds,
  current_time_ms,
  call_audio,
  onSendTypedMessage,
  onHangUp,
  onUnlockAudio,
  onMicrophoneMutedChange,
}: PhoneCallScreenProps) {
  const [is_typing_open, setIsTypingOpen] = useState(false);
  const hold = call ? readActiveHold(call) : null;
  const is_muted = call_audio?.is_microphone_muted ?? false;
  // Typed lines go to the live AI specialist, so only once the phone is in the call's room.
  const can_type = call_mode === "LIVE" && (call_audio?.is_connected ?? false);

  return (
    <div className="flex min-h-0 flex-1 flex-col text-white">
      <div className="px-6 pb-1 pt-5 text-center md:pt-3">
        <p className="text-xl font-semibold">{bank_name}</p>
        <p className="mt-0.5 tabular-nums text-white/70">{formatDuration(call_seconds)}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="rounded-full bg-white/10 px-2.5 py-1">{call_mode === "LIVE" ? "Live voice" : "Scripted demo"}</span>
          {call?.identity_verified ? (
            <span className="flex animate-fade-in items-center gap-1 rounded-full bg-positive px-2.5 py-1 font-semibold">
              <BadgeCheck className="size-3.5" aria-hidden />
              Identity confirmed
            </span>
          ) : null}
        </div>
        <SpeakingWith human_staff_name={human_staff_name} call_audio={call_audio} is_ai_in_room={call_mode === "LIVE"} />
      </div>
      {caller_customer_id ? <CallerDetailsCard customer_id={caller_customer_id} /> : null}
      {hold ? <HoldNotice hold={hold} current_time_ms={current_time_ms} /> : null}
      {call_audio && !call_audio.can_play_audio ? (
        <button type="button" onClick={onUnlockAudio} className="mx-auto mt-3 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-ink">
          Tap to hear the call
        </button>
      ) : null}
      <LiveCaptions captions={captions} human_staff_name={human_staff_name} />
      {can_type && is_typing_open ? <TypedMessageBox onSend={onSendTypedMessage} onClose={() => setIsTypingOpen(false)} /> : null}
      <div className="flex items-start justify-center gap-8 pb-6 pt-3">
        {call_audio?.is_microphone_published ? (
          <RoundCallButton label="Mute" is_pressed={is_muted} tone="neutral" onClick={() => onMicrophoneMutedChange(!is_muted)}>
            {is_muted ? <MicOff className="size-6" aria-hidden /> : <Mic className="size-6" aria-hidden />}
          </RoundCallButton>
        ) : null}
        {can_type ? (
          <RoundCallButton label="Type instead" is_pressed={is_typing_open} tone="neutral" onClick={() => setIsTypingOpen(!is_typing_open)}>
            <Keyboard className="size-6" aria-hidden />
          </RoundCallButton>
        ) : null}
        <RoundCallButton label="Hang up" tone="danger" onClick={onHangUp}>
          <PhoneOff className="size-7" aria-hidden />
        </RoundCallButton>
      </div>
    </div>
  );
}
