import {
  AGENT_OUTPUT_SAMPLE_RATE,
  AUDIO_FRAME_MS,
} from '../audio/constants/call_audio_format.constant';
import { splitPcmFrames } from '../audio/split_pcm_frames.util';
import { AgentRoom } from './types/agent_room.type';

export interface AudioClip {
  // 24 kHz mono 16-bit PCM.
  pcm: Int16Array;
  // The caller can talk over it (model replies) or not (greeting, hold lines).
  is_interruptible: boolean;
  is_tone?: boolean;
}

interface QueuedClip extends AudioClip {
  settleStarted: (started_at_ms: number | null) => void;
}

// Plays clips one after another on the agent's track, in 10 ms frames.
// Each enqueue resolves when its clip starts playing (with the time), or
// with null when the clip is dropped before it starts.
export class AgentAudioOutput {
  private queued_clips: QueuedClip[] = [];
  private current_clip: QueuedClip | null = null;
  private is_feeding = false;
  private feed_generation = 0;

  constructor(private readonly agent_room: AgentRoom) {}

  get is_playing(): boolean {
    return (
      this.is_feeding ||
      this.queued_clips.length > 0 ||
      this.agent_room.readQueuedDurationMs() > 0
    );
  }

  enqueue(audio_clip: AudioClip): Promise<number | null> {
    return new Promise((settleStarted) => {
      this.queued_clips.push({ ...audio_clip, settleStarted });
      if (!this.is_feeding) {
        void this.feedClips();
      }
    });
  }

  // Stops everything (takeover, hang-up).
  clear(): void {
    this.dropClips(() => true);
  }

  // Barge-in: drops what the caller may talk over, keeps the rest.
  clearInterruptible(): void {
    this.dropClips((audio_clip) => audio_clip.is_interruptible);
  }

  // The hold is over: the soft tone between hold lines stops at once.
  clearTones(): void {
    this.dropClips((audio_clip) => audio_clip.is_tone === true);
  }

  private dropClips(shouldDrop: (audio_clip: AudioClip) => boolean): void {
    const dropped_clips = this.queued_clips.filter(shouldDrop);
    this.queued_clips = this.queued_clips.filter(
      (queued_clip) => !shouldDrop(queued_clip),
    );
    dropped_clips.forEach((dropped_clip) => dropped_clip.settleStarted(null));
    if (this.current_clip && shouldDrop(this.current_clip)) {
      this.feed_generation += 1;
      this.current_clip = null;
      this.agent_room.clearQueue();
    }
  }

  private async feedClips(): Promise<void> {
    this.is_feeding = true;
    const generation = this.feed_generation;
    try {
      while (
        this.queued_clips.length > 0 &&
        generation === this.feed_generation
      ) {
        const next_clip = this.queued_clips.shift() as QueuedClip;
        this.current_clip = next_clip;
        next_clip.settleStarted(Date.now());
        await this.feedFrames(next_clip, generation);
      }
    } finally {
      this.current_clip = null;
      this.is_feeding = false;
    }
    // A clear() cut the loop short; clips queued after it still need to play.
    if (this.queued_clips.length > 0) {
      void this.feedClips();
    }
  }

  private async feedFrames(
    audio_clip: QueuedClip,
    generation: number,
  ): Promise<void> {
    const frames = splitPcmFrames(audio_clip.pcm, {
      sample_rate: AGENT_OUTPUT_SAMPLE_RATE,
      frame_ms: AUDIO_FRAME_MS,
    });
    for (const frame of frames) {
      if (generation !== this.feed_generation) {
        return;
      }
      await this.agent_room.captureFrame(frame);
    }
  }
}
