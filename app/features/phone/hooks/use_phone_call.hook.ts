"use client";

import { useEffect, useRef, useState } from "react";

import type { StaffAudioSignal } from "@/features/voice/webrtc/staff_audio_signal.type";
import { endCall, fetchScriptedCall, startCall } from "@/shared/api_client/core_api.client";
import { useDemoConfig } from "@/shared/demo/demo_config.provider";
import { describeError } from "@/shared/http/service_request.error";
import { LIVE_EVENT, LIVE_MESSAGE } from "@/shared/live/live_event_names.constant";
import { useLiveSocket } from "@/shared/live/live_socket.provider";
import { useLiveEvent } from "@/shared/live/use_live_event.hook";
import type { CallCommand, CallMode, CallScript, LiveCall, WebrtcSignal } from "@/shared/types/call.type";
import type { Caller } from "@/shared/types/resources.type";
import { useToast } from "@/shared/ui/toast.provider";

import { findHeroPersona } from "../constants/hero_persona.constant";
import { CALL_ENDED_SCREEN_MS } from "../constants/phone_call.constant";
import { LiveVoiceSession } from "../live/live_voice_session.client";
import { ScriptedCallRunner } from "../scripted/scripted_call_runner.client";
import type { PhoneCallSession, PhoneCallSessionOptions, PhoneCaption } from "../session/phone_call_session.type";
import { updateCaptions } from "../session/update_captions.util";

export type CallPhase = "IDLE" | "CONNECTING" | "IN_CALL" | "ENDED";

interface ActiveSession {
  call_id: string;
  session: PhoneCallSession;
}

interface SessionContext {
  call: LiveCall;
  caller: Caller;
  call_mode: CallMode;
  /** Loaded before the call starts so a missing script never leaves a call open. */
  script: CallScript | null;
}

interface PhoneCallOptions {
  hasScript: (customer_id: string) => boolean;
  /** Called when a failed live call is restarted in scripted mode, so the mode switch follows. */
  onSwitchToScripted: () => void;
}

export interface PhoneCall {
  call_phase: CallPhase;
  active_call: LiveCall | null;
  call_mode: CallMode | null;
  captions: PhoneCaption[];
  human_staff_name: string | null;
  connected_at_ms: number | null;
  placeCall: (caller: Caller, call_mode: CallMode) => Promise<void>;
  hangUp: () => void;
}

// Read in the call handler, never during render; kept outside the hook so the purity lint rule can tell.
function readCurrentTimeMs(): number {
  return Date.now();
}

function readFirstName(full_name: string): string {
  return full_name.trim().split(" ")[0] || "a specialist";
}

