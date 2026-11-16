"use client";

import { useEffect, useRef } from "react";

import { formatDuration } from "@/shared/format/format_values.util";
import type { CallMode, LiveCall } from "@/shared/types/call.type";

import type { CaptionSpeaker, PhoneCaption } from "../session/phone_call_session.type";
import { PhoneIcon } from "./phone_icon.component";

interface PhoneCallScreenProps {
  bank_name: string;
  call: LiveCall | null;
  call_mode: CallMode | null;
  captions: PhoneCaption[];
  human_staff_name: string | null;
  call_seconds: number;
  onHangUp: () => void;
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

/** The in-call screen: who the customer is speaking with, live captions for both sides and Hang up. */
export function PhoneCallScreen({ bank_name, call, call_mode, captions, human_staff_name, call_seconds, onHangUp }: PhoneCallScreenProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col text-white">
      <div className="px-6 pb-3 pt-4 text-center">
        <p className="text-2xl font-bold">{bank_name}</p>
        <p className="mt-0.5 text-lg tabular-nums text-white/70">{formatDuration(call_seconds)}</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="rounded-full bg-white/10 px-3 py-1">{call_mode === "LIVE" ? "Live voice" : "Scripted demo"}</span>
          {call?.identity_verified ? <span className="animate-fade-in rounded-full bg-positive px-3 py-1 font-semibold">✓ Identity confirmed</span> : null}
        </div>
        {human_staff_name ? (
          <p className="mt-3 animate-slide-down rounded-xl bg-info px-4 py-2.5 text-lg font-semibold" role="status">
            You&apos;re speaking with {human_staff_name} from our team
          </p>
        ) : (
          <p className="mt-3 text-white/60">Speaking with the AI specialist. This call is recorded.</p>
        )}
      </div>
      <LiveCaptions captions={captions} human_staff_name={human_staff_name} />
      <div className="flex flex-col items-center gap-2 pb-6 pt-3">
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
  );
}
