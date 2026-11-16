const TONE_NOTES = [
  { frequency_hz: 660, starts_at_seconds: 0, duration_seconds: 0.18 },
  { frequency_hz: 880, starts_at_seconds: 0.22, duration_seconds: 0.26 },
];
const TONE_VOLUME = 0.18;
const TONE_TOTAL_MS = 650;

function scheduleNote(audio_context: AudioContext, note: (typeof TONE_NOTES)[number]): void {
  const oscillator = audio_context.createOscillator();
  const gain = audio_context.createGain();
  const starts_at = audio_context.currentTime + note.starts_at_seconds;
  const ends_at = starts_at + note.duration_seconds;

  oscillator.type = "sine";
  oscillator.frequency.value = note.frequency_hz;
  gain.gain.setValueAtTime(0, starts_at);
  gain.gain.linearRampToValueAtTime(TONE_VOLUME, starts_at + 0.02);
  gain.gain.linearRampToValueAtTime(0, ends_at);
  oscillator.connect(gain).connect(audio_context.destination);
  oscillator.start(starts_at);
  oscillator.stop(ends_at);
}

/** Two rising notes the customer hears when a staff member joins the call. Resolves when the tone has finished. */
export function playHandoverTone(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window.AudioContext === "undefined") {
      resolve();
      return;
    }
    const audio_context = new window.AudioContext();
    TONE_NOTES.forEach((note) => scheduleNote(audio_context, note));
    setTimeout(() => {
      void audio_context.close();
      resolve();
    }, TONE_TOTAL_MS);
  });
}
