import { isNoiseTranscript } from './is_noise_transcript.util';
import { makeSpeakableText } from './make_speakable_text.util';
import { MAX_CHUNK_CHARACTERS, SentenceChunker } from './sentence.chunker';

function chunkStream(text_deltas: string[]): string[] {
  const sentence_chunker = new SentenceChunker();
  const chunks = text_deltas.flatMap((text_delta) =>
    sentence_chunker.push(text_delta),
  );
  const remaining_text = sentence_chunker.flush();
  return remaining_text ? [...chunks, remaining_text] : chunks;
}

describe('SentenceChunker', () => {
  it('emits each sentence as soon as the next one starts', () => {
    const sentence_chunker = new SentenceChunker();

    expect(sentence_chunker.push('Hi Sarah')).toEqual([]);
    expect(sentence_chunker.push(', how can I help')).toEqual([]);
    expect(sentence_chunker.push('? I can')).toEqual([
      'Hi Sarah, how can I help?',
    ]);
    expect(sentence_chunker.push(' see your card. ')).toEqual([
      'I can see your card.',
    ]);
    expect(sentence_chunker.flush()).toBeNull();
  });

  it('does not split decimals, abbreviations or e.g.', () => {
    expect(
      chunkStream([
        'The last one was $8.50 at Pulse Gym Cafe. ',
        'Dr. Lee and Mr. Chen are on e.g. the fraud team. Thanks!',
      ]),
    ).toEqual([
      'The last one was $8.50 at Pulse Gym Cafe.',
      'Dr. Lee and Mr. Chen are on e.g. the fraud team.',
      'Thanks!',
    ]);
  });

  it('flushes a long clause at a comma before 120 characters', () => {
    const long_text =
      'I have locked your debit card ending in four eight two one, so nobody can use it, and you can unlock it any time in the app if it turns up again later on';

    const chunks = chunkStream([long_text]);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].length).toBeLessThanOrEqual(MAX_CHUNK_CHARACTERS);
    expect(chunks[0].endsWith(',')).toBe(true);
    expect(chunks.join(' ')).toBe(long_text);
  });

  it('splits on line breaks and keeps closing quotes with the sentence', () => {
    expect(chunkStream(['He said "stop." Then\nwe waited'])).toEqual([
      'He said "stop."',
      'Then',
      'we waited',
    ]);
  });
});

describe('makeSpeakableText', () => {
  it('removes markdown, list markers, emojis and symbols', () => {
    expect(
      makeSpeakableText(
        '**Good news!** Your card is _locked_ 🔒\n- Case: `CASE-001`\n# Next',
      ),
    ).toBe('Good news! Your card is locked Case: CASE-001 Next');
    expect(makeSpeakableText('Fees & charges went up 5%')).toBe(
      'Fees and charges went up 5 percent',
    );
    expect(makeSpeakableText('See [the app](https://bank.test) now')).toBe(
      'See the app now',
    );
  });
});

describe('isNoiseTranscript', () => {
  it('drops empty, punctuation-only and bracketed transcripts', () => {
    expect(isNoiseTranscript('', 1_000)).toBe(true);
    expect(isNoiseTranscript(' ... ', 1_000)).toBe(true);
    expect(isNoiseTranscript('[BLANK_AUDIO]', 1_000)).toBe(true);
    expect(isNoiseTranscript('(silence)', 1_000)).toBe(true);
  });

  it('drops Whisper hallucinations on very short audio only', () => {
    expect(isNoiseTranscript('Thank you.', 350)).toBe(true);
    expect(isNoiseTranscript('Thank you.', 900)).toBe(false);
    expect(isNoiseTranscript('Thanks for watching!', 3_000)).toBe(true);
  });

  it('keeps real speech', () => {
    expect(isNoiseTranscript('I think I lost my card.', 320)).toBe(false);
  });
});
