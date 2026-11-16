"use client";

import { useEffect, useRef } from "react";

import { formatMilliseconds } from "@/shared/format/format_values.util";

import type { SpokenSpeaker, TranscriptEntry } from "../transcript/transcript_entry.type";
import { ToolCallCard } from "./tool_call_card.component";

const SPEAKER_LABELS: Record<SpokenSpeaker, string> = { CUSTOMER: "Customer", AI: "AI specialist", STAFF: "Staff" };

const BUBBLE_CLASS_NAMES: Record<SpokenSpeaker, string> = {
  CUSTOMER: "self-start rounded-bl-md bg-surface",
  AI: "self-end rounded-br-md bg-accent-soft",
  STAFF: "self-end rounded-br-md bg-info-soft",
};

function SpeechBubble({ entry }: { entry: Extract<TranscriptEntry, { kind: "SPEECH" }> }) {
  return (
    <div className={`max-w-[85%] animate-slide-in rounded-2xl px-4 py-2.5 ${BUBBLE_CLASS_NAMES[entry.speaker]}`}>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        {SPEAKER_LABELS[entry.speaker]}
        {entry.latency_ms !== null ? <span className="font-normal normal-case tabular-nums">answered in {formatMilliseconds(entry.latency_ms)}</span> : null}
      </p>
      <p className="text-lg leading-snug">
        {entry.text}
        {entry.is_in_progress ? <span className="ml-1 animate-pulse text-ink-faint">▍</span> : null}
      </p>
    </div>
  );
}

function StaffOnlyLine({ text }: { text: string }) {
  return (
    <div className="animate-slide-in self-center rounded-xl border border-dashed border-warning bg-warning-soft px-4 py-2 text-center">
      <p className="font-semibold text-warning">{text}</p>
      <p className="text-xs uppercase tracking-wide text-warning/80">Visible to staff only</p>
    </div>
  );
}

function TranscriptRow({ entry }: { entry: TranscriptEntry }) {
  if (entry.kind === "TOOL") {
    return <ToolCallCard turn={entry.turn} />;
  }
  if (entry.kind === "STAFF_ONLY") {
    return <StaffOnlyLine text={entry.text} />;
  }
  return <SpeechBubble entry={entry} />;
}

/** The streaming transcript: speech bubbles, inline tool calls and staff-only notes, pinned to the newest line. */
export function CallTranscript({ entries }: { entries: TranscriptEntry[] }) {
  const scroll_area_ref = useRef<HTMLDivElement>(null);
  const latest_entry = entries[entries.length - 1];
  const latest_text = latest_entry?.kind === "SPEECH" ? latest_entry.text : "";

  useEffect(() => {
    scroll_area_ref.current?.scrollTo({ top: scroll_area_ref.current.scrollHeight, behavior: "smooth" });
  }, [entries.length, latest_text]);

  return (
    <div ref={scroll_area_ref} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto rounded-xl border border-line bg-white p-4" aria-live="polite">
      {entries.length === 0 ? <p className="m-auto text-ink-faint">Waiting for the first words of the call</p> : null}
      {entries.map((entry) => (
        <TranscriptRow key={entry.entry_key} entry={entry} />
      ))}
    </div>
  );
}
