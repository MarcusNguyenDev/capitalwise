// Whisper invents these on silence, breath or line noise.
const ALWAYS_HALLUCINATED = [
  'thanks for watching',
  'thank you for watching',
  'please subscribe',
  'subtitles by',
  'transcribed by',
];

// Real phrases that are only trusted when there was enough speech to say them.
const SHORT_AUDIO_HALLUCINATIONS = new Set([
  'thank you',
  'thanks',
  'you',
  'bye',
  'okay',
  'so',
  'uh',
  'um',
  'hmm',
]);

export const SHORT_AUDIO_MS = 400;

function normaliseTranscript(transcript_text: string): string {
  return transcript_text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// True for an empty, punctuation-only or bracketed transcript
// ("[BLANK_AUDIO]", "(silence)", "[Music]") and for known hallucinations.
export function isNoiseTranscript(
  transcript_text: string,
  speech_ms: number,
): boolean {
  const trimmed_text = transcript_text.trim();
  if (/^[[(*].*[\])*]$/.test(trimmed_text)) {
    return true;
  }
  const normalised_text = normaliseTranscript(trimmed_text);
  if (normalised_text.length === 0) {
    return true;
  }
  if (
    ALWAYS_HALLUCINATED.some((hallucination) =>
      normalised_text.startsWith(hallucination),
    )
  ) {
    return true;
  }
  return (
    speech_ms < SHORT_AUDIO_MS &&
    SHORT_AUDIO_HALLUCINATIONS.has(normalised_text)
  );
}
