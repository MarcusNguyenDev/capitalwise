const MILLISECONDS_PER_SECOND = 1000;
const FADE_MS = 30;
const MAX_SAMPLE_VALUE = 32767;

export interface ToneNote {
  frequency_hz: number;
  duration_ms: number;
}

export interface ToneSettings {
  sample_rate: number;
  // Peak level as a share of full scale (0..1).
  peak_level: number;
  notes: ToneNote[];
  gap_ms: number;
}

function renderNote(
  tone_note: ToneNote,
  tone_settings: ToneSettings,
): Int16Array {
  const sample_count = Math.round(
    (tone_settings.sample_rate * tone_note.duration_ms) /
      MILLISECONDS_PER_SECOND,
  );
  const fade_samples = Math.round(
    (tone_settings.sample_rate * FADE_MS) / MILLISECONDS_PER_SECOND,
  );
  const note_pcm = new Int16Array(sample_count);
  for (let sample_index = 0; sample_index < sample_count; sample_index++) {
    // Soft attack and release so the tone never clicks.
    const envelope = Math.min(
      1,
      sample_index / fade_samples,
      (sample_count - sample_index) / fade_samples,
    );
    const phase =
      (2 * Math.PI * tone_note.frequency_hz * sample_index) /
      tone_settings.sample_rate;
    note_pcm[sample_index] = Math.round(
      Math.sin(phase) * envelope * tone_settings.peak_level * MAX_SAMPLE_VALUE,
    );
  }
  return note_pcm;
}

// A short sequence of soft sine notes separated by silence.
export function generateTone(tone_settings: ToneSettings): Int16Array {
  const gap_samples = Math.round(
    (tone_settings.sample_rate * tone_settings.gap_ms) /
      MILLISECONDS_PER_SECOND,
  );
  const rendered_notes = tone_settings.notes.map((tone_note) =>
    renderNote(tone_note, tone_settings),
  );
  const total_samples = rendered_notes.reduce(
    (sample_total, note_pcm) => sample_total + note_pcm.length + gap_samples,
    0,
  );
  const tone_pcm = new Int16Array(total_samples);
  let write_offset = 0;
  for (const note_pcm of rendered_notes) {
    tone_pcm.set(note_pcm, write_offset);
    write_offset += note_pcm.length + gap_samples;
  }
  return tone_pcm;
}
