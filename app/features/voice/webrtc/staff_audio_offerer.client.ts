import { requestMicrophone, stopMediaStream } from "../audio/request_microphone.util";
import { STAFF_AUDIO_ANSWER_TIMEOUT_MS } from "./staff_audio_link.constant";
import { StaffAudioPeer } from "./staff_audio_peer.client";
import type { StaffAudioPeerOptions } from "./staff_audio_peer.client";
import type { StaffAudioSignal } from "./staff_audio_signal.type";

/** Supervisor side: captures the staff microphone and offers it to the customer's phone. */
export class StaffAudioOfferer extends StaffAudioPeer {
  private microphone_stream: MediaStream | null = null;
  private answer_timer: ReturnType<typeof setTimeout> | null = null;
  private readonly staff_name: string;

  constructor(options: StaffAudioPeerOptions & { staff_name: string }) {
    super(options);
    this.staff_name = options.staff_name;
  }

  /** Throws MicrophoneUnavailableError when there is no microphone to share. */
  async start(): Promise<void> {
    this.options.onStateChange("CONNECTING");
    this.microphone_stream = await requestMicrophone();
    if (this.is_closed) {
      stopMediaStream(this.microphone_stream);
      return;
    }
    for (const track of this.microphone_stream.getAudioTracks()) {
      this.peer_connection.addTrack(track, this.microphone_stream);
    }
    const offer = await this.peer_connection.createOffer();
    await this.peer_connection.setLocalDescription(offer);
    this.options.sendSignal({ kind: "offer", sdp: offer.sdp ?? "", staff_name: this.staff_name });
    this.answer_timer = setTimeout(() => this.options.onStateChange("FAILED"), STAFF_AUDIO_ANSWER_TIMEOUT_MS);
  }

  async handleSignal(signal: StaffAudioSignal): Promise<void> {
    if (signal.kind === "answer") {
      this.clearAnswerTimer();
      await this.applyRemoteDescription({ type: "answer", sdp: signal.sdp });
    } else if (signal.kind === "ice") {
      await this.addRemoteCandidate(signal.candidate);
    } else if (signal.kind === "hangup") {
      this.close();
    }
  }

  close(): void {
    if (this.is_closed) {
      return;
    }
    this.clearAnswerTimer();
    stopMediaStream(this.microphone_stream);
    this.options.sendSignal({ kind: "hangup" });
    super.close();
  }

  private clearAnswerTimer(): void {
    if (this.answer_timer) {
      clearTimeout(this.answer_timer);
      this.answer_timer = null;
    }
  }
}
