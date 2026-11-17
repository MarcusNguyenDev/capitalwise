// Reads numbers said in words ("seven hundred and ninety", "nineteen
// forty-two", "four two two five", "four double two one", "the twelfth") so answers can be compared
// with what the caller said, whether speech-to-text wrote digits or words.

const UNIT_VALUES: Record<string, number> = {
  zero: 0,
  oh: 0,
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
const TENS_VALUES: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
const ORDINAL_VALUES: Record<string, number> = {
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

const REPEAT_COUNTS: Record<string, number> = { double: 2, triple: 3 };

// "four double two one" -> four two two one, as Australians say repeated digits.
function expandRepeatedDigits(words: string[]): string[] {
  return words.flatMap((word, index) => {
    const next_word = words[index + 1];
    const next_value =
      next_word === undefined ? undefined : UNIT_VALUES[next_word];
    if (word in REPEAT_COUNTS && next_value !== undefined && next_value <= 9) {
      return Array<string>(REPEAT_COUNTS[word] - 1).fill(next_word);
    }
    return [word];
  });
}

function readWordValue(word: string): number | null {
  return UNIT_VALUES[word] ?? TENS_VALUES[word] ?? ORDINAL_VALUES[word] ?? null;
}

type WordKind = 'UNIT' | 'TEENS' | 'TENS' | 'HUNDRED' | 'THOUSAND';

function readWordKind(word: string, word_value: number): WordKind {
  if (word in TENS_VALUES || (word in ORDINAL_VALUES && word_value >= 20)) {
    return 'TENS';
  }
  return word_value >= 10 ? 'TEENS' : 'UNIT';
}

// Can this word continue the number being read? "forty" + "two" can,
// "nineteen" + "forty" cannot (a year said in two parts is two groups).
function canContinue(
  previous_kind: WordKind | null,
  next_kind: WordKind,
  current_value: number,
): boolean {
  if (previous_kind === 'HUNDRED' || previous_kind === 'THOUSAND') {
    return true;
  }
  return (
    previous_kind === 'TENS' && next_kind === 'UNIT' && current_value % 10 === 0
  );
}

// Splits text into runs of number words; each run is read as one or more
// groups ("nineteen forty two" -> [19, 42], "four two" -> [4, 2]).
function readNumberGroups(text: string): number[][] {
  const words = expandRepeatedDigits(
    text
      .toLowerCase()
      .replace(/-/g, ' ')
      .split(/[^a-z]+/)
      .filter(Boolean),
  );
  const runs: number[][] = [];
  let current_run: number[] = [];
  let thousands_value = 0;
  let current_value = 0;
  let previous_kind: WordKind | null = null;
  const closeGroup = () => {
    if (previous_kind !== null) {
      current_run.push(thousands_value + current_value);
    }
    thousands_value = 0;
    current_value = 0;
    previous_kind = null;
  };
  const closeRun = () => {
    closeGroup();
    if (current_run.length > 0) {
      runs.push(current_run);
    }
    current_run = [];
  };
  for (const word of words) {
    if (
      word === 'and' &&
      (previous_kind === 'HUNDRED' || previous_kind === 'THOUSAND')
    ) {
      continue;
    }
    if (
      word === 'hundred' &&
      previous_kind !== null &&
      current_value > 0 &&
      current_value < 100
    ) {
      current_value *= 100;
      previous_kind = 'HUNDRED';
      continue;
    }
    if (word === 'thousand' && previous_kind !== null) {
      thousands_value += current_value * 1000;
      current_value = 0;
      previous_kind = 'THOUSAND';
      continue;
    }
    const word_value = readWordValue(word);
    if (word_value === null) {
      closeRun();
      continue;
    }
    const word_kind = readWordKind(word, word_value);
    if (
      previous_kind !== null &&
      !canContinue(previous_kind, word_kind, current_value)
    ) {
      closeGroup();
    }
    current_value += word_value;
    previous_kind = word_kind;
  }
  closeRun();
  return runs;
}

/** Every number the text says in words, as digits, including joined groups (years, postcodes). */
export function readSpokenNumbers(text: string): string[] {
  const spoken_numbers = new Set<string>();
  for (const run of readNumberGroups(text)) {
    for (let start = 0; start < run.length; start += 1) {
      let joined = '';
      for (let end = start; end < run.length; end += 1) {
        joined += String(run[end]);
        spoken_numbers.add(joined);
      }
    }
  }
  return [...spoken_numbers];
}
