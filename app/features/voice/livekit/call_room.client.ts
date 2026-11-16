import { ConnectionState, DisconnectReason, Room, RoomEvent, Track } from "livekit-client";
import type { RemoteParticipant, RemoteTrack } from "livekit-client";

import type { CallRoomAccess } from "@/shared/types/call.type";

import { CallRoomConnectionError } from "../errors/call_room_connection.error";
import { MicrophoneUnavailableError } from "../errors/microphone_unavailable.error";
import { MICROPHONE_CAPTURE_OPTIONS } from "./call_room.constant";
import type { CallRoomCloseReason, CallRoomListeners, CallRoomParticipant } from "./call_room.type";
import { describeCallRoomRole } from "./describe_call_room_role.util";
import { resolveLivekitUrl } from "./resolve_livekit_url.util";

const ROOM_STATE_EVENTS = [
  RoomEvent.ParticipantConnected,
  RoomEvent.ParticipantDisconnected,
  RoomEvent.ActiveSpeakersChanged,
  RoomEvent.TrackPublished,
  RoomEvent.TrackUnpublished,
  RoomEvent.TrackMuted,
  RoomEvent.TrackUnmuted,
  RoomEvent.LocalTrackPublished,
  RoomEvent.LocalTrackUnpublished,
  RoomEvent.AudioPlaybackStatusChanged,
] as const;

function readCloseReason(disconnect_reason: DisconnectReason | undefined): CallRoomCloseReason {
  if (disconnect_reason === DisconnectReason.ROOM_DELETED) {
    return "ROOM_DELETED";
  }
  return disconnect_reason === DisconnectReason.DUPLICATE_IDENTITY ? "REPLACED" : "CONNECTION_LOST";
}

function describeParticipant(participant: RemoteParticipant): CallRoomParticipant {
  return {
    identity: participant.identity,
    name: participant.name || participant.identity,
    role: describeCallRoomRole(participant.identity),
    is_speaking: participant.isSpeaking,
    has_audio: participant.audioTrackPublications.size > 0,
  };
}

/**
 * One browser's place in a call's LiveKit room: plays every remote audio
 * track through a hidden <audio> element, optionally publishes the microphone,
 * and reports who is in the room and who is speaking.
 */
export class CallRoom {
  private readonly room: Room;
  private readonly listeners: CallRoomListeners;
  private readonly audio_elements = new Map<string, HTMLMediaElement>();
  private is_leaving = false;

  constructor(listeners: CallRoomListeners) {
    this.listeners = listeners;
    this.room = new Room({ audioCaptureDefaults: MICROPHONE_CAPTURE_OPTIONS });
    this.room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => this.playRemoteTrack(track, participant));
    this.room.on(RoomEvent.TrackUnsubscribed, (track) => this.stopRemoteTrack(track));
    this.room.on(RoomEvent.Disconnected, (disconnect_reason) => this.handleDisconnected(disconnect_reason));
    for (const room_event of ROOM_STATE_EVENTS) {
      this.room.on(room_event, () => this.reportState());
    }
  }

  get identity(): string {
    return this.room.localParticipant.identity;
  }

  /**
   * Browsers only play audio after a user gesture. Call this from the click
   * that starts the call (or from a "tap to hear" button).
   */
  unlockAudio(): void {
    this.room.startAudio().catch(() => this.reportState());
  }

  /** Throws CallRoomConnectionError when the room cannot be reached. */
  async join(room_access: Pick<CallRoomAccess, "livekit_url" | "token">): Promise<void> {
    const livekit_url = resolveLivekitUrl(room_access.livekit_url);
    try {
      await this.room.connect(livekit_url, room_access.token, { autoSubscribe: true });
    } catch (error) {
      throw new CallRoomConnectionError(
        `Could not join the call audio at ${livekit_url}. ${error instanceof Error ? error.message : "Is the media server running?"}`,
      );
    }
    console.info("Joined the call audio room", { room_name: this.room.name, identity: this.identity });
    this.unlockAudio();
    this.reportState();
  }

  /** Throws MicrophoneUnavailableError when there is no microphone or permission was declined. */
  async publishMicrophone(): Promise<void> {
    try {
      await this.room.localParticipant.setMicrophoneEnabled(true, MICROPHONE_CAPTURE_OPTIONS);
    } catch {
      throw new MicrophoneUnavailableError();
    }
    this.reportState();
  }

  /** Stops sending the microphone altogether, which also turns off the browser's recording indicator. */
  async unpublishMicrophone(): Promise<void> {
    const microphone_track = this.room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
    if (microphone_track) {
      await this.room.localParticipant.unpublishTrack(microphone_track, true);
    }
    this.reportState();
  }

  async setMicrophoneMuted(is_muted: boolean): Promise<void> {
    const microphone_publication = this.room.localParticipant.getTrackPublication(Track.Source.Microphone);
    if (!microphone_publication) {
      return;
    }
    await (is_muted ? microphone_publication.mute() : microphone_publication.unmute());
    this.reportState();
  }

  /** Leaves the room and releases the microphone and every audio element. Safe to call more than once. */
  async leave(): Promise<void> {
    this.is_leaving = true;
    await this.room.disconnect();
    this.removeAllAudioElements();
    this.reportState();
  }

  private playRemoteTrack(track: RemoteTrack, participant: RemoteParticipant): void {
    if (track.kind !== Track.Kind.Audio || !track.sid) {
      return;
    }
    const audio_element = track.attach();
    audio_element.hidden = true;
    // Lets the page (and a test driver) see whose audio is playing without extra state.
    audio_element.dataset.callRoomIdentity = participant.identity;
    document.body.appendChild(audio_element);
    this.audio_elements.set(track.sid, audio_element);
    this.reportState();
  }

  private stopRemoteTrack(track: RemoteTrack): void {
    // LiveKit may already have detached the track (it does on disconnect), so the element is removed by reference.
    track.detach();
    if (track.sid) {
      this.audio_elements.get(track.sid)?.remove();
      this.audio_elements.delete(track.sid);
    }
    this.reportState();
  }

  private removeAllAudioElements(): void {
    this.audio_elements.forEach((audio_element) => audio_element.remove());
    this.audio_elements.clear();
  }

  private handleDisconnected(disconnect_reason: DisconnectReason | undefined): void {
    this.removeAllAudioElements();
    this.reportState();
    if (!this.is_leaving) {
      this.listeners.onClosed(readCloseReason(disconnect_reason));
    }
  }

  private reportState(): void {
    const local_participant = this.room.localParticipant;
    const microphone_publication = local_participant.getTrackPublication(Track.Source.Microphone);
    this.listeners.onStateChanged({
      is_connected: this.room.state === ConnectionState.Connected,
      participants: [...this.room.remoteParticipants.values()].map(describeParticipant),
      is_microphone_published: microphone_publication?.track !== undefined,
      is_microphone_muted: microphone_publication?.isMuted ?? false,
      is_local_speaking: local_participant.isSpeaking,
      can_play_audio: this.room.canPlaybackAudio,
    });
  }
}
