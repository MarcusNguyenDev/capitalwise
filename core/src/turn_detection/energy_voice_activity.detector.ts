import { measureFrameEnergy } from './measure_frame_energy.util';
import {
  VoiceActivityEvent,
  VoiceActivitySettings,
} from './types/voice_activity_event.type';

const MILLISECONDS_PER_SECOND = 1000;
// The noise floor starts here and never drops below / rises above these.
const INITIAL_NOISE_FLOOR = 120;
const MIN_NOISE_FLOOR = 40;
const MAX_NOISE_FLOOR = 2_500;
// Quiet speech below this level (about -42 dBFS) is never treated as speech.
const MIN_SPEECH_ENERGY = 260;
// How fast the noise floor follows the background (per frame, 10 ms).
const NOISE_FLOOR_ADAPTATION = 0.05;
// Once speaking, the voice may drop to this share of the start threshold
// before it counts as silence (hysteresis keeps soft word endings).
const RELEASE_THRESHOLD_SHARE = 0.5;
// Short dips between syllables do not cancel a starting utterance.
const MAX_START_GAP_MS = 60;
// Silence kept after the last voiced frame, so the last word is not clipped.
const TAIL_SILENCE_MS = 200;

type DetectorState = 'IDLE' | 'STARTING' | 'SPEAKING';

// Energy-based voice activity detection with an adaptive noise floor. It
// turns 16 kHz caller audio into utterances: speech starts after
// `speech_start_ms` above the threshold, the turn ends after
// `end_of_turn_silence_ms` of silence, and `pre_roll_ms` of audio before the
// start is kept so first syllables are not clipped.
export class EnergyVoiceActivityDetector {
  private state: DetectorState = 'IDLE';
  private noise_floor = INITIAL_NOISE_FLOOR;
  private stream_ms = 0;
  private pre_roll_frames: Int16Array[] = [];
  private pre_roll_ms = 0;
  private utterance_frames: Int16Array[] = [];
  private voiced_ms = 0;
  private start_gap_ms = 0;
  private silence_ms = 0;
  private speech_started_at_ms = 0;
  private last_voiced_at_ms = 0;
  private start_threshold = 0;
  private frames_since_last_voice: Int16Array[] = [];
  private speech_energy_sum = 0;
  private speech_frame_count = 0;

  constructor(private readonly settings: VoiceActivitySettings) {}

  get is_in_speech(): boolean {
    return this.state === 'SPEAKING';
  }

  pushFrame(frame: Int16Array): VoiceActivityEvent[] {
    const frame_ms =
      (frame.length / this.settings.sample_rate) * MILLISECONDS_PER_SECOND;
    this.stream_ms += frame_ms;
    const frame_energy = measureFrameEnergy(frame);
    if (this.state === 'SPEAKING') {
      return this.continueSpeech(frame, frame_ms, frame_energy);
    }
    return this.listenForSpeech(frame, frame_ms, frame_energy);
  }

  // Forget any utterance in progress (the agent stopped listening).
  reset(): void {
    this.state = 'IDLE';
    this.utterance_frames = [];
    this.frames_since_last_voice = [];
    this.pre_roll_frames = [];
    this.pre_roll_ms = 0;
    this.voiced_ms = 0;
    this.start_gap_ms = 0;
    this.silence_ms = 0;
    this.speech_energy_sum = 0;
    this.speech_frame_count = 0;
  }

  // 30 s without a pause is a steady noise (a fan, traffic), not a caller:
  // treat its level as the new background so it stops triggering turns.
  private raiseNoiseFloorToSustainedLevel(): void {
    if (this.speech_frame_count === 0) {
      return;
    }
    const sustained_energy = this.speech_energy_sum / this.speech_frame_count;
    this.noise_floor = Math.min(
      Math.max(
        (sustained_energy / this.settings.energy_threshold_ratio) * 1.2,
        this.noise_floor,
      ),
      MAX_NOISE_FLOOR,
    );
  }

  private readStartThreshold(): number {
    return Math.max(
      this.noise_floor * this.settings.energy_threshold_ratio,
      MIN_SPEECH_ENERGY,
    );
  }

  private listenForSpeech(
    frame: Int16Array,
    frame_ms: number,
    frame_energy: number,
  ): VoiceActivityEvent[] {
    const start_threshold = this.readStartThreshold();
    const is_voiced = frame_energy >= start_threshold;
    if (this.state === 'IDLE') {
      if (!is_voiced) {
        this.adaptNoiseFloor(frame_energy);
        this.keepPreRoll(frame, frame_ms);
        return [];
      }
      this.state = 'STARTING';
      this.start_threshold = start_threshold;
      this.speech_started_at_ms = this.stream_ms - frame_ms;
      this.utterance_frames = [];
      this.voiced_ms = 0;
      this.start_gap_ms = 0;
    }
    this.utterance_frames.push(frame);
    if (is_voiced) {
      this.voiced_ms += frame_ms;
      this.start_gap_ms = 0;
    } else {
      this.start_gap_ms += frame_ms;
    }
    if (this.start_gap_ms > MAX_START_GAP_MS) {
      this.abandonStart();
      return [];
    }
    if (this.voiced_ms < this.settings.speech_start_ms) {
      return [];
    }
    this.state = 'SPEAKING';
    this.silence_ms = 0;
    this.last_voiced_at_ms = this.stream_ms;
    this.frames_since_last_voice = [];
    return [{ type: 'speech_started', stream_ms: this.speech_started_at_ms }];
  }

