import { parseWav } from '../../audio/parse_wav.util';
import { resamplePcm } from '../../audio/resample_pcm.util';

export interface DecodedSpeechAudio {
  pcm: Int16Array;
  sample_rate: number;
}

// TTS backends answer with a WAV; the caller gets raw PCM at the rate it
// asked for (or the backend's own rate when it did not ask).
export function decodeSpeechAudio(
  wav_buffer: Buffer,
  target_sample_rate?: number,
): DecodedSpeechAudio {
  const decoded_pcm = parseWav(wav_buffer);
  if (!target_sample_rate || target_sample_rate === decoded_pcm.sample_rate) {
    return decoded_pcm;
  }
  return {
    pcm: resamplePcm(
      decoded_pcm.pcm,
      decoded_pcm.sample_rate,
      target_sample_rate,
    ),
    sample_rate: target_sample_rate,
  };
}

export function measureWavDurationSeconds(wav_buffer: Buffer): number {
  const decoded_pcm = parseWav(wav_buffer);
  return decoded_pcm.pcm.length / decoded_pcm.sample_rate;
}