/** The customer's side of one call at a time: placing it, running the session, reacting to staff commands. */
export function usePhoneCall(options: PhoneCallOptions): PhoneCall {
  const [call_phase, setCallPhase] = useState<CallPhase>("IDLE");
  const [active_call, setActiveCall] = useState<LiveCall | null>(null);
  const [call_mode, setCallMode] = useState<CallMode | null>(null);
  const [captions, setCaptions] = useState<PhoneCaption[]>([]);
  const [human_staff_name, setHumanStaffName] = useState<string | null>(null);
  const [connected_at_ms, setConnectedAtMs] = useState<number | null>(null);
  const active_session_ref = useRef<ActiveSession | null>(null);
  const { socket, joinRooms } = useLiveSocket();
  const { bank_name } = useDemoConfig();
  const { showToast } = useToast();

  const isCurrentCall = (call_id: string) => active_session_ref.current?.call_id === call_id;

  const showEndedScreen = (call_id: string) => {
    if (!isCurrentCall(call_id)) {
      return;
    }
    active_session_ref.current = null;
    setHumanStaffName(null);
    setCallPhase("ENDED");
    setTimeout(() => setCallPhase((current_phase) => (current_phase === "ENDED" ? "IDLE" : current_phase)), CALL_ENDED_SCREEN_MS);
  };

  const abandonCall = (call_id: string) => {
    if (!isCurrentCall(call_id)) {
      return;
    }
    active_session_ref.current = null;
    setCallPhase("IDLE");
    setActiveCall(null);
    endCall(call_id, "SYSTEM").catch(() => undefined);
  };

  const offerScriptedMode = (caller: Caller, error: unknown) => {
    const can_use_script = options.hasScript(caller.customer_id);
    showToast({
      title: "Live voice is not available",
      description: can_use_script
        ? `${describeError(error)} Scripted mode replays this call through the same pipeline.`
        : `${describeError(error)} This caller has no scripted call; pick one of the hero callers.`,
      tone: "error",
      is_sticky: can_use_script,
      action_label: can_use_script ? "Switch to Scripted mode" : undefined,
      onAction: () => {
        options.onSwitchToScripted();
        void placeCall(caller, "SCRIPTED");
      },
    });
  };

  const handleSessionFailure = (session_context: SessionContext, error: unknown) => {
    abandonCall(session_context.call.call_id);
    if (session_context.call_mode === "LIVE") {
      offerScriptedMode(session_context.caller, error);
    } else {
      showToast({ title: "The call stopped unexpectedly", description: describeError(error), tone: "error" });
    }
  };

  const createSession = (session_context: SessionContext): PhoneCallSession => {
    const { call, caller, script } = session_context;
    const session_options: PhoneCallSessionOptions = {
      call_id: call.call_id,
      is_customer_male: findHeroPersona(caller.customer_id)?.is_male ?? false,
      sendStaffAudioSignal: (signal: StaffAudioSignal) => {
        socket?.emit(LIVE_MESSAGE.WEBRTC_SIGNAL, { call_id: call.call_id, sender: "PHONE", payload: signal });
      },
      listeners: {
        onCaption: (caption) => setCaptions((current_captions) => updateCaptions(current_captions, caption)),
        onEnded: () => showEndedScreen(call.call_id),
        onFailed: (error) => handleSessionFailure(session_context, error),
      },
    };
    if (!script) {
      return new LiveVoiceSession({
        ...session_options,
        sendTranscriptDelta: (transcript_delta) => socket?.emit(LIVE_MESSAGE.TRANSCRIPT_DELTA, transcript_delta),
      });
    }
    return new ScriptedCallRunner({ ...session_options, script, bank_name });
  };

  const placeCall = async (caller: Caller, requested_mode: CallMode): Promise<void> => {
    if (active_session_ref.current) {
      return;
    }
    setCallPhase("CONNECTING");
    setCallMode(requested_mode);
    setCaptions([]);
    setHumanStaffName(null);
    try {
      const script = requested_mode === "SCRIPTED" ? await fetchScriptedCall(caller.customer_id) : null;
      const call = await startCall({ caller_number: caller.mobile_phone, channel: "BROWSER", mode: requested_mode });
      joinRooms({ role: "PHONE", customer_id: caller.customer_id, call_id: call.call_id });
      const session = createSession({ call, caller, call_mode: requested_mode, script });
      active_session_ref.current = { call_id: call.call_id, session };
      setActiveCall(call);
      setConnectedAtMs(readCurrentTimeMs());
      setCallPhase("IN_CALL");
      void session.start();
    } catch (error) {
      setCallPhase("IDLE");
      showToast({ title: "Could not place the call", description: describeError(error), tone: "error" });
    }
  };

  const hangUp = () => {
    const active_session = active_session_ref.current;
    if (!active_session) {
      return;
    }
    active_session.session.stop();
    endCall(active_session.call_id, "CUSTOMER").catch(() => undefined);
    showEndedScreen(active_session.call_id);
  };

  useLiveEvent<CallCommand>(LIVE_EVENT.CALL_COMMAND, (command) => {
    const active_session = active_session_ref.current;
    if (!active_session || command.call_id !== active_session.call_id) {
      return;
    }
    if (command.command === "TAKEOVER") {
      setHumanStaffName(readFirstName(command.staff_name));
    } else if (command.command === "HANDBACK") {
      setHumanStaffName(null);
    }
    active_session.session.handleCommand(command);
  });

  useLiveEvent<WebrtcSignal>(LIVE_EVENT.WEBRTC_SIGNAL, (webrtc_signal) => {
    const active_session = active_session_ref.current;
    if (active_session && webrtc_signal.sender === "STAFF" && webrtc_signal.call_id === active_session.call_id) {
      active_session.session.handleStaffAudioSignal(webrtc_signal.payload as StaffAudioSignal);
    }
  });

  useLiveEvent<LiveCall>([LIVE_EVENT.CALL_UPDATED, LIVE_EVENT.CALL_ENDED], (call) => {
    const active_session = active_session_ref.current;
    if (!active_session || call.call_id !== active_session.call_id) {
      return;
    }
    setActiveCall(call);
    if (call.status === "ENDED") {
      active_session.session.stop();
      showEndedScreen(call.call_id);
    }
  });

  useLiveEvent(LIVE_EVENT.DEMO_RESET, () => {
    const active_session = active_session_ref.current;
    if (active_session) {
      active_session.session.stop();
      showEndedScreen(active_session.call_id);
    }
  });

  useEffect(() => {
    // Leaving the page must silence speech and release the microphone.
    return () => active_session_ref.current?.session.stop();
  }, []);

  return { call_phase, active_call, call_mode, captions, human_staff_name, connected_at_ms, placeCall, hangUp };
}
