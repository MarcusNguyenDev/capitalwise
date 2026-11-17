import { Hand, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import type { LiveCall } from "@/shared/types/call.type";
import { joinClassNames } from "@/shared/ui/join_class_names.util";

const TONE_CLASS_NAMES = {
  attention: "border-warning/30 bg-warning-soft text-warning",
  info: "border-info/20 bg-info-soft text-info",
  neutral: "border-line bg-canvas text-ink-soft",
};

function Banner({ tone, icon, children }: { tone: keyof typeof TONE_CLASS_NAMES; icon: ReactNode; children: ReactNode }) {
  return (
    <div role="status" className={joinClassNames("flex items-start gap-2.5 border-b px-5 py-2.5 text-sm", TONE_CLASS_NAMES[tone])}>
      <span className="mt-0.5 [&>svg]:size-4">{icon}</span>
      <p className="min-w-0 flex-1">{children}</p>
    </div>
  );
}

/** One sentence on what this call needs from you right now. */
export function CallStateBanner({ call, current_staff_id }: { call: LiveCall; current_staff_id: string }) {
  if (call.status === "NEEDS_ATTENTION") {
    return (
      <Banner tone="attention" icon={<TriangleAlert aria-hidden />}>
        <strong className="font-semibold">Needs a person{call.attention_reason ? `: ${call.attention_reason}` : ""}.</strong> Take over to talk to the customer, or
        whisper to guide the AI.
      </Banner>
    );
  }
  if (call.status === "HUMAN_ACTIVE") {
    const is_mine = call.assigned_staff_id === current_staff_id;
    return (
      <Banner tone="info" icon={<Hand aria-hidden />}>
        {is_mine ? (
          <>
            <strong className="font-semibold">You have the call.</strong> The AI is silent until you hand it back. Type a reply below or use your microphone.
          </>
        ) : (
          <>
            <strong className="font-semibold">{call.assigned_staff_name ?? "A colleague"} has the call.</strong> The AI is silent until they hand it back.
          </>
        )}
      </Banner>
    );
  }
  if (call.status === "ENDED") {
    return (
      <Banner tone="neutral" icon={<Info aria-hidden />}>
        This call has ended. Its full trail is in the audit log and call replay.
      </Banner>
    );
  }
  return null;
}
