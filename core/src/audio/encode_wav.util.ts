const WAV_HEADER_BYTES = 44;
const BYTES_PER_SAMPLE = 2;
const PCM_FORMAT_CODE = 1;

// 16-bit mono PCM in a minimal RIFF/WAVE container.
export function encodeWav(pcm: Int16Array, sample_rate: number): Buffer {
  const data_bytes = pcm.length * BYTES_PER_SAMPLE;
  const wav_buffer = Buffer.alloc(WAV_HEADER_BYTES + data_bytes);
  wav_buffer.write('RIFF', 0, 'ascii');
  wav_buffer.writeUInt32LE(WAV_HEADER_BYTES - 8 + data_bytes, 4);
  wav_buffer.write('WAVE', 8, 'ascii');
  wav_buffer.write('fmt ', 12, 'ascii');
  wav_buffer.writeUInt32LE(16, 16);
  wav_buffer.writeUInt16LE(PCM_FORMAT_CODE, 20);
  wav_buffer.writeUInt16LE(1, 22);
  wav_buffer.writeUInt32LE(sample_rate, 24);
  wav_buffer.writeUInt32LE(sample_rate * BYTES_PER_SAMPLE, 28);
  wav_buffer.writeUInt16LE(BYTES_PER_SAMPLE, 32);
  wav_buffer.writeUInt16LE(16, 34);
  wav_buffer.write('data', 36, 'ascii');
  wav_buffer.writeUInt32LE(data_bytes, 40);
  for (let sample_index = 0; sample_index < pcm.length; sample_index++) {
    wav_buffer.writeInt16LE(
      pcm[sample_index],
      WAV_HEADER_BYTES + sample_index * BYTES_PER_SAMPLE,
    );
  }
  return wav_buffer;
}
