"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { CALL_EVENTS, LIVE_EVENT } from "@/shared/live/live_event_names.constant";
import { useLiveEvent } from "@/shared/live/use_live_event.hook";
import type { LiveCall } from "@/shared/types/call.type";
import { useToast } from "@/shared/ui/toast.provider";

function describeAttention(call: LiveCall): string {
  return `${call.customer_name ?? "A caller"} needs attention`;
}

/**
 * Tells staff the moment a call starts waiting for a person: a screen-reader
 * announcement everywhere, and a toast with "Open call" on any page other
 * than the call itself. Each call is announced once per wait.
 */
export function AttentionAlerts() {
  const router = useRouter();
  const { showToast } = useToast();
  const [announcement, setAnnouncement] = useState("");
  const announced_call_ids_ref = useRef(new Set<string>());

  useLiveEvent<LiveCall>(CALL_EVENTS, (call) => {
    const announced_call_ids = announced_call_ids_ref.current;
    if (call.status !== "NEEDS_ATTENTION") {
      announced_call_ids.delete(call.call_id);
      return;
    }
    if (announced_call_ids.has(call.call_id)) {
      return;
    }
    announced_call_ids.add(call.call_id);
    setAnnouncement(`${describeAttention(call)}. ${call.attention_reason ?? ""}`);
    const open_call_id = new URLSearchParams(window.location.search).get("call");
    if (window.location.pathname === "/" && open_call_id === call.call_id) {
      return;
    }
    showToast({
      title: describeAttention(call),
      description: call.attention_reason ?? undefined,
      tone: "info",
      action_label: "Open call",
      onAction: () => router.push(`/?call=${call.call_id}`),
    });
  });

  useLiveEvent(LIVE_EVENT.DEMO_RESET, () => announced_call_ids_ref.current.clear());

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {announcement}
    </div>
  );
}
