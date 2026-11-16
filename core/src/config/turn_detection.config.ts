import { registerAs } from '@nestjs/config';

// Energy-based voice activity detection of the caller's audio.
export const turnDetectionConfig = registerAs('turn_detection', () => ({
  speech_start_ms: Number(process.env.VAD_SPEECH_START_MS ?? 200),
  end_of_turn_silence_ms: Number(process.env.VAD_END_OF_TURN_SILENCE_MS ?? 700),
  energy_threshold_ratio: Number(process.env.VAD_ENERGY_THRESHOLD_RATIO ?? 3),
  min_utterance_ms: Number(process.env.VAD_MIN_UTTERANCE_MS ?? 300),
  max_utterance_ms: Number(process.env.VAD_MAX_UTTERANCE_MS ?? 30_000),
  pre_roll_ms: Number(process.env.VAD_PRE_ROLL_MS ?? 300),
}));

export type TurnDetectionConfig = ReturnType<typeof turnDetectionConfig>;
