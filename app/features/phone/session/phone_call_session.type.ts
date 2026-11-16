import type { CallRoomState } from "@/features/voice/livekit/call_room.type";
import type { CallCommand, CallTurn, TranscriptDelta } from "@/shared/types/call.type";

export type CaptionSpeaker = "AI" | "CUSTOMER" | "STAFF" | "SYSTEM";

/**
 * One line of the live captions on the phone. For a caption id already on
 * screen, a final caption replaces the text and a non-final one (a streaming
 * delta) is appended to it.
 */
export interface PhoneCaption {
  caption_id: string;
  speaker: CaptionSpeaker;
  text: string;
  is_final: boolean;
}

export interface PhoneCallSessionListeners {
  onCaption: (caption: PhoneCaption) => void;
  /** The call's audio room changed: who is in it, who is speaking, the microphone. */
  onAudioChanged: (room_state: CallRoomState) => void;
  /** The conversation finished on its own: the script completed or staff ended the call. */
  onEnded: () => void;
  onFailed: (error: unknown) => void;
}

export interface PhoneCallSessionOptions {
  call_id: string;
  is_customer_male: boolean;
  listeners: PhoneCallSessionListeners;
}

/** What drives the customer's side of a call: the scripted replay or the live voice agent. */
export interface PhoneCallSession {
  start: () => Promise<void>;
  handleCommand: (command: CallCommand) => void;
  /**
   * A turn `core` stored for this call, and the AI's text as it streams. Only
   * a live call captions from these: the scripted runner captions its own lines.
   */
  handleTurn?: (turn: CallTurn) => void;
  handleTranscriptDelta?: (transcript_delta: TranscriptDelta) => void;
  /** From a click, when the browser blocked the call audio from autoplaying. */
  unlockAudio: () => void;
  setMicrophoneMuted: (is_muted: boolean) => void;
  stop: () => void;
}
