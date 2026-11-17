"use client";

import { ArrowLeft, Hand, Undo2, X } from "lucide-react";
import { useState } from "react";

import { readActiveHold } from "@/shared/call_hold/apply_call_hold.util";
import { OnHoldBadge } from "@/shared/call_hold/on_hold_badge.component";
import { formatDuration, secondsBetween } from "@/shared/format/format_values.util";
import { useCurrentTime } from "@/shared/format/use_current_time.hook";
import { CallStatusBadge } from "@/shared/status/call_status_badge.component";
import type { LiveCall } from "@/shared/types/call.type";
import { Button } from "@/shared/ui/button.component";
import { IconButton } from "@/shared/ui/icon_button.component";

import { describeCallSource } from "../describe_call_source.util";
import type { StaffCallAudio } from "../hooks/use_staff_call_audio.hook";
import type { SupervisorActions } from "../hooks/use_supervisor_actions.hook";
import { CallOverflowMenu } from "./call_overflow_menu.component";
import { HandbackDialog } from "./handback_dialog.component";
import { ListenButton } from "./listen_button.component";

interface CallDetailHeaderProps {
  call: LiveCall;
  staff_call_audio: StaffCallAudio;
  supervisor_actions: SupervisorActions;
  onClose: () => void;
}

/** Who is on the call and the one thing to do next: take over, or hand back once you have it. */
export function CallDetailHeader({ call, staff_call_audio, supervisor_actions, onClose }: CallDetailHeaderProps) {
  const [is_handback_open, setIsHandbackOpen] = useState(false);
  const current_time_ms = useCurrentTime();
  const duration_seconds = call.status === "ENDED" || current_time_ms === null ? call.duration_seconds : secondsBetween(call.started_at, current_time_ms);
  const hold = readActiveHold(call);
  const is_ended = call.status === "ENDED";

  const confirmHandback = async (handback_note: string) => {
    if (await supervisor_actions.handBack(handback_note)) {
      setIsHandbackOpen(false);
    }
  };

  return (
    <header className="flex flex-wrap items-start gap-x-4 gap-y-3 border-b border-line px-5 py-3.5">
      <IconButton label="Back to the queue" icon={<ArrowLeft className="size-4" aria-hidden />} onClick={onClose} className="lg:hidden" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-lg font-semibold">{call.customer_name ?? "Unknown caller"}</h2>
          <CallStatusBadge status={call.status} staff_name={call.assigned_staff_name} />
          {hold ? <OnHoldBadge hold={hold} current_time_ms={current_time_ms} should_show_reason /> : null}
        </div>
        <p className="mt-0.5 truncate text-sm text-ink-soft">
          {call.intent ?? "Working out what the caller needs"} · <span className="tabular-nums">{formatDuration(duration_seconds)}</span> · {describeCallSource(call)}
          {call.agent_name ? ` · ${call.agent_name}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {!is_ended && staff_call_audio.can_use_audio ? <ListenButton staff_call_audio={staff_call_audio} /> : null}
        {is_ended ? null : call.status === "HUMAN_ACTIVE" ? (
          <Button variant="primary" icon={<Undo2 className="size-4" aria-hidden />} disabled={supervisor_actions.is_busy} onClick={() => setIsHandbackOpen(true)}>
            Hand back to AI
          </Button>
        ) : (
          <Button variant="primary" icon={<Hand className="size-4" aria-hidden />} is_loading={supervisor_actions.is_busy} onClick={() => void supervisor_actions.takeOver()}>
            Take over
          </Button>
        )}
        <CallOverflowMenu call={call} is_busy={supervisor_actions.is_busy} onEndCall={supervisor_actions.endCall} />
        <IconButton label="Close call" icon={<X className="size-4" aria-hidden />} onClick={onClose} className="hidden lg:inline-flex" />
      </div>
      <HandbackDialog is_open={is_handback_open} is_busy={supervisor_actions.is_busy} onOpenChange={setIsHandbackOpen} onConfirm={(handback_note) => void confirmHandback(handback_note)} />
    </header>
  );
}
