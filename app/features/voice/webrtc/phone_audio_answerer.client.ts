import { StaffAudioPeer } from "./staff_audio_peer.client";

/** Phone side: plays the supervisor's voice and, when the phone has a microphone open, sends the customer's back. */
export class PhoneAudioAnswerer extends StaffAudioPeer {
  async acceptOffer(offer_sdp: string, customer_microphone: MediaStream | null): Promise<void> {
    await this.applyRemoteDescription({ type: "offer", sdp: offer_sdp });
    for (const track of customer_microphone?.getAudioTracks() ?? []) {
      this.peer_connection.addTrack(track, customer_microphone as MediaStream);
    }
    const answer = await this.peer_connection.createAnswer();
    await this.peer_connection.setLocalDescription(answer);
    if (!this.is_closed) {
      this.options.sendSignal({ kind: "answer", sdp: answer.sdp ?? "" });
    }
  }
}
