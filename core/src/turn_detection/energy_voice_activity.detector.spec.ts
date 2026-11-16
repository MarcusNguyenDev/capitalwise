import { EnergyVoiceActivityDetector } from './energy_voice_activity.detector';
import {
  UtteranceEndedEvent,
  VoiceActivityEvent,
} from './types/voice_activity_event.type';

const SAMPLE_RATE = 16_000;
const SAMPLES_PER_FRAME = 160;

const DEFAULT_SETTINGS = {
  sample_rate: SAMPLE_RATE,
  speech_start_ms: 200,
  end_of_turn_silence_ms: 700,
  energy_threshold_ratio: 3,
  min_utterance_ms: 300,
  max_utterance_ms: 30_000,
  pre_roll_ms: 300,
};

// Deterministic pseudo-random noise so the tests never flake.
function createNoiseSource(seed = 7): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648 - 0.5;
  };
}

interface AudioSegment {
  kind: 'silence' | 'speech';
  duration_ms: number;
  level?: number;
}

function renderFrames(audio_segments: AudioSegment[]): Int16Array[] {
  const readNoise = createNoiseSource();
  const frames: Int16Array[] = [];
  let sample_clock = 0;
  for (const audio_segment of audio_segments) {
    const frame_count = audio_segment.duration_ms / 10;
    for (let frame_index = 0; frame_index < frame_count; frame_index++) {
      const frame = new Int16Array(SAMPLES_PER_FRAME);
      for (let sample_index = 0; sample_index < SAMPLES_PER_FRAME; sample_index++) {
        const noise = readNoise() * 2 * (audio_segment.kind === 'silence' ? audio_segment.level ?? 60 : 60);
        const voice =
          audio_segment.kind === 'speech'
            ? Math.sin((2 * Math.PI * 180 * sample_clock) / SAMPLE_RATE) *
              (audio_segment.level ?? 6_000)
            : 0;
        frame[sample_index] = Math.round(noise + voice);
        sample_clock += 1;
      }
      frames.push(frame);
    }
  }
  return frames;
}

function runDetector(
  audio_segments: AudioSegment[],
  setting_overrides: Partial<typeof DEFAULT_SETTINGS> = {},
): VoiceActivityEvent[] {
  const detector = new EnergyVoiceActivityDetector({
    ...DEFAULT_SETTINGS,
    ...setting_overrides,
  });
  return renderFrames(audio_segments).flatMap((frame) =>
    detector.pushFrame(frame),
  );
}

function findUtterances(events: VoiceActivityEvent[]): UtteranceEndedEvent[] {
  return events.filter(
    (event): event is UtteranceEndedEvent => event.type === 'utterance_ended',
  );
}

describe('EnergyVoiceActivityDetector', () => {
  it('stays quiet on silence and background noise', () => {
    expect(runDetector([{ kind: 'silence', duration_ms: 3_000 }])).toEqual([]);
    expect(
      runDetector([{ kind: 'silence', duration_ms: 3_000, level: 500 }]),
    ).toEqual([]);
  });

  it('turns speech followed by silence into one utterance', () => {
    const events = runDetector([
      { kind: 'silence', duration_ms: 1_000 },
      { kind: 'speech', duration_ms: 1_200 },
      { kind: 'silence', duration_ms: 1_000 },
    ]);

    expect(events.map((event) => event.type)).toEqual([
      'speech_started',
      'utterance_ended',
    ]);
    expect(events[0]).toEqual({ type: 'speech_started', stream_ms: 1_000 });
    const [utterance] = findUtterances(events);
    expect(utterance.speech_ms).toBe(1_200);
    expect(utterance.is_truncated).toBe(false);
    // The turn ends 700 ms after the last voiced frame.
    expect(utterance.stream_ms).toBe(1_000 + 1_200 + 700);
  });

  it('keeps 300 ms of pre-roll and a short tail around the speech', () => {
    const [utterance] = findUtterances(
      runDetector([
        { kind: 'silence', duration_ms: 1_000 },
        { kind: 'speech', duration_ms: 1_000 },
        { kind: 'silence', duration_ms: 1_000 },
      ]),
    );

    const utterance_ms = (utterance.pcm.length / SAMPLE_RATE) * 1000;
    expect(utterance_ms).toBe(300 + 1_000 + 200);
    // The pre-roll is the quiet audio from before the speech started.
    const pre_roll = utterance.pcm.subarray(0, (300 * SAMPLE_RATE) / 1000);
    expect(Math.max(...pre_roll.map(Math.abs))).toBeLessThan(200);
    const first_speech = utterance.pcm.subarray(
      (300 * SAMPLE_RATE) / 1000,
      (400 * SAMPLE_RATE) / 1000,
    );
    expect(Math.max(...first_speech.map(Math.abs))).toBeGreaterThan(3_000);
  });

  it('does not end the turn on a pause shorter than the end-of-turn silence', () => {
    const events = runDetector([
      { kind: 'silence', duration_ms: 500 },
      { kind: 'speech', duration_ms: 600 },
      { kind: 'silence', duration_ms: 400 },
      { kind: 'speech', duration_ms: 600 },
      { kind: 'silence', duration_ms: 1_000 },
    ]);

    const utterances = findUtterances(events);
    expect(utterances).toHaveLength(1);
    expect(utterances[0].speech_ms).toBe(600 + 400 + 600);
  });

  it('ignores a click shorter than the speech start time', () => {
    expect(
      runDetector([
        { kind: 'silence', duration_ms: 500 },
        { kind: 'speech', duration_ms: 120 },
        { kind: 'silence', duration_ms: 1_000 },
      ]),
    ).toEqual([]);
  });

  it('discards speech shorter than the minimum utterance', () => {
    const events = runDetector([
      { kind: 'silence', duration_ms: 500 },
      { kind: 'speech', duration_ms: 250 },
      { kind: 'silence', duration_ms: 1_000 },
    ]);

    expect(events.map((event) => event.type)).toEqual([
      'speech_started',
      'utterance_discarded',
    ]);
  });

  it('adapts to a noisy line: louder speech is still found', () => {
    const events = runDetector([
      { kind: 'silence', duration_ms: 2_000, level: 600 },
      { kind: 'speech', duration_ms: 800, level: 7_000 },
      { kind: 'silence', duration_ms: 1_000, level: 600 },
    ]);

    expect(findUtterances(events)).toHaveLength(1);
  });

  it('cuts an endless utterance at the maximum length', () => {
    const events = runDetector(
      [
        { kind: 'silence', duration_ms: 300 },
        { kind: 'speech', duration_ms: 3_000 },
      ],
      { max_utterance_ms: 2_000 },
    );

    const [utterance] = findUtterances(events);
    expect(utterance.is_truncated).toBe(true);
    expect((utterance.pcm.length / SAMPLE_RATE) * 1000).toBeLessThanOrEqual(2_000);
  });

  it('honours a longer end-of-turn silence setting', () => {
    const events = runDetector(
      [
        { kind: 'silence', duration_ms: 500 },
        { kind: 'speech', duration_ms: 600 },
        { kind: 'silence', duration_ms: 900 },
      ],
      { end_of_turn_silence_ms: 1_200 },
    );

    expect(findUtterances(events)).toHaveLength(0);
  });
});
