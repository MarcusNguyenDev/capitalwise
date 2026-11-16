import {
  MAX_SPEAKING_DELAY_MS,
  MIN_SPEAKING_DELAY_MS,
  SPEAKING_MS_PER_CHARACTER,
} from './constants/simulator_pacing.constant';

// A realistic speaking pace: about 60 ms per character, never shorter than
// 1.2 s or longer than 5 s, then divided by the simulator speed.
export function calculateSpeakingDelayMs(
  spoken_text: string,
  speed: number,
): number {
  const natural_delay_ms = Math.min(
    Math.max(
      spoken_text.length * SPEAKING_MS_PER_CHARACTER,
      MIN_SPEAKING_DELAY_MS,
    ),
    MAX_SPEAKING_DELAY_MS,
  );
  return Math.round(natural_delay_ms / speed);
}
