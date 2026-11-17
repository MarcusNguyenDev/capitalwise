import { parseWav } from '../../audio/parse_wav.util';
import { BufferedTranscriptionStream } from './buffered_transcription.stream';
import {
  isTranscriptDrifted,
  measureTranscriptDrift,
} from './measure_transcript_drift.util';
import { createSingleChunkSpeechStream } from './single_chunk_speech.stream';

describe('BufferedTranscriptionStream (file-based providers)', () => {
  it('sends each committed turn as one 16 kHz WAV and starts the next turn empty', async () => {
    const sent_wavs: Buffer[] = [];
    const transcription_stream = new BufferedTranscriptionStream(
      async (wav) => {
        sent_wavs.push(wav);
        return {
          text: 'ok',
          duration_seconds: 1,
          provider: 'speaches',
          model: 'whisper',
        };
      },
    );

    transcription_stream.appendAudio(new Int16Array(16_000), 16_000);
    transcription_stream.appendAudio(new Int16Array(24_000), 24_000);
    await transcription_stream.commit();
    transcription_stream.appendAudio(new Int16Array(160), 16_000);
    transcription_stream.clear();
    transcription_stream.appendAudio(new Int16Array(320), 16_000);
    await transcription_stream.commit();

    expect(parseWav(sent_wavs[0])).toMatchObject({ sample_rate: 16_000 });
    expect(parseWav(sent_wavs[0]).pcm).toHaveLength(32_000);
    expect(parseWav(sent_wavs[1]).pcm).toHaveLength(320);
  });
});

describe('createSingleChunkSpeechStream (whole-clip providers)', () => {
  it('yields the clip once and summarises it without a transcript', async () => {
    const speech_stream = createSingleChunkSpeechStream(
      Promise.resolve({
        pcm: Int16Array.from([1, 2]),
        sample_rate: 24_000,
        provider: 'speaches',
        model: 'kokoro',
        voice: 'bf_emma',
      }),
      'Hello.',
    );

    const chunks: Int16Array[] = [];
    for await (const chunk of speech_stream) {
      chunks.push(chunk);
    }

    expect(chunks.map((chunk) => [...chunk])).toEqual([[1, 2]]);
    await expect(speech_stream.summary).resolves.toMatchObject({
      requested_text: 'Hello.',
      spoken_transcript: null,
      is_drifted: false,
    });
  });
});

describe('transcript drift', () => {
  it('ignores punctuation, case and digits read as words', () => {
    expect(
      measureTranscriptDrift(
        'Your card ending 4821 is locked.',
        'your card ending four eight two one is locked',
      ),
    ).toBe(0);
  });

  it('tolerates a word or two but flags a changed sentence', () => {
    expect(
      isTranscriptDrifted(
        'Thanks for holding, I am still checking that for you.',
        "Thanks for holding, I'm still checking that for you.",
      ),
    ).toBe(false);
    expect(
      isTranscriptDrifted(
        'Your refund request has been lodged for review.',
        'Great news, your refund has been approved!',
      ),
    ).toBe(true);
    expect(isTranscriptDrifted('Hello.', '')).toBe(true);
  });
});
