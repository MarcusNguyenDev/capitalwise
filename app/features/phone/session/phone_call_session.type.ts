import type { StaffAudioSignal } from "@/features/voice/webrtc/staff_audio_signal.type";
import type { CallCommand } from "@/shared/types/call.type";

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
  /** The conversation finished on its own: the script completed or staff ended the call. */
  onEnded: () => void;
  onFailed: (error: unknown) => void;
}

export interface PhoneCallSessionOptions {
  call_id: string;
  is_customer_male: boolean;
  sendStaffAudioSignal: (signal: StaffAudioSignal) => void;
  listeners: PhoneCallSessionListeners;
}

/** What drives the customer's side of a call: the scripted replay or the live voice model. */
export interface PhoneCallSession {
  start: () => Promise<void>;
  handleCommand: (command: CallCommand) => void;
  handleStaffAudioSignal: (signal: StaffAudioSignal) => void;
  stop: () => void;
}
