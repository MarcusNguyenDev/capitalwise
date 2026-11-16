import { playHandoverTone } from "@/features/voice/audio/play_handover_tone.util";
import type { SpeechOutput } from "@/features/voice/speech/speech_output.client";
import { PhoneAudioAnswerer } from "@/features/voice/webrtc/phone_audio_answerer.client";
import type { StaffAudioSignal } from "@/features/voice/webrtc/staff_audio_signal.type";

interface StaffHandoverOptions {
  speech_output: SpeechOutput;
  sendStaffAudioSignal: (signal: StaffAudioSignal) => void;
  /** The customer's open microphone in live mode; null in scripted mode. */
  getCustomerMicrophone: () => MediaStream | null;
}

/**
 * What the customer hears while a staff member has the call: the handover
 * tone and announcement, typed staff replies in the staff voice, and the
 * supervisor's microphone over the direct audio link.
 */
export class StaffHandover {
  private readonly options: StaffHandoverOptions;
  private audio_answerer: PhoneAudioAnswerer | null = null;

  constructor(options: StaffHandoverOptions) {
    this.options = options;
  }

  async announceTakeover(announcement: string): Promise<void> {
    await playHandoverTone();
    await this.options.speech_output.speak(announcement, "AI");
  }

  speakStaffMessage(text: string): Promise<void> {
    return this.options.speech_output.speak(text, "STAFF");
  }

  handleStaffAudioSignal(signal: StaffAudioSignal): void {
    if (signal.kind === "offer") {
      void this.answerOffer(signal.sdp);
    } else if (signal.kind === "ice") {
      this.audio_answerer?.addRemoteCandidate(signal.candidate).catch(() => undefined);
    } else if (signal.kind === "hangup") {
      this.closeStaffAudio();
    }
  }

  closeStaffAudio(): void {
    this.audio_answerer?.close();
    this.audio_answerer = null;
  }

  private async answerOffer(offer_sdp: string): Promise<void> {
    this.closeStaffAudio();
    const audio_answerer = new PhoneAudioAnswerer({
      sendSignal: this.options.sendStaffAudioSignal,
      onStateChange: () => undefined,
    });
    this.audio_answerer = audio_answerer;
    try {
      await audio_answerer.acceptOffer(offer_sdp, this.options.getCustomerMicrophone());
    } catch {
      // Without an audio link the supervisor falls back to typed replies, which still reach the customer.
      audio_answerer.close();
    }
  }
}