  private continueSpeech(
    frame: Int16Array,
    frame_ms: number,
    frame_energy: number,
  ): VoiceActivityEvent[] {
    this.speech_energy_sum += frame_energy;
    this.speech_frame_count += 1;
    const is_voiced =
      frame_energy >= this.start_threshold * RELEASE_THRESHOLD_SHARE;
    if (is_voiced) {
      this.utterance_frames.push(...this.frames_since_last_voice, frame);
      this.frames_since_last_voice = [];
      this.silence_ms = 0;
      this.last_voiced_at_ms = this.stream_ms;
    } else {
      this.frames_since_last_voice.push(frame);
      this.silence_ms += frame_ms;
    }
    const utterance_ms =
      this.pre_roll_ms + (this.stream_ms - this.speech_started_at_ms);
    if (utterance_ms >= this.settings.max_utterance_ms) {
      this.raiseNoiseFloorToSustainedLevel();
      return [this.finishUtterance(true)];
    }
    if (this.silence_ms >= this.settings.end_of_turn_silence_ms) {
      return [this.finishUtterance(false)];
    }
    return [];
  }

  private finishUtterance(is_truncated: boolean): VoiceActivityEvent {
    const speech_ms = Math.round(
      this.last_voiced_at_ms - this.speech_started_at_ms,
    );
    const tail_frames = this.takeTailFrames();
    const utterance_frames = [
      ...this.pre_roll_frames,
      ...this.utterance_frames,
      ...tail_frames,
    ];
    this.reset();
    if (speech_ms < this.settings.min_utterance_ms) {
      return {
        type: 'utterance_discarded',
        speech_ms,
        stream_ms: Math.round(this.stream_ms),
      };
    }
    return {
      type: 'utterance_ended',
      pcm: this.joinFrames(utterance_frames),
      speech_ms,
      stream_ms: Math.round(this.stream_ms),
      is_truncated,
    };
  }

  private takeTailFrames(): Int16Array[] {
    const tail_frames: Int16Array[] = [];
    let tail_ms = 0;
    for (const silent_frame of this.frames_since_last_voice) {
      if (tail_ms >= TAIL_SILENCE_MS) {
        break;
      }
      tail_frames.push(silent_frame);
      tail_ms +=
        (silent_frame.length / this.settings.sample_rate) *
        MILLISECONDS_PER_SECOND;
    }
    return tail_frames;
  }

  // A false start: its frames become pre-roll for the next attempt.
  private abandonStart(): void {
    const abandoned_frames = this.utterance_frames;
    this.state = 'IDLE';
    this.utterance_frames = [];
    this.voiced_ms = 0;
    this.start_gap_ms = 0;
    for (const abandoned_frame of abandoned_frames) {
      this.keepPreRoll(
        abandoned_frame,
        (abandoned_frame.length / this.settings.sample_rate) *
          MILLISECONDS_PER_SECOND,
      );
    }
  }

  private keepPreRoll(frame: Int16Array, frame_ms: number): void {
    this.pre_roll_frames.push(frame);
    this.pre_roll_ms += frame_ms;
    while (
      this.pre_roll_frames.length > 0 &&
      this.pre_roll_ms - this.measureFrameMs(this.pre_roll_frames[0]) >=
        this.settings.pre_roll_ms
    ) {
      this.pre_roll_ms -= this.measureFrameMs(
        this.pre_roll_frames.shift() as Int16Array,
      );
    }
  }

  private adaptNoiseFloor(frame_energy: number): void {
    const adapted_floor =
      this.noise_floor * (1 - NOISE_FLOOR_ADAPTATION) +
      frame_energy * NOISE_FLOOR_ADAPTATION;
    this.noise_floor = Math.min(
      Math.max(adapted_floor, MIN_NOISE_FLOOR),
      MAX_NOISE_FLOOR,
    );
  }

  private measureFrameMs(frame: Int16Array): number {
    return (frame.length / this.settings.sample_rate) * MILLISECONDS_PER_SECOND;
  }

  private joinFrames(frames: Int16Array[]): Int16Array {
    const total_samples = frames.reduce(
      (sample_total, frame) => sample_total + frame.length,
      0,
    );
    const joined_pcm = new Int16Array(total_samples);
    let write_offset = 0;
    for (const frame of frames) {
      joined_pcm.set(frame, write_offset);
      write_offset += frame.length;
    }
    return joined_pcm;
  }
}
