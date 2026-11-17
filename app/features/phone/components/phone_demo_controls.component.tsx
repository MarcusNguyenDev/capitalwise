import { ExternalLink } from "lucide-react";

import type { CallMode } from "@/shared/types/call.type";
import type { Caller } from "@/shared/types/resources.type";
import { ErrorState } from "@/shared/ui/error_state.component";

import { CallModePicker } from "./call_mode_picker.component";
import { CallerSelector } from "./caller_selector.component";

interface PhoneDemoControlsProps {
  callers: Caller[];
  selected_customer_id: string;
  call_mode: CallMode | null;
  is_live_available: boolean;
  live_unavailable_reason: string | null;
  is_scripted_available: boolean;
  is_in_call: boolean;
  error_message: string | null;
  onSelectCaller: (customer_id: string) => void;
  onChangeMode: (call_mode: CallMode) => void;
}

/** The simulation settings, kept apart from the phone itself: who is calling and how the call runs. */
export function PhoneDemoControls(controls: PhoneDemoControlsProps) {
  return (
    <div className="flex flex-col gap-5">
      {controls.error_message ? <ErrorState title="Could not load the callers" message={controls.error_message} /> : null}
      <CallerSelector
        callers={controls.callers}
        selected_customer_id={controls.selected_customer_id}
        is_disabled={controls.is_in_call}
        onSelect={controls.onSelectCaller}
      />
      <CallModePicker
        call_mode={controls.call_mode}
        is_live_available={controls.is_live_available}
        live_unavailable_reason={controls.live_unavailable_reason}
        is_scripted_available={controls.is_scripted_available}
        is_disabled={controls.is_in_call}
        onChange={controls.onChangeMode}
      />
      {controls.is_in_call ? <p className="text-xs text-ink-soft">Hang up to change the caller or the mode.</p> : null}
      <a href="/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-info hover:underline">
        <ExternalLink className="size-4" aria-hidden />
        Watch the call in the specialist console
      </a>
    </div>
  );
}
