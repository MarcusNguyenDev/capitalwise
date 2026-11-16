import { playHandoverTone } from "@/features/voice/audio/play_handover_tone.util";
import { CallRoom } from "@/features/voice/livekit/call_room.client";
import type { CallRoomState } from "@/features/voice/livekit/call_room.type";
import type { SpeechOutput } from "@/features/voice/speech/speech_output.client";
import { createVoiceSession } from "@/shared/api_client/core_api.client";
import { describeError } from "@/shared/http/service_request.error";

interface StaffHandoverOptions {
  call_id: string;
  speech_output: SpeechOutput;
  onAudioChanged: (room_state: CallRoomState) => void;
}

/**
 * The staff side of a scripted call: the handover tone and announcement,
 * typed staff replies in the staff voice, and the supervisor's own voice,
 * which arrives over the call's LiveKit room. The phone listens from the
 * start and only sends its microphone while a staff member has the call.
 */
export class StaffHandover {
  private readonly options: StaffHandoverOptions;
  private readonly call_room: CallRoom;
  private is_closed = false;

  constructor(options: StaffHandoverOptions) {
    this.options = options;
    this.call_room = new CallRoom({ onStateChanged: options.onAudioChanged, onClosed: () => undefined });
  }

  /** Without the room the supervisor falls back to typed replies, so a failure here never stops the call. */
  async joinCallAudio(): Promise<void> {
    this.call_room.unlockAudio();
    try {
      const voice_session = await createVoiceSession(this.options.call_id);
      if (!this.is_closed) {
        await this.call_room.join(voice_session);
      }
    } catch (error) {
      console.warn("Scripted call continues without staff audio", { call_id: this.options.call_id, message: describeError(error) });
    }
  }

  async announceTakeover(announcement: string): Promise<void> {
    await playHandoverTone();
    await this.options.speech_output.speak(announcement, "AI");
    // The presenter's microphone lets the supervisor hear the customer; typed replies still work without one.
    await this.call_room.publishMicrophone().catch(() => undefined);
  }

  speakStaffMessage(text: string): Promise<void> {
    return this.options.speech_output.speak(text, "STAFF");
  }

  endTakeover(): void {
    this.call_room.unpublishMicrophone().catch(() => undefined);
  }

  unlockAudio(): void {
    this.call_room.unlockAudio();
  }

  setMicrophoneMuted(is_muted: boolean): void {
    this.call_room.setMicrophoneMuted(is_muted).catch(() => undefined);
  }

  close(): void {
    this.is_closed = true;
    void this.call_room.leave();
  }
}
