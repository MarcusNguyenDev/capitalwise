import { CallRoomConnectionError } from "@/features/voice/errors/call_room_connection.error";
import { CallRoom } from "@/features/voice/livekit/call_room.client";
import type { CallRoomCloseReason } from "@/features/voice/livekit/call_room.type";
import { createVoiceSession, sendCustomerMessage } from "@/shared/api_client/core_api.client";
import type { CallCommand, CallTurn, TranscriptDelta } from "@/shared/types/call.type";

import { DEFAULT_TAKEOVER_ANNOUNCEMENT } from "../constants/phone_call.constant";
import type { PhoneCallSession, PhoneCallSessionOptions } from "../session/phone_call_session.type";

const CAPTIONED_SPEAKERS = new Set<CallTurn["speaker"]>(["CUSTOMER", "AI", "STAFF"]);

/**
 * A live call with the AI voice agent that runs inside `core`. The phone
 * joins the call's LiveKit room as `customer`, sends the microphone and plays
 * whatever the agent and staff say. `core` records turns, runs tools and acts
 * on supervisor commands; the phone only captions them and updates its screen.
 */
export class LiveVoiceSession implements PhoneCallSession {
  private readonly options: PhoneCallSessionOptions;
  private readonly call_room: CallRoom;
  private is_stopped = false;

  constructor(options: PhoneCallSessionOptions) {
    this.options = options;
    this.call_room = new CallRoom({
      onStateChanged: options.listeners.onAudioChanged,
      onClosed: (close_reason) => this.handleRoomClosed(close_reason),
    });
  }

  async start(): Promise<void> {
    // Still inside the click on Call, so the browser lets the agent's voice play.
    this.call_room.unlockAudio();
    try {
      const voice_session = await createVoiceSession(this.options.call_id);
      if (this.is_stopped) {
        return;
      }
      await this.call_room.join(voice_session);
      if (this.is_stopped) {
        return this.stop();
      }
      await this.call_room.publishMicrophone();
    } catch (error) {
      this.fail(error);
    }
  }

  /** The voice agent in `core` acts on every command; the phone only shows what changed. */
  handleCommand(command: CallCommand): void {
    if (command.command === "TAKEOVER") {
      this.options.listeners.onCaption({
        caption_id: `takeover-${command.intervention_id}`,
        speaker: "SYSTEM",
        text: command.text ?? DEFAULT_TAKEOVER_ANNOUNCEMENT,
        is_final: true,
      });
    } else if (command.command === "END_CALL") {
      this.stop();
      this.options.listeners.onEnded();
    }
  }

  handleTurn(turn: CallTurn): void {
    // Tool calls and supervisor notes are SYSTEM turns: staff-only detail.
    if (!turn.text || !CAPTIONED_SPEAKERS.has(turn.speaker)) {
      return;
    }
    this.options.listeners.onCaption({
      caption_id: `turn-${turn.turn_id}`,
      speaker: turn.speaker as "CUSTOMER" | "AI" | "STAFF",
      text: turn.text,
      is_final: true,
    });
  }

  handleTranscriptDelta(transcript_delta: TranscriptDelta): void {
    this.options.listeners.onCaption({
      caption_id: transcript_delta.item_id,
      speaker: transcript_delta.speaker,
      text: transcript_delta.delta,
      is_final: false,
    });
  }

  /** The voice agent takes it like a transcribed utterance; the caption arrives as the caller's turn. */
  async sendTypedMessage(text: string): Promise<void> {
    await sendCustomerMessage(this.options.call_id, text);
  }

  unlockAudio(): void {
    this.call_room.unlockAudio();
  }

  setMicrophoneMuted(is_muted: boolean): void {
    this.call_room.setMicrophoneMuted(is_muted).catch(() => undefined);
  }

  stop(): void {
    this.is_stopped = true;
    void this.call_room.leave();
  }

  private handleRoomClosed(close_reason: CallRoomCloseReason): void {
    if (this.is_stopped) {
      return;
    }
    // `core` deletes the room when the call ends, whoever ended it.
    if (close_reason === "ROOM_DELETED") {
      this.stop();
      return this.options.listeners.onEnded();
    }
    this.fail(
      new CallRoomConnectionError(
        close_reason === "REPLACED" ? "This call's audio was opened in another tab." : "The call audio connection dropped.",
      ),
    );
  }

  private fail(error: unknown): void {
    if (this.is_stopped) {
      return;
    }
    this.stop();
    this.options.listeners.onFailed(error);
  }
}
