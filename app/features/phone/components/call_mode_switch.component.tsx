import type { CallMode } from "@/shared/types/call.type";

interface CallModeSwitchProps {
  call_mode: CallMode | null;
  is_live_available: boolean;
  is_scripted_available: boolean;
  is_disabled: boolean;
  onChange: (call_mode: CallMode) => void;
}

const MODE_OPTIONS: { call_mode: CallMode; label: string }[] = [
  { call_mode: "SCRIPTED", label: "Scripted" },
  { call_mode: "LIVE", label: "Live voice" },
];

function describeModes(is_live_available: boolean, is_scripted_available: boolean): string {
  if (!is_live_available && !is_scripted_available) {
    return "This caller has no scripted call, and live voice needs an OpenAI key on the core service.";
  }
  if (!is_live_available) {
    return "Live voice is off because the core service has no OpenAI key. Scripted mode replays the call through the same tools, policy and audit pipeline, fully offline.";
  }
  if (!is_scripted_available) {
    return "Only the hero callers have a scripted call. This caller talks to the live AI specialist through your microphone.";
  }
  return "Scripted replays a voiced script through the same pipeline. Live voice talks to the AI specialist through your microphone.";
}

export function CallModeSwitch({ call_mode, is_live_available, is_scripted_available, is_disabled, onChange }: CallModeSwitchProps) {
  const isModeAvailable = (mode: CallMode) => (mode === "LIVE" ? is_live_available : is_scripted_available);

  return (
    <div>
      <div className="inline-flex rounded-xl border border-line bg-surface p-1" role="radiogroup" aria-label="Call mode">
        {MODE_OPTIONS.map((mode_option) => (
          <button
            key={mode_option.call_mode}
            type="button"
            role="radio"
            aria-checked={call_mode === mode_option.call_mode}
            disabled={is_disabled || !isModeAvailable(mode_option.call_mode)}
            onClick={() => onChange(mode_option.call_mode)}
            className={`rounded-lg px-5 py-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${call_mode === mode_option.call_mode ? "bg-white text-ink shadow-sm" : "text-ink-soft"}`}
          >
            {mode_option.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-ink-soft">{describeModes(is_live_available, is_scripted_available)}</p>
    </div>
  );
}
