"use client";

import { Lock } from "lucide-react";
import { useEffect, useRef } from "react";

import { formatMilliseconds } from "@/shared/format/format_values.util";
import { joinClassNames } from "@/shared/ui/join_class_names.util";

import type { SpokenSpeaker, TranscriptEntry } from "../transcript/transcript_entry.type";
import { TranscriptToolCall } from "./transcript_tool_call.component";

const SPEAKER_LABELS: Record<SpokenSpeaker, string> = { CUSTOMER: "Customer", AI: "AI specialist", STAFF: "Staff" };

const BUBBLE_CLASS_NAMES: Record<SpokenSpeaker, string> = {
  CUSTOMER: "self-start rounded-bl-sm bg-surface",
  AI: "self-end rounded-br-sm border border-line bg-white",
  STAFF: "self-end rounded-br-sm bg-info-soft",
};

function SpeechBubble({ entry }: { entry: Extract<TranscriptEntry, { kind: "SPEECH" }> }) {
  return (
    <div className={joinClassNames("max-w-[85%] animate-slide-in rounded-xl px-3.5 py-2", BUBBLE_CLASS_NAMES[entry.speaker])}>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-faint">
        {SPEAKER_LABELS[entry.speaker]}
        {entry.latency_ms !== null ? <span className="font-normal tabular-nums">· replied in {formatMilliseconds(entry.latency_ms)}</span> : null}
      </p>
      <p className="leading-snug">
        {entry.text}
        {entry.is_in_progress ? <span className="ml-1 animate-pulse-dot text-ink-faint">▍</span> : null}
      </p>
    </div>
  );
}

function StaffOnlyNote({ text }: { text: string }) {
  return (
    <p className="flex animate-slide-in items-center gap-2 self-center rounded-full bg-warning-soft px-3 py-1 text-xs font-medium text-warning">
      <Lock className="size-3" aria-hidden />
      {text}
      <span className="sr-only">(visible to staff only)</span>
    </p>
  );
}

function TranscriptRow({ entry }: { entry: TranscriptEntry }) {
  if (entry.kind === "TOOL") {
    return <TranscriptToolCall turn={entry.turn} />;
  }
  if (entry.kind === "STAFF_ONLY") {
    return <StaffOnlyNote text={entry.text} />;
  }
  return <SpeechBubble entry={entry} />;
}

/**
 * The live transcript, kept pinned to the newest line while you are at the
 * bottom. Scrolling up to read stops the auto-scroll until you return.
 */
export function CallTranscript({ entries }: { entries: TranscriptEntry[] }) {
  const scroll_area_ref = useRef<HTMLDivElement>(null);
  const is_pinned_ref = useRef(true);
  const latest_entry = entries[entries.length - 1];
  const latest_text = latest_entry?.kind === "SPEECH" ? latest_entry.text : "";

  useEffect(() => {
    const scroll_area = scroll_area_ref.current;
    if (scroll_area && is_pinned_ref.current) {
      scroll_area.scrollTo({ top: scroll_area.scrollHeight, behavior: "smooth" });
    }
  }, [entries.length, latest_text]);

  const rememberScrollPosition = () => {
    const scroll_area = scroll_area_ref.current;
    if (scroll_area) {
      is_pinned_ref.current = scroll_area.scrollHeight - scroll_area.scrollTop - scroll_area.clientHeight < 80;
    }
  };

  return (
    <div
      ref={scroll_area_ref}
      onScroll={rememberScrollPosition}
      role="log"
      aria-label="Call transcript"
      aria-live="polite"
      className="@container flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-5 py-4"
    >
      {entries.length === 0 ? <p className="m-auto text-sm text-ink-faint">Waiting for the first words of the call…</p> : null}
      {entries.map((entry) => (
        <TranscriptRow key={entry.entry_key} entry={entry} />
      ))}
    </div>
  );
}
