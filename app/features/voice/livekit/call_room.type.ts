export type CallRoomRole = "CUSTOMER" | "AI_SPECIALIST" | "STAFF";

export interface CallRoomParticipant {
  identity: string;
  /** Display name from the token, e.g. "Sarah Mitchell", "AI specialist", "Alex Chen". */
  name: string;
  role: CallRoomRole;
  is_speaking: boolean;
  has_audio: boolean;
}

/** What the page shows about the call's audio. Every change is reported through `onStateChanged`. */
export interface CallRoomState {
  is_connected: boolean;
  /** Everyone else in the room. */
  participants: CallRoomParticipant[];
  is_microphone_published: boolean;
  is_microphone_muted: boolean;
  is_local_speaking: boolean;
  /** False when the browser blocked autoplay; `unlockAudio()` from a click fixes it. */
  can_play_audio: boolean;
}

/** Why the room closed without `leave()`: the call ended on the server, the link dropped, or this identity joined elsewhere. */
export type CallRoomCloseReason = "ROOM_DELETED" | "CONNECTION_LOST" | "REPLACED";

export interface CallRoomListeners {
  onStateChanged: (room_state: CallRoomState) => void;
  onClosed: (close_reason: CallRoomCloseReason) => void;
}
