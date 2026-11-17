import { Headphones } from "lucide-react";

import { Button } from "@/shared/ui/button.component";

import type { StaffCallAudio, StaffListenState } from "../hooks/use_staff_call_audio.hook";

const LISTEN_LABELS: Record<StaffListenState, string> = { OFF: "Listen in", CONNECTING: "Connecting…", ON: "Stop listening" };

/** Hear the customer and the AI live. The customer cannot hear you. */
export function ListenButton({ staff_call_audio }: { staff_call_audio: StaffCallAudio }) {
  const is_listening = staff_call_audio.listen_state !== "OFF";
  return (
    <Button
      aria-pressed={is_listening}
      icon={<Headphones className={staff_call_audio.listen_state === "ON" ? "size-4 text-info" : "size-4"} aria-hidden />}
      is_loading={staff_call_audio.listen_state === "CONNECTING"}
      onClick={is_listening ? staff_call_audio.stopListening : staff_call_audio.startListening}
    >
      {LISTEN_LABELS[staff_call_audio.listen_state]}
    </Button>
  );
}
