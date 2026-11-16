import {
  AudioFrame,
  AudioSource,
  AudioStream,
  LocalAudioTrack,
  RemoteParticipant,
  RemoteTrack,
  Room,
  RoomEvent,
  TrackKind,
  TrackPublishOptions,
  TrackSource,
} from '@livekit/rtc-node';
import { Logger } from '@nestjs/common';

import {
  AGENT_OUTPUT_SAMPLE_RATE,
  CALLER_INPUT_SAMPLE_RATE,
} from '../audio/constants/call_audio_format.constant';
import { CUSTOMER_IDENTITY } from '../livekit/constants/call_room.constant';
import { AgentRoom, AgentRoomListeners } from './types/agent_room.type';

const AGENT_TRACK_NAME = 'ai_specialist_voice';

export interface AgentRoomConnection {
  server_url: string;
  token: string;
  room_name: string;
}

// The voice agent's participant in a call room, on @livekit/rtc-node: it
// publishes one 24 kHz mono track and reads only the `customer` participant's
// audio (staff audio goes straight to the phone, the agent ignores it).
export class LivekitAgentRoom implements AgentRoom {
  private readonly logger = new Logger(LivekitAgentRoom.name);
  private readonly room = new Room();
  private readonly audio_readers = new Set<
    ReadableStreamDefaultReader<AudioFrame>
  >();
  private audio_source: AudioSource | null = null;
  private is_leaving = false;

  constructor(private readonly connection: AgentRoomConnection) {}

  async join(listeners: AgentRoomListeners): Promise<void> {
    this.room.on(
      RoomEvent.TrackSubscribed,
      (track, _publication, participant) =>
        this.handleTrackSubscribed(track, participant, listeners),
    );
    this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      if (participant.identity === CUSTOMER_IDENTITY) {
        listeners.onCustomerPresenceChanged(false);
      }
    });
    this.room.on(RoomEvent.Disconnected, () => {
      if (!this.is_leaving) {
        listeners.onDisconnected();
      }
    });
    await this.room.connect(this.connection.server_url, this.connection.token, {
      autoSubscribe: true,
      dynacast: false,
    });
    await this.publishAgentTrack();
  }

  async captureFrame(frame: Int16Array): Promise<void> {
    if (!this.audio_source || this.is_leaving) {
      return;
    }
    await this.audio_source.captureFrame(
      new AudioFrame(frame, AGENT_OUTPUT_SAMPLE_RATE, 1, frame.length),
    );
  }

  clearQueue(): void {
    this.audio_source?.clearQueue();
  }

  readQueuedDurationMs(): number {
    return this.audio_source?.queuedDuration ?? 0;
  }

  async leave(): Promise<void> {
    if (this.is_leaving) {
      return;
    }
    this.is_leaving = true;
    for (const audio_reader of this.audio_readers) {
      await audio_reader.cancel().catch(() => undefined);
    }
    this.audio_readers.clear();
    try {
      await this.audio_source?.close();
    } catch (error) {
      this.logger.debug(`Audio source close: ${(error as Error).message}`);
    }
    await this.room.disconnect();
  }

  private async publishAgentTrack(): Promise<void> {
    this.audio_source = new AudioSource(AGENT_OUTPUT_SAMPLE_RATE, 1);
    const agent_track = LocalAudioTrack.createAudioTrack(
      AGENT_TRACK_NAME,
      this.audio_source,
    );
    const publish_options = new TrackPublishOptions();
    publish_options.source = TrackSource.SOURCE_MICROPHONE;
    await this.room.localParticipant?.publishTrack(
      agent_track,
      publish_options,
    );
  }

  private handleTrackSubscribed(
    track: RemoteTrack,
    participant: RemoteParticipant,
    listeners: AgentRoomListeners,
  ): void {
    if (
      participant.identity !== CUSTOMER_IDENTITY ||
      track.kind !== TrackKind.KIND_AUDIO
    ) {
      return;
    }
    listeners.onCustomerPresenceChanged(true);
    void this.readCustomerAudio(track, listeners);
  }

  private async readCustomerAudio(
    track: RemoteTrack,
    listeners: AgentRoomListeners,
  ): Promise<void> {
    const audio_stream = new AudioStream(track, {
      sampleRate: CALLER_INPUT_SAMPLE_RATE,
      numChannels: 1,
    });
    const audio_reader = audio_stream.getReader();
    this.audio_readers.add(audio_reader);
    try {
      while (!this.is_leaving) {
        const { done, value } = await audio_reader.read();
        if (done) {
          break;
        }
        // The frame's buffer belongs to the native side: copy it.
        listeners.onCustomerAudioFrame(new Int16Array(value.data));
      }
    } catch (error) {
      if (!this.is_leaving) {
        this.logger.warn(
          `Customer audio stream in ${this.connection.room_name} failed: ${(error as Error).message}`,
        );
      }
    } finally {
      this.audio_readers.delete(audio_reader);
    }
  }
}
