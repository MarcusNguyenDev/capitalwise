import { generateTone } from '../audio/generate_tone.util';

// Two soft notes (C5, E5), well below speech level, then a pause: played in
// a loop between hold lines so the caller knows the line is still open.
export function generateHoldTone(sample_rate: number): Int16Array {
  return generateTone({
    sample_rate,
    peak_level: 0.04,
    notes: [
      { frequency_hz: 523.25, duration_ms: 220 },
      { frequency_hz: 659.25, duration_ms: 320 },
    ],
    gap_ms: 1_200,
  });
}

// A short rising chime when a staff member takes the call over.
export function generateHandoverTone(sample_rate: number): Int16Array {
  return generateTone({
    sample_rate,
    peak_level: 0.08,
    notes: [
      { frequency_hz: 523.25, duration_ms: 140 },
      { frequency_hz: 659.25, duration_ms: 140 },
      { frequency_hz: 783.99, duration_ms: 260 },
    ],
    gap_ms: 60,
  });
}
