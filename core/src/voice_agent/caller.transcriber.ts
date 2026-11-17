import { TranscriptionResult } from '../ai/types/transcription.type';
import { TranscriptionStream } from '../ai/types/transcription_stream.type';
import {
  AUDIO_FRAME_MS,
  CALLER_INPUT_SAMPLE_RATE,
} from '../audio/constants/call_audio_format.constant';

// Covers the turn detector's pre-roll (300 ms) plus its speech-start time
// (200 ms) plus slack: everything before "speech started" that belongs to
// the turn.
const RECENT_AUDIO_MS = 600;
const RECENT_FRAME_LIMIT = RECENT_AUDIO_MS / AUDIO_FRAME_MS;

export interface CallerTranscriberDependencies {
  call_id: string;
  transcription_stream: TranscriptionStream;
  // Partial transcript of the turn being spoken, for live captions.
  emitDelta: (delta: string, item_id: string) => void;
}

// Streams the caller's speech to speech-to-text while they talk, so the
// transcript is ready moments after they stop. Only speech is sent: audio
// goes out from just before the turn detector heard speech start until the
// turn ends (silence is never streamed or billed).
export class CallerTranscriber {
  private readonly recent_frames: Int16Array[] = [];
  private readonly unsubscribeDelta: () => void;
  private is_in_turn = false;
  private turn_count = 0;

  constructor(private readonly dependencies: CallerTranscriberDependencies) {
    this.unsubscribeDelta = dependencies.transcription_stream.onDelta((delta) =>
      dependencies.emitDelta(delta, this.readTurnItemId()),
    );
  }

  pushFrame(frame: Int16Array): void {
    this.recent_frames.push(frame);
    if (this.recent_frames.length > RECENT_FRAME_LIMIT) {
      this.recent_frames.shift();
    }
    if (this.is_in_turn) {
      this.appendFrame(frame);
    }
  }

  // Speech started: send the audio that led up to it, then keep streaming.
  beginTurn(): void {
    if (this.is_in_turn) {
      return;
    }
    this.is_in_turn = true;
    this.turn_count += 1;
    this.recent_frames.forEach((frame) => this.appendFrame(frame));
    this.recent_frames.length = 0;
  }

  // The turn ended: its transcript.
  commitTurn(): Promise<TranscriptionResult> {
    this.is_in_turn = false;
    return this.dependencies.transcription_stream.commit();
  }

  // A false start (too short to be speech).
  discardTurn(): void {
    if (!this.is_in_turn) {
      return;
    }
    this.is_in_turn = false;
    this.dependencies.transcription_stream.clear();
  }

  async close(): Promise<void> {
    this.unsubscribeDelta();
    await this.dependencies.transcription_stream.close();
  }

  private appendFrame(frame: Int16Array): void {
    this.dependencies.transcription_stream.appendAudio(
      frame,
      CALLER_INPUT_SAMPLE_RATE,
    );
  }

  private readTurnItemId(): string {
    return `${this.dependencies.call_id}_customer_${this.turn_count}`;
  }
}
