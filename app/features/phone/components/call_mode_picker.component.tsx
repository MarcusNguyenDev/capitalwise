import type { CallMode } from "@/shared/types/call.type";
import { SegmentedControl } from "@/shared/ui/segmented_control.component";

interface CallModePickerProps {
  call_mode: CallMode | null;
  is_live_available: boolean;
  live_unavailable_reason: string | null;
  is_scripted_available: boolean;
  is_disabled: boolean;
  onChange: (call_mode: CallMode) => void;
}

const DEFAULT_LIVE_UNAVAILABLE_REASON = "The core service reports that live voice is unavailable.";

function describeMode(call_mode: CallMode | null, is_scripted_available: boolean): string {
  if (call_mode === "LIVE") {
    return "You talk to the AI specialist through your microphone.";
  }
  if (call_mode === "SCRIPTED") {
    return "Replays a voiced script through the same tools, policy and audit pipeline. The caller answers the identity questions in the script, so there is nothing to tap.";
  }
  return is_scripted_available ? "" : "This caller has no scripted call, and live voice is off.";
}

/** Scripted (offline, repeatable) or Live (talk to the AI). Explains why an option is unavailable. */
export function CallModePicker({ call_mode, is_live_available, live_unavailable_reason, is_scripted_available, is_disabled, onChange }: CallModePickerProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold text-ink-faint" aria-hidden>
        Call mode
      </p>
      <SegmentedControl<CallMode>
        label="Call mode"
        value={call_mode}
        is_disabled={is_disabled}
        onChange={onChange}
        options={[
          { value: "SCRIPTED", label: "Scripted", is_disabled: !is_scripted_available, title: is_scripted_available ? undefined : "This caller has no script. Your own story always runs Live." },
          { value: "LIVE", label: "Live voice", is_disabled: !is_live_available, title: is_live_available ? undefined : (live_unavailable_reason ?? DEFAULT_LIVE_UNAVAILABLE_REASON) },
        ]}
      />
      <p className="text-xs text-ink-soft">{describeMode(call_mode, is_scripted_available)}</p>
      {is_live_available ? null : <p className="text-xs text-warning">Live voice is off: {live_unavailable_reason ?? DEFAULT_LIVE_UNAVAILABLE_REASON}</p>}
    </div>
  );
}
