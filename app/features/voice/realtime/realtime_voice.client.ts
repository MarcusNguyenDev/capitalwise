import { LiveVoiceConnectionError } from "../errors/live_voice_connection.error";
import type { RealtimeClientEvent, RealtimeServerEvent } from "./realtime_event.type";
import { REALTIME_CALLS_URL, REALTIME_EVENTS_CHANNEL_LABEL } from "./realtime_voice.constant";

export interface RealtimeVoiceConnectionOptions {
  /** Ephemeral secret minted by `core`; the real API key never reaches the browser. */
  client_secret: string;
  microphone_stream: MediaStream;
  onReady: () => void;
  onServerEvent: (server_event: RealtimeServerEvent) => void;
  onConnectionLost: (error: LiveVoiceConnectionError) => void;
}

/** The WebRTC session with the realtime voice model: audio both ways plus the JSON events channel. */
export class RealtimeVoiceConnection {
  private readonly options: RealtimeVoiceConnectionOptions;
  private readonly model_audio = new Audio();
  private peer_connection: RTCPeerConnection | null = null;
  private events_channel: RTCDataChannel | null = null;
  private is_closed = false;

  constructor(options: RealtimeVoiceConnectionOptions) {
    this.options = options;
    this.model_audio.autoplay = true;
  }

  async connect(): Promise<void> {
    const peer_connection = new RTCPeerConnection();
    this.peer_connection = peer_connection;
    peer_connection.ontrack = (track_event) => this.playModelAudio(track_event);
    peer_connection.onconnectionstatechange = () => this.reportLostConnection(peer_connection.connectionState);
    for (const track of this.options.microphone_stream.getAudioTracks()) {
      peer_connection.addTrack(track, this.options.microphone_stream);
    }
    this.openEventsChannel(peer_connection);

    const offer = await peer_connection.createOffer();
    await peer_connection.setLocalDescription(offer);
    const answer_sdp = await this.exchangeSessionDescription(offer.sdp ?? "");
    if (!this.is_closed) {
      await peer_connection.setRemoteDescription({ type: "answer", sdp: answer_sdp });
    }
  }

  sendEvent(client_event: RealtimeClientEvent): void {
    if (this.events_channel?.readyState === "open") {
      this.events_channel.send(JSON.stringify(client_event));
    }
  }

  setModelAudioMuted(is_muted: boolean): void {
    this.model_audio.muted = is_muted;
  }

  close(): void {
    this.is_closed = true;
    this.events_channel?.close();
    this.peer_connection?.close();
    this.model_audio.srcObject = null;
  }

  private openEventsChannel(peer_connection: RTCPeerConnection): void {
    const events_channel = peer_connection.createDataChannel(REALTIME_EVENTS_CHANNEL_LABEL);
    this.events_channel = events_channel;
    events_channel.onopen = () => this.options.onReady();
    events_channel.onmessage = (message_event) => this.receiveServerEvent(message_event.data);
    events_channel.onclose = () => this.reportLostConnection("failed");
  }

  private receiveServerEvent(raw_event: unknown): void {
    if (typeof raw_event !== "string") {
      return;
    }
    try {
      this.options.onServerEvent(JSON.parse(raw_event) as RealtimeServerEvent);
    } catch {
      // A malformed event must not take the call down; the next event is independent.
    }
  }

  private async exchangeSessionDescription(offer_sdp: string): Promise<string> {
    let sdp_response: Response;
    try {
      sdp_response = await fetch(REALTIME_CALLS_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.options.client_secret}`, "Content-Type": "application/sdp" },
        body: offer_sdp,
      });
    } catch {
      throw new LiveVoiceConnectionError("Could not reach the voice model. Check the internet connection.");
    }
    if (!sdp_response.ok) {
      throw new LiveVoiceConnectionError(`The voice model refused the connection (HTTP ${sdp_response.status}).`);
    }
    return sdp_response.text();
  }

  private playModelAudio(track_event: RTCTrackEvent): void {
    this.model_audio.srcObject = track_event.streams[0] ?? new MediaStream([track_event.track]);
    this.model_audio.play().catch(() => undefined);
  }

  private reportLostConnection(connection_state: RTCPeerConnectionState): void {
    if (!this.is_closed && connection_state === "failed") {
      this.options.onConnectionLost(new LiveVoiceConnectionError("The live voice connection dropped."));
    }
  }
}
