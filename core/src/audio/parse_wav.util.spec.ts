import { encodeWav } from './encode_wav.util';
import { InvalidAudioError } from './errors/invalid_audio.error';
import { parseWav } from './parse_wav.util';
import { resamplePcm } from './resample_pcm.util';
import { splitPcmFrames } from './split_pcm_frames.util';

function buildWavHeader(wav_format: {
  format_code: number;
  channel_count: number;
  sample_rate: number;
  bits_per_sample: number;
  data_bytes: number;
}): Buffer {
  const header = Buffer.alloc(44);
  const bytes_per_frame =
    (wav_format.bits_per_sample / 8) * wav_format.channel_count;
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(Math.min(36 + wav_format.data_bytes, 0xffffffff), 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(wav_format.format_code, 20);
  header.writeUInt16LE(wav_format.channel_count, 22);
  header.writeUInt32LE(wav_format.sample_rate, 24);
  header.writeUInt32LE(wav_format.sample_rate * bytes_per_frame, 28);
  header.writeUInt16LE(bytes_per_frame, 32);
  header.writeUInt16LE(wav_format.bits_per_sample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(wav_format.data_bytes, 40);
  return header;
}

describe('WAV and PCM', () => {
  it('round-trips 16-bit mono PCM through encodeWav and parseWav', () => {
    const pcm = Int16Array.from([0, 1200, -1200, 32767, -32768]);

    const decoded_pcm = parseWav(encodeWav(pcm, 16_000));

    expect(decoded_pcm.sample_rate).toBe(16_000);
    expect([...decoded_pcm.pcm]).toEqual([...pcm]);
  });

  it('mixes stereo down to mono', () => {
    const samples = Buffer.alloc(8);
    samples.writeInt16LE(1000, 0);
    samples.writeInt16LE(3000, 2);
    samples.writeInt16LE(-200, 4);
    samples.writeInt16LE(-400, 6);
    const wav_buffer = Buffer.concat([
      buildWavHeader({
        format_code: 1,
        channel_count: 2,
        sample_rate: 24_000,
        bits_per_sample: 16,
        data_bytes: 8,
      }),
      samples,
    ]);

    expect([...parseWav(wav_buffer).pcm]).toEqual([2000, -300]);
  });

  it('decodes 32-bit float samples', () => {
    const samples = Buffer.alloc(8);
    samples.writeFloatLE(0.5, 0);
    samples.writeFloatLE(-1, 4);
    const wav_buffer = Buffer.concat([
      buildWavHeader({
        format_code: 3,
        channel_count: 1,
        sample_rate: 22_050,
        bits_per_sample: 32,
        data_bytes: 8,
      }),
      samples,
    ]);

    const decoded_pcm = parseWav(wav_buffer);

    expect(decoded_pcm.sample_rate).toBe(22_050);
    expect([...decoded_pcm.pcm]).toEqual([16384, -32767]);
  });

  it('reads to the end when a streaming encoder left the data size unknown', () => {
    const samples = Buffer.alloc(6);
    samples.writeInt16LE(7, 0);
    samples.writeInt16LE(8, 2);
    samples.writeInt16LE(9, 4);
    const wav_buffer = Buffer.concat([
      buildWavHeader({
        format_code: 1,
        channel_count: 1,
        sample_rate: 24_000,
        bits_per_sample: 16,
        data_bytes: 0xffffffff,
      }),
      samples,
    ]);

    expect([...parseWav(wav_buffer).pcm]).toEqual([7, 8, 9]);
  });

  it('rejects what is not a usable WAV', () => {
    expect(() => parseWav(Buffer.from('not a wav at all'))).toThrow(
      InvalidAudioError,
    );
    expect(() =>
      parseWav(
        buildWavHeader({
          format_code: 1,
          channel_count: 1,
          sample_rate: 8_000,
          bits_per_sample: 8,
          data_bytes: 0,
        }),
      ),
    ).toThrow(/unsupported encoding/);
  });

  it('resamples by linear interpolation and leaves equal rates alone', () => {
    const pcm = Int16Array.from([0, 100, 200, 300]);

    expect(resamplePcm(pcm, 16_000, 16_000)).toBe(pcm);
    expect([...resamplePcm(pcm, 16_000, 32_000)]).toEqual([
      0, 50, 100, 150, 200, 250, 300, 300,
    ]);
    expect(resamplePcm(new Int16Array(22_050), 22_050, 24_000)).toHaveLength(
      24_000,
    );
  });

  it('splits PCM into equal 10 ms frames, padding the last one', () => {
    const frames = splitPcmFrames(new Int16Array(500).fill(3), {
      sample_rate: 24_000,
    });

    expect(frames).toHaveLength(3);
    expect(frames.every((frame) => frame.length === 240)).toBe(true);
    expect(frames[2][19]).toBe(3);
    expect(frames[2][20]).toBe(0);
  });
});
