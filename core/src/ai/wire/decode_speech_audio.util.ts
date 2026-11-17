import { parseWav } from '../../audio/parse_wav.util';
import { resamplePcm } from '../../audio/resample_pcm.util';

export interface DecodedSpeechAudio {
  pcm: Int16Array;
  sample_rate: number;
}

// Kokoro, Qwen3-TTS and OpenAI all speak at 24 kHz; used only for raw PCM
// that does not declare its rate.
const UNDECLARED_PCM_SAMPLE_RATE = 24_000;

function decodeAudioBody(
  audio_buffer: Buffer,
  pcm_sample_rate?: number,
): DecodedSpeechAudio {
  if (audio_buffer.toString('ascii', 0, 4) === 'RIFF') {
    return parseWav(audio_buffer);
  }
  return {
    pcm: new Int16Array(
      audio_buffer.buffer.slice(
        audio_buffer.byteOffset,
        audio_buffer.byteOffset +
          audio_buffer.length -
          (audio_buffer.length % 2),
      ),
    ),
    sample_rate: pcm_sample_rate ?? UNDECLARED_PCM_SAMPLE_RATE,
  };
}

// TTS backends answer with a WAV (the rate is in its header) or raw 16-bit
// PCM; the caller gets PCM at the rate it asked for (or the backend's own
// rate when it did not ask).
export function decodeSpeechAudio(
  audio_buffer: Buffer,
  target_sample_rate?: number,
  pcm_sample_rate?: number,
): DecodedSpeechAudio {
  const decoded_pcm = decodeAudioBody(audio_buffer, pcm_sample_rate);
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
