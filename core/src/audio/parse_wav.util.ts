import { InvalidAudioError } from './errors/invalid_audio.error';

const PCM_FORMAT_CODE = 1;
const FLOAT_FORMAT_CODE = 3;
const EXTENSIBLE_FORMAT_CODE = 0xfffe;
// Streaming encoders write this (or 0) as the data size because they do not
// know the length up front: read to the end of the buffer instead.
const UNKNOWN_DATA_SIZE = 0xffffffff;

export interface DecodedPcm {
  pcm: Int16Array;
  sample_rate: number;
}

interface WavFormat {
  format_code: number;
  channel_count: number;
  sample_rate: number;
  bits_per_sample: number;
}

function readFormat(wav_buffer: Buffer, chunk_offset: number): WavFormat {
  return {
    format_code: wav_buffer.readUInt16LE(chunk_offset),
    channel_count: wav_buffer.readUInt16LE(chunk_offset + 2),
    sample_rate: wav_buffer.readUInt32LE(chunk_offset + 4),
    bits_per_sample: wav_buffer.readUInt16LE(chunk_offset + 14),
  };
}

function readSample(
  wav_buffer: Buffer,
  byte_offset: number,
  wav_format: WavFormat,
): number {
  const is_float =
    wav_format.format_code === FLOAT_FORMAT_CODE ||
    (wav_format.format_code === EXTENSIBLE_FORMAT_CODE &&
      wav_format.bits_per_sample === 32);
  if (is_float) {
    const float_sample = wav_buffer.readFloatLE(byte_offset);
    return Math.max(-32768, Math.min(32767, Math.round(float_sample * 32767)));
  }
  return wav_buffer.readInt16LE(byte_offset);
}

function decodeSamples(
  wav_buffer: Buffer,
  data_range: { start: number; end: number },
  wav_format: WavFormat,
): Int16Array {
  const bytes_per_sample = wav_format.bits_per_sample / 8;
  const bytes_per_frame = bytes_per_sample * wav_format.channel_count;
  const frame_count = Math.floor(
    (data_range.end - data_range.start) / bytes_per_frame,
  );
  const pcm = new Int16Array(frame_count);
  for (let frame_index = 0; frame_index < frame_count; frame_index++) {
    const frame_offset = data_range.start + frame_index * bytes_per_frame;
    let channel_sum = 0;
    for (
      let channel_index = 0;
      channel_index < wav_format.channel_count;
      channel_index++
    ) {
      channel_sum += readSample(
        wav_buffer,
        frame_offset + channel_index * bytes_per_sample,
        wav_format,
      );
    }
    pcm[frame_index] = Math.round(channel_sum / wav_format.channel_count);
  }
  return pcm;
}

function assertSupportedFormat(wav_format: WavFormat | null): WavFormat {
  if (!wav_format) {
    throw new InvalidAudioError('no "fmt " chunk');
  }
  const is_pcm16 =
    (wav_format.format_code === PCM_FORMAT_CODE ||
      wav_format.format_code === EXTENSIBLE_FORMAT_CODE) &&
    wav_format.bits_per_sample === 16;
  const is_float32 =
    (wav_format.format_code === FLOAT_FORMAT_CODE ||
      wav_format.format_code === EXTENSIBLE_FORMAT_CODE) &&
    wav_format.bits_per_sample === 32;
  if (!is_pcm16 && !is_float32) {
    throw new InvalidAudioError(
      `unsupported encoding (format ${wav_format.format_code}, ${wav_format.bits_per_sample} bit)`,
    );
  }
  if (wav_format.channel_count < 1 || wav_format.sample_rate < 1) {
    throw new InvalidAudioError('no channels or no sample rate');
  }
  return wav_format;
}

// Decodes a 16-bit PCM or 32-bit float WAV (any channel count) into 16-bit
// mono PCM, mixing channels down.
export function parseWav(wav_buffer: Buffer): DecodedPcm {
  if (
    wav_buffer.length < 12 ||
    wav_buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    wav_buffer.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    throw new InvalidAudioError('missing the RIFF/WAVE header');
  }
  let wav_format: WavFormat | null = null;
  let chunk_offset = 12;
  while (chunk_offset + 8 <= wav_buffer.length) {
    const chunk_id = wav_buffer.toString(
      'ascii',
      chunk_offset,
      chunk_offset + 4,
    );
    const declared_size = wav_buffer.readUInt32LE(chunk_offset + 4);
    const body_offset = chunk_offset + 8;
    if (chunk_id === 'fmt ') {
      wav_format = readFormat(wav_buffer, body_offset);
    } else if (chunk_id === 'data') {
      const is_size_unknown =
        declared_size === UNKNOWN_DATA_SIZE || declared_size === 0;
      const data_end = is_size_unknown
        ? wav_buffer.length
        : Math.min(body_offset + declared_size, wav_buffer.length);
      const supported_format = assertSupportedFormat(wav_format);
      return {
        pcm: decodeSamples(
          wav_buffer,
          { start: body_offset, end: data_end },
          supported_format,
        ),
        sample_rate: supported_format.sample_rate,
      };
    }
    chunk_offset = body_offset + declared_size + (declared_size % 2);
  }
  throw new InvalidAudioError('no "data" chunk');
}
