import { splitWords } from './normalise_spoken_text.util';

const UNIT_WORDS: Record<string, number> = {
  zero: 0,
  oh: 0,
  nought: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS_WORDS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fourty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const ORDINAL_WORDS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  thirtieth: 30,
};

const HUNDRED_WORD = 'hundred';

const SCALE_WORDS: Record<string, number> = {
  thousand: 1000,
  grand: 1000,
  million: 1_000_000,
};

const DOLLAR_WORDS = ['dollar', 'dollars', 'bucks'];
const CENT_WORDS = ['cent', 'cents'];

function readSmallWord(word: string): number | null {
  return UNIT_WORDS[word] ?? ORDINAL_WORDS[word] ?? null;
}

export function isNumberWord(word: string): boolean {
  return (
    word in UNIT_WORDS ||
    word in TENS_WORDS ||
    word in ORDINAL_WORDS ||
    word === HUNDRED_WORD ||
    word in SCALE_WORDS
  );
}

// "three thousand one hundred and eighty" -> 3180, "eleven hundred" -> 1100.
function addUpScaledWords(words: string[]): number {
  let total = 0;
  let current = 0;
  for (const word of words) {
    if (word === HUNDRED_WORD) {
      current = (current === 0 ? 1 : current) * 100;
    } else if (word in SCALE_WORDS) {
      total += (current === 0 ? 1 : current) * SCALE_WORDS[word];
      current = 0;
    } else {
      current += TENS_WORDS[word] ?? readSmallWord(word) ?? 0;
    }
  }
  return total + current;
}

// Without "hundred" or "thousand", people say numbers in chunks that are
// written side by side: "nineteen forty eight" -> 1948, "eleven forty four"
// -> 1144, "four two two one" -> 4221, "twenty oh two" -> 2002. A chunk is
// a tens word with an optional unit ("forty eight"), or a single word.
function joinSpokenChunks(words: string[]): number {
  const chunks: number[] = [];
  let index = 0;
  while (index < words.length) {
    const word = words[index];
    const next_word = words[index + 1];
    const next_unit = next_word !== undefined ? readSmallWord(next_word) : null;
    // "forty eight" is one chunk; in "twenty oh two" the "oh" stands alone.
    if (
      word in TENS_WORDS &&
      next_unit !== null &&
      next_unit >= 1 &&
      next_unit <= 9
    ) {
      chunks.push(TENS_WORDS[word] + next_unit);
      index += 2;
    } else {
      chunks.push(TENS_WORDS[word] ?? readSmallWord(word) ?? 0);
      index += 1;
    }
  }
  return Number(chunks.map((chunk) => String(chunk)).join(''));
}

// Number words -> a number. Returns null if there is no number word at all.
export function parseNumberWords(words: string[]): number | null {
  const number_words = words.filter((word) => word !== 'and' && word !== 'a');
  if (number_words.length === 0 || !number_words.every(isNumberWord)) {
    return null;
  }
  const has_scale = number_words.some(
    (word) => word === HUNDRED_WORD || word in SCALE_WORDS,
  );
  return has_scale
    ? addUpScaledWords(number_words)
    : joinSpokenChunks(number_words);
}

// Runs of consecutive number words in a sentence ("and" may join them).
export function findNumberWordRuns(words: string[]): string[][] {
  const runs: string[][] = [];
  let current_run: string[] = [];
  for (const word of words) {
    if (isNumberWord(word) || (word === 'and' && current_run.length > 0)) {
      current_run.push(word);
      continue;
    }
    if (current_run.length > 0) {
      runs.push(current_run);
    }
    current_run = [];
  }
  if (current_run.length > 0) {
    runs.push(current_run);
  }
  return runs.map((run) =>
    run[run.length - 1] === 'and' ? run.slice(0, -1) : run,
  );
}

function pickLongestRun(runs: string[][]): string[] | null {
  return runs.reduce<string[] | null>(
    (longest, run) => (!longest || run.length > longest.length ? run : longest),
    null,
  );
}

const DIGIT_AMOUNT_PATTERN = /(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|grand)?\b/;

// Thousands separators are dropped first: "$3,180.00" -> "3180.00".
function parseDigitAmount(spoken_text: string): number | null {
  const amount_match = DIGIT_AMOUNT_PATTERN.exec(
    spoken_text.toLowerCase().replace(/(\d),(?=\d{3}\b)/g, '$1'),
  );
  if (!amount_match) {
    return null;
  }
  const amount = Number(amount_match[1].replace(/,/g, ''));
  if (!Number.isFinite(amount)) {
    return null;
  }
  return amount_match[2] ? amount * 1000 : amount;
}

// "seven hundred and ninety three dollars sixty" -> 793.60.
function parseWordAmount(spoken_text: string): number | null {
  const words = splitWords(spoken_text);
  const dollar_index = words.findIndex((word) => DOLLAR_WORDS.includes(word));
  const whole_words = dollar_index >= 0 ? words.slice(0, dollar_index) : words;
  const whole_run = pickLongestRun(findNumberWordRuns(whole_words));
  const whole_amount = whole_run ? parseNumberWords(whole_run) : null;
  if (whole_amount === null) {
    return null;
  }
  const cent_words =
    dollar_index >= 0
      ? words
          .slice(dollar_index + 1)
          .filter((word) => !CENT_WORDS.includes(word))
      : [];
  const cent_run = findNumberWordRuns(cent_words)[0];
  const cents = cent_run ? (parseNumberWords(cent_run) ?? 0) : 0;
  return whole_amount + (cents < 100 ? cents / 100 : 0);
}

// What the caller said about an amount -> a number, or null if they did not
// say one. Digits win over words when both appear.
export function parseSpokenAmount(spoken_text: string): number | null {
  return parseDigitAmount(spoken_text) ?? parseWordAmount(spoken_text);
}

const MIN_WRITTEN_DIGITS = 4;

const REPEAT_WORDS: Record<string, number> = { double: 2, triple: 3 };

function isSingleDigit(word: string): boolean {
  return /^\d$/.test(word) || readDigitWord(word) !== '';
}

// Australians say repeated digits as "double two" or "triple oh":
// "four double two one" -> four two two one.
function expandRepeatedDigits(words: string[]): string[] {
  return words.flatMap((word, index) => {
    const next_word = words[index + 1];
    if (
      word in REPEAT_WORDS &&
      next_word !== undefined &&
      isSingleDigit(next_word)
    ) {
      return Array<string>(REPEAT_WORDS[word] - 1).fill(next_word);
    }
    return [word];
  });
}

function readDigitWord(word: string): string {
  const unit = UNIT_WORDS[word];
  return unit !== undefined && unit <= 9 ? String(unit) : '';
}

// "4 2 2 1", "four two two one", "four double two one", "4221" -> "4221": the digits the caller
// said, in order. When at least four are written as digits, words are
// ignored, so "the last four are 3390" is 3390, not 43390.
export function extractSpokenDigits(spoken_text: string): string {
  const words = expandRepeatedDigits(splitWords(spoken_text));
  const written_digits = words.filter((word) => /^\d+$/.test(word)).join('');
  if (written_digits.length >= MIN_WRITTEN_DIGITS) {
    return written_digits;
  }
  return words
    .map((word) => (/^\d+$/.test(word) ? word : readDigitWord(word)))
    .join('');
}
