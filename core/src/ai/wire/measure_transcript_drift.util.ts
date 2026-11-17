// A reader model may say "four eight two one" for "4821", so a few changed
// words are tolerated; more than this share of the words means it changed
// what we asked it to say.
export const MAX_WORD_DRIFT_RATIO = 0.25;

const NUMBER_WORDS: Record<string, string> = {
  zero: '0',
  oh: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
};

export function normaliseSpokenWords(spoken_text: string): string[] {
  return (
    spoken_text
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/[^a-z0-9'\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .map((word) => NUMBER_WORDS[word] ?? word)
      // "4821" and "4 8 2 1" compare equal once digits are split.
      .flatMap((word) => (/^\d+$/.test(word) ? word.split('') : [word]))
  );
}

function countWordEdits(
  expected_words: string[],
  actual_words: string[],
): number {
  let previous_row = Array.from(
    { length: actual_words.length + 1 },
    (_, index) => index,
  );
  for (
    let expected_index = 1;
    expected_index <= expected_words.length;
    expected_index++
  ) {
    const current_row = [expected_index];
    for (
      let actual_index = 1;
      actual_index <= actual_words.length;
      actual_index++
    ) {
      const substitution_cost =
        expected_words[expected_index - 1] === actual_words[actual_index - 1]
          ? 0
          : 1;
      current_row.push(
        Math.min(
          previous_row[actual_index] + 1,
          current_row[actual_index - 1] + 1,
          previous_row[actual_index - 1] + substitution_cost,
        ),
      );
    }
    previous_row = current_row;
  }
  return previous_row[actual_words.length];
}

// Word error rate of what was spoken against what was asked for.
export function measureTranscriptDrift(
  requested_text: string,
  spoken_transcript: string,
): number {
  const expected_words = normaliseSpokenWords(requested_text);
  const actual_words = normaliseSpokenWords(spoken_transcript);
  if (expected_words.length === 0) {
    return actual_words.length === 0 ? 0 : 1;
  }
  return countWordEdits(expected_words, actual_words) / expected_words.length;
}

export function isTranscriptDrifted(
  requested_text: string,
  spoken_transcript: string,
): boolean {
  return (
    measureTranscriptDrift(requested_text, spoken_transcript) >
    MAX_WORD_DRIFT_RATIO
  );
}
