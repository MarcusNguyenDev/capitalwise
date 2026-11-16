"use client";

import { useEffect, useRef, useState } from "react";

import { MicrophoneUnavailableError } from "@/features/voice/errors/microphone_unavailable.error";
import { StaffAudioOfferer } from "@/features/voice/webrtc/staff_audio_offerer.client";
import type { StaffAudioLinkState, StaffAudioSignal } from "@/features/voice/webrtc/staff_audio_signal.type";
import { LIVE_EVENT, LIVE_MESSAGE } from "@/shared/live/live_event_names.constant";
import { useLiveSocket } from "@/shared/live/live_socket.provider";
import { useLiveEvent } from "@/shared/live/use_live_event.hook";
import { useCurrentStaff } from "@/shared/staff/current_staff.provider";
import type { WebrtcSignal } from "@/shared/types/call.type";

export type StaffTalkState = "OFF" | "CONNECTING" | "LIVE";

const NO_MICROPHONE_NOTICE = "No microphone available. Type your replies and they will be spoken to the customer.";
const NO_AUDIO_LINK_NOTICE = "Could not reach the customer's phone for audio. Type your replies and they will be spoken to the customer.";

export interface StaffTalk {
  talk_state: StaffTalkState;
  /** Why speaking is not possible right now; typed replies still work. */
  fallback_notice: string | null;
  startTalking: () => void;
  stopTalking: () => void;
}

/** Streams the supervisor's microphone to the customer's phone over a direct WebRTC link signalled through the socket. */
export function useStaffTalk(call_id: string): StaffTalk {
  const [talk_state, setTalkState] = useState<StaffTalkState>("OFF");
  const [fallback_notice, setFallbackNotice] = useState<string | null>(null);
  const audio_offerer_ref = useRef<StaffAudioOfferer | null>(null);
  const { socket } = useLiveSocket();
  const { current_staff } = useCurrentStaff();

  const stopTalking = () => {
    audio_offerer_ref.current?.close();
    audio_offerer_ref.current = null;
    setTalkState("OFF");
  };

  const fallBackToTyping = (notice: string) => {
    stopTalking();
    setFallbackNotice(notice);
  };

  const handleLinkState = (audio_offerer: StaffAudioOfferer, link_state: StaffAudioLinkState) => {
    if (audio_offerer_ref.current !== audio_offerer) {
      return;
    }
    if (link_state === "CONNECTED") {
      setTalkState("LIVE");
    } else if (link_state === "FAILED") {
      fallBackToTyping(NO_AUDIO_LINK_NOTICE);
    } else if (link_state === "CLOSED") {
      audio_offerer_ref.current = null;
      setTalkState("OFF");
    }
  };

  const startTalking = () => {
    if (audio_offerer_ref.current || !socket) {
      return;
    }
    setFallbackNotice(null);
    setTalkState("CONNECTING");
    const audio_offerer: StaffAudioOfferer = new StaffAudioOfferer({
      staff_name: current_staff?.name ?? "A specialist",
      sendSignal: (signal) => socket.emit(LIVE_MESSAGE.WEBRTC_SIGNAL, { call_id, sender: "STAFF", payload: signal }),
      onStateChange: (link_state) => handleLinkState(audio_offerer, link_state),
    });
    audio_offerer_ref.current = audio_offerer;
    audio_offerer.start().catch((error) => {
      if (audio_offerer_ref.current === audio_offerer) {
        fallBackToTyping(error instanceof MicrophoneUnavailableError ? NO_MICROPHONE_NOTICE : NO_AUDIO_LINK_NOTICE);
      }
    });
  };

  useLiveEvent<WebrtcSignal>(LIVE_EVENT.WEBRTC_SIGNAL, (webrtc_signal) => {
    if (webrtc_signal.sender === "PHONE" && webrtc_signal.call_id === call_id) {
      audio_offerer_ref.current?.handleSignal(webrtc_signal.payload as StaffAudioSignal).catch(() => fallBackToTyping(NO_AUDIO_LINK_NOTICE));
    }
  });

  useEffect(() => {
    // Closing the panel or switching calls must release the microphone.
    return () => audio_offerer_ref.current?.close();
  }, []);

  return { talk_state, fallback_notice, startTalking, stopTalking };
}
