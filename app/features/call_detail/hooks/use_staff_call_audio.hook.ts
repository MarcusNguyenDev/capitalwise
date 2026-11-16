"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { MicrophoneUnavailableError } from "@/features/voice/errors/microphone_unavailable.error";
import { CallRoom } from "@/features/voice/livekit/call_room.client";
import type { CallRoomCloseReason, CallRoomState } from "@/features/voice/livekit/call_room.type";
import { createStaffVoiceToken } from "@/shared/api_client/core_api.client";
import { describeError } from "@/shared/http/service_request.error";
import { useCurrentStaff } from "@/shared/staff/current_staff.provider";
import type { LiveCall } from "@/shared/types/call.type";

export type StaffListenState = "OFF" | "CONNECTING" | "ON";
export type StaffTalkState = "OFF" | "CONNECTING" | "LIVE";

const NO_MICROPHONE_NOTICE = "No microphone available. Type your replies and they will be spoken to the customer.";

const CLOSE_NOTICES: Record<CallRoomCloseReason, string | null> = {
  ROOM_DELETED: null,
  CONNECTION_LOST: "The call audio connection dropped.",
  REPLACED: "You opened this call's audio in another tab.",
};

interface StaffRoomConnection {
  call_room: CallRoom;
  /** Tokens are minted per purpose: listening cannot publish, talking can. */
  can_publish: boolean;
}

function releaseRoom(connection_ref: RefObject<StaffRoomConnection | null>): void {
  const connection = connection_ref.current;
  connection_ref.current = null;
  void connection?.call_room.leave();
}

export interface StaffCallAudio {
  /** Simulated calls have no audio to listen to. */
  can_use_audio: boolean;
  listen_state: StaffListenState;
  talk_state: StaffTalkState;
  room_state: CallRoomState | null;
  /** Why listening or talking stopped or is not possible; typed replies still work. */
  notice: string | null;
  startListening: () => void;
  stopListening: () => void;
  startTalking: () => void;
  stopTalking: () => void;
  unlockAudio: () => void;
}

/**
 * The supervisor's place in a call's LiveKit room. "Listen" joins with a
 * listen-only token and plays the customer and the AI; after a takeover
 * "Talk" rejoins with a publishing token and sends the microphone. Handing
 * back or the call ending stops the microphone.
 */
export function useStaffCallAudio(call_id: string, call: LiveCall | null): StaffCallAudio {
  const [room_state, setRoomState] = useState<CallRoomState | null>(null);
  const [is_joining, setIsJoining] = useState(false);
  const [is_starting_microphone, setIsStartingMicrophone] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const connection_ref = useRef<StaffRoomConnection | null>(null);
  const { current_staff_id } = useCurrentStaff();
  const is_human_active = call?.status === "HUMAN_ACTIVE";
  const is_call_ended = call?.status === "ENDED";

  const joinRoom = async (can_publish: boolean): Promise<StaffRoomConnection> => {
    releaseRoom(connection_ref);
    const call_room: CallRoom = new CallRoom({
      onStateChanged: (changed_state) => {
        // A released room still reports that it left, unless a newer room has taken its place.
        const is_released_room_leaving = connection_ref.current === null && !changed_state.is_connected;
        if (connection_ref.current?.call_room === call_room || is_released_room_leaving) {
          setRoomState(changed_state);
        }
      },
      onClosed: (close_reason) => {
        if (connection_ref.current?.call_room === call_room) {
          connection_ref.current = null;
          setRoomState(null);
          setNotice(CLOSE_NOTICES[close_reason]);
        }
      },
    });
    const connection = { call_room, can_publish };
    connection_ref.current = connection;
    // Still inside the click on Listen or Talk, so the browser lets the call audio play.
    call_room.unlockAudio();
    try {
      const staff_token = await createStaffVoiceToken({ call_id, staff_id: current_staff_id, can_publish });
      if (connection_ref.current === connection) {
        await call_room.join(staff_token);
      }
      return connection;
    } catch (error) {
      if (connection_ref.current === connection) {
        releaseRoom(connection_ref);
        setRoomState(null);
      }
      throw error;
    }
  };

  const startListening = () => {
    if (connection_ref.current) {
      return;
    }
    setNotice(null);
    setIsJoining(true);
    joinRoom(false)
      .catch((error) => setNotice(`Could not listen in. ${describeError(error)}`))
      .finally(() => setIsJoining(false));
  };

  const stopListening = () => {
    releaseRoom(connection_ref);
    setRoomState(null);
  };

  const startTalking = async () => {
    setNotice(null);
    setIsStartingMicrophone(true);
    try {
      const connection = connection_ref.current?.can_publish ? connection_ref.current : await joinRoom(true);
      await connection.call_room.publishMicrophone();
    } catch (error) {
      setNotice(error instanceof MicrophoneUnavailableError ? NO_MICROPHONE_NOTICE : `Could not open the audio link. ${describeError(error)}`);
    } finally {
      setIsStartingMicrophone(false);
    }
  };

  const stopTalking = () => {
    void connection_ref.current?.call_room.unpublishMicrophone();
  };

  useEffect(() => {
    // Only the staff member who has the call may speak; after a handback the supervisor keeps listening.
    if (!is_human_active) {
      void connection_ref.current?.call_room.unpublishMicrophone();
    }
  }, [is_human_active]);

  useEffect(() => {
    if (is_call_ended) {
      releaseRoom(connection_ref);
    }
  }, [is_call_ended]);

  useEffect(() => {
    // Switching staff or closing the panel must release the microphone and the room.
    return () => releaseRoom(connection_ref);
  }, [call_id, current_staff_id]);

  const is_connected = room_state?.is_connected === true && !is_call_ended;
  const is_microphone_live = is_connected && is_human_active && room_state?.is_microphone_published === true;

  return {
    can_use_audio: call?.channel !== "SIMULATED",
    listen_state: is_connected ? "ON" : is_joining ? "CONNECTING" : "OFF",
    talk_state: is_microphone_live ? "LIVE" : is_starting_microphone ? "CONNECTING" : "OFF",
    room_state: is_connected ? room_state : null,
    notice,
    startListening,
    stopListening,
    startTalking: () => void startTalking(),
    stopTalking,
    unlockAudio: () => connection_ref.current?.call_room.unlockAudio(),
  };
}
