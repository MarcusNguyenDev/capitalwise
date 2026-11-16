import { STAFF_AUDIO_ICE_SERVERS } from "./staff_audio_link.constant";
import type { StaffAudioLinkState, StaffAudioSignal } from "./staff_audio_signal.type";

export interface StaffAudioPeerOptions {
  sendSignal: (signal: StaffAudioSignal) => void;
  onStateChange: (link_state: StaffAudioLinkState) => void;
}

/** What both ends of the staff audio link share: ICE trickling, remote audio playback and teardown. */
export class StaffAudioPeer {
  protected readonly peer_connection: RTCPeerConnection;
  protected readonly options: StaffAudioPeerOptions;
  protected is_closed = false;
  private readonly remote_audio = new Audio();
  // Candidates can arrive before the remote description; adding them early throws.
  private readonly queued_candidates: RTCIceCandidateInit[] = [];

  constructor(options: StaffAudioPeerOptions) {
    this.options = options;
    this.peer_connection = new RTCPeerConnection({ iceServers: STAFF_AUDIO_ICE_SERVERS });
    this.peer_connection.onicecandidate = (ice_event) => this.sendLocalCandidate(ice_event.candidate);
    this.peer_connection.ontrack = (track_event) => this.playRemoteTrack(track_event);
    this.peer_connection.onconnectionstatechange = () => this.reportConnectionState();
  }

  async addRemoteCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (this.is_closed) {
      return;
    }
    if (!this.peer_connection.remoteDescription) {
      this.queued_candidates.push(candidate);
      return;
    }
    await this.peer_connection.addIceCandidate(candidate);
  }

  close(): void {
    if (this.is_closed) {
      return;
    }
    this.is_closed = true;
    this.remote_audio.srcObject = null;
    this.peer_connection.close();
    this.options.onStateChange("CLOSED");
  }

  protected async applyRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    await this.peer_connection.setRemoteDescription(description);
    for (const candidate of this.queued_candidates.splice(0)) {
      await this.peer_connection.addIceCandidate(candidate);
    }
  }

  private sendLocalCandidate(candidate: RTCIceCandidate | null): void {
    if (candidate) {
      this.options.sendSignal({ kind: "ice", candidate: candidate.toJSON() });
    }
  }

  private playRemoteTrack(track_event: RTCTrackEvent): void {
    this.remote_audio.srcObject = track_event.streams[0] ?? new MediaStream([track_event.track]);
    // Playback can be blocked until the page has had a click; the call button provides one.
    this.remote_audio.play().catch(() => undefined);
  }

  private reportConnectionState(): void {
    if (this.is_closed) {
      return;
    }
    const connection_state = this.peer_connection.connectionState;
    if (connection_state === "connected") {
      this.options.onStateChange("CONNECTED");
    } else if (connection_state === "failed") {
      this.options.onStateChange("FAILED");
    }
  }
}
