"use client";

import type { CallRoomParticipant } from "@/features/voice/livekit/call_room.type";

import type { StaffCallAudio, StaffListenState } from "../hooks/use_staff_call_audio.hook";

const LISTEN_BUTTON_LABELS: Record<StaffListenState, string> = {
  OFF: "Listen",
  CONNECTING: "Connecting…",
  ON: "Listening · Stop",
};

function ParticipantPill({ participant }: { participant: CallRoomParticipant }) {
  return (
    <span
      data-call-room-identity={participant.identity}
      data-is-speaking={participant.is_speaking}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold transition-colors ${participant.is_speaking ? "bg-positive-soft text-positive" : "bg-surface text-ink-soft"}`}
    >
      <span className={`h-2 w-2 rounded-full ${participant.is_speaking ? "animate-pulse bg-positive" : "bg-ink-faint"}`} aria-hidden />
      {participant.name}
    </span>
  );
}

function describeListening(staff_call_audio: StaffCallAudio): string {
  if (!staff_call_audio.can_use_audio) {
    return "Simulated call: there is no audio to listen to.";
  }
  if (staff_call_audio.notice) {
    return staff_call_audio.notice;
  }
  return staff_call_audio.listen_state === "ON" ? "You are listening. The customer cannot hear you." : "Hear the customer and the AI live.";
}

/** Above the transcript: listen in on the call's audio and see who is in the room and who is speaking. */
export function CallAudioBar({ staff_call_audio }: { staff_call_audio: StaffCallAudio }) {
  const is_listening = staff_call_audio.listen_state !== "OFF";
  const room_state = staff_call_audio.room_state;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line px-3 py-2">
      <button
        type="button"
        disabled={!staff_call_audio.can_use_audio}
        aria-pressed={is_listening}
        onClick={is_listening ? staff_call_audio.stopListening : staff_call_audio.startListening}
        className={`flex items-center gap-2 rounded-full px-4 py-1.5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${staff_call_audio.listen_state === "ON" ? "bg-info text-white" : "border border-line bg-white text-ink hover:bg-surface"}`}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${staff_call_audio.listen_state === "ON" ? "bg-white" : staff_call_audio.listen_state === "CONNECTING" ? "animate-pulse bg-warning" : "bg-ink-faint"}`} />
        {LISTEN_BUTTON_LABELS[staff_call_audio.listen_state]}
      </button>
      {room_state ? (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="In the call">
          {room_state.participants.map((participant) => (
            <ParticipantPill key={participant.identity} participant={participant} />
          ))}
        </div>
      ) : (
        <p className={`text-sm ${staff_call_audio.notice ? "text-warning" : "text-ink-soft"}`}>{describeListening(staff_call_audio)}</p>
      )}
      {room_state && !room_state.can_play_audio ? (
        <button type="button" onClick={staff_call_audio.unlockAudio} className="text-sm font-semibold text-info underline">
          Click to hear the call
        </button>
      ) : null}
    </div>
  );
}
