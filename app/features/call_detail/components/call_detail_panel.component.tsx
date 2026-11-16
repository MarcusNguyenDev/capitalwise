"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

import { readActiveHold } from "@/shared/call_hold/apply_call_hold.util";
import { OnHoldChip } from "@/shared/call_hold/on_hold_chip.component";
import { formatDuration, secondsBetween } from "@/shared/format/format_values.util";
import { useCurrentTime } from "@/shared/format/use_current_time.hook";
import { useCurrentStaff } from "@/shared/staff/current_staff.provider";
import type { LiveCall } from "@/shared/types/call.type";
import { CallStatusChip, Chip, RiskChip, SentimentChip } from "@/shared/ui/chip.component";
import { ErrorState, LoadingState } from "@/shared/ui/surface.component";

import { describeCallSource } from "../describe_call_source.util";
import { useCallDetail } from "../hooks/use_call_detail.hook";
import { useStaffCallAudio } from "../hooks/use_staff_call_audio.hook";
import { recordMonitoring } from "../record_monitoring.util";
import { buildTranscriptEntries } from "../transcript/build_transcript_entries.util";
import { CallActionButtons } from "./call_action_buttons.component";
import { CallAudioBar } from "./call_audio_bar.component";
import { CallMetrics } from "./call_metrics.component";
import { CallTranscript } from "./call_transcript.component";
import { CustomerContext } from "./customer_context.component";
import { RelatedCases } from "./related_cases.component";
import { SupervisorControls } from "./supervisor_controls.component";

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-ink-faint">{title}</h3>
      {children}
    </section>
  );
}

function CallHeader({ call, onClose }: { call: LiveCall; onClose: () => void }) {
  const current_time_ms = useCurrentTime();
  const duration_seconds = call.status === "ENDED" || current_time_ms === null ? call.duration_seconds : secondsBetween(call.started_at, current_time_ms);
  const hold = readActiveHold(call);

  return (
    <header className="flex items-start gap-4 border-b border-line px-6 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-2xl font-bold">{call.customer_name ?? "Unknown caller"}</h2>
          <CallStatusChip status={call.status} />
          {hold ? <OnHoldChip hold={hold} current_time_ms={current_time_ms} should_show_reason /> : null}
          {call.attention_reason && call.status !== "ENDED" ? <span className="font-semibold text-accent">{call.attention_reason}</span> : null}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-soft">
          <SentimentChip sentiment={call.sentiment} />
          <RiskChip risk_level={call.risk_level} />
          <Chip tone={call.identity_verified ? "positive" : "neutral"}>{call.identity_verified ? "✓ Identity verified" : "Not verified yet"}</Chip>
          <span>
            {call.intent ?? "Working out what the caller needs"} · {describeCallSource(call)} · {formatDuration(duration_seconds)}
            {call.agent_name ? ` · ${call.agent_name}` : ""}
          </span>
        </div>
      </div>
      <CallActionButtons call={call} />
      <button type="button" aria-label="Close call detail" className="rounded-lg px-2 text-3xl leading-none text-ink-faint hover:bg-surface" onClick={onClose}>
        ×
      </button>
    </header>
  );
}

interface CallDetailPanelProps {
  call_id: string;
  onClose: () => void;
}

/** Everything a supervisor needs for one call: live transcript, context, case packs, metrics and the controls. */
export function CallDetailPanel({ call_id, onClose }: CallDetailPanelProps) {
  const call_detail = useCallDetail(call_id);
  const { current_staff_id } = useCurrentStaff();
  const call = call_detail.call;
  const staff_call_audio = useStaffCallAudio(call_id, call);

  useEffect(() => {
    recordMonitoring(call_id, current_staff_id);
  }, [call_id, current_staff_id]);

  if (!call) {
    return (
      <aside className="rounded-2xl border border-line bg-white p-6">
        {call_detail.error_message ? <ErrorState message={call_detail.error_message} /> : <LoadingState label="Opening the call" />}
      </aside>
    );
  }

  const transcript_entries = buildTranscriptEntries(call_detail);

  return (
    <aside className="flex h-[calc(100vh-21.5rem)] min-h-[600px] animate-slide-in flex-col rounded-2xl border border-line bg-white shadow-lg">
      <CallHeader call={call} onClose={onClose} />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_19rem] gap-5 p-5">
        <div className="flex min-h-0 flex-col gap-3">
          {call.status === "ENDED" ? null : <CallAudioBar staff_call_audio={staff_call_audio} />}
          <CallTranscript entries={transcript_entries} />
          <SupervisorControls call={call} staff_call_audio={staff_call_audio} />
        </div>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
          <PanelSection title="AI running summary">
            <p key={call.ai_summary} className="animate-highlight rounded-lg">
              {call.ai_summary ?? "The AI has not summarised the call yet."}
            </p>
          </PanelSection>
          <PanelSection title="Call metrics">
            <CallMetrics metrics={call.metrics ?? {}} />
          </PanelSection>
          <PanelSection title="Case packs">
            <RelatedCases call_id={call_id} />
          </PanelSection>
          <PanelSection title="Customer context">
            {call.customer_id ? <CustomerContext customer_id={call.customer_id} /> : <p className="text-ink-faint">The caller&apos;s number did not match a customer.</p>}
          </PanelSection>
        </div>
      </div>
    </aside>
  );
}
