import { splitWords } from './normalise_spoken_text.util';
import { findNumberWordRuns, parseNumberWords } from './spoken_number.util';

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const ISO_DATE_PATTERN = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/;
// Australian order: day / month / year.
const NUMERIC_DATE_PATTERN =
  /\b(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{2}|\d{4})\b/;
const ORDINAL_SUFFIX_PATTERN = /^(\d{1,2})(st|nd|rd|th)$/;

export interface ParsingClock {
  // Two-digit years above this are 19xx, the rest 20xx.
  current_year: number;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function expandYear(year: number, clock: ParsingClock): number {
  if (year >= 100) {
    return year;
  }
  const current_two_digit_year = clock.current_year % 100;
  return year > current_two_digit_year ? 1900 + year : 2000 + year;
}

function toIsoDate(date_parts: DateParts): string | null {
  const { year, month, day } = date_parts;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  const is_real_date =
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day;
  return is_real_date && year >= 1900
    ? candidate.toISOString().slice(0, 10)
    : null;
}

// One spoken or written number: "3", "3rd", "third", "twenty first",
// "nineteen forty eight", "1948".
function readNumber(words: string[]): number | null {
  if (words.length === 1) {
    const digits_match = ORDINAL_SUFFIX_PATTERN.exec(words[0]);
    if (digits_match) {
      return Number(digits_match[1]);
    }
    if (/^\d+$/.test(words[0])) {
      return Number(words[0]);
    }
  }
  return parseNumberWords(words);
}

// Splits the words around the month name into number groups: digit tokens
// stand alone, runs of number words form one group each.
function groupNumbers(words: string[]): number[] {
  const numbers: number[] = [];
  let word_run: string[] = [];
  const flushRun = () => {
    for (const run of findNumberWordRuns(word_run)) {
      const run_value = readNumber(run);
      if (run_value !== null) {
        numbers.push(run_value);
      }
    }
    word_run = [];
  };
  for (const word of words) {
    if (/^\d/.test(word)) {
      flushRun();
      const digit_value = readNumber([word]);
      if (digit_value !== null) {
        numbers.push(digit_value);
      }
    } else {
      word_run.push(word);
    }
  }
  flushRun();
  return numbers;
}

// "the third nineteen forty eight": the day is the leading words that make a
// number from 1 to 31; the rest is the year.
function splitDayAndYearWords(words: string[]): number[] {
  const number_words = findNumberWordRuns(words)[0] ?? [];
  for (let day_end = 1; day_end < number_words.length; day_end += 1) {
    const day = parseNumberWords(number_words.slice(0, day_end));
    const year = parseNumberWords(number_words.slice(day_end));
    if (day !== null && day >= 1 && day <= 31 && year !== null && year >= 100) {
      return [day, year];
    }
  }
  return groupNumbers(words);
}

function parseTextDate(
  spoken_text: string,
  clock: ParsingClock,
): DateParts | null {
  const words = splitWords(spoken_text);
  const month_index = words.findIndex((word) => word in MONTHS);
  if (month_index < 0) {
    return null;
  }
  const month = MONTHS[words[month_index]];
  const before_month = groupNumbers(words.slice(0, month_index));
  const after_words = words.slice(month_index + 1);
  // "3rd of March 1948": day before the month, year after.
  if (before_month.length > 0) {
    const after_month = groupNumbers(after_words);
    const year = after_month[after_month.length - 1];
    return year === undefined
      ? null
      : {
          day: before_month[before_month.length - 1],
          month,
          year: expandYear(year, clock),
        };
  }
  // "March 3rd, 1948" or "March the third nineteen forty eight".
  const after_month = after_words.some((word) => /^\d/.test(word))
    ? groupNumbers(after_words)
    : splitDayAndYearWords(after_words);
  if (after_month.length < 2) {
    return null;
  }
  return {
    day: after_month[0],
    month,
    year: expandYear(after_month[after_month.length - 1], clock),
  };
}

// Accepts ISO ("1948-03-03"), Australian numeric ("03/03/1948", "3.3.48") and
// natural text ("3rd of March 1948", "March 3, 1948", "the third of March
// nineteen forty-eight"). Returns YYYY-MM-DD, or null if it is not a real date.
export function parseDateOfBirth(
  spoken_text: string,
  clock: ParsingClock = { current_year: new Date().getUTCFullYear() },
): string | null {
  const iso_match = ISO_DATE_PATTERN.exec(spoken_text);
  if (iso_match) {
    return toIsoDate({
      year: Number(iso_match[1]),
      month: Number(iso_match[2]),
      day: Number(iso_match[3]),
    });
  }
  const numeric_match = NUMERIC_DATE_PATTERN.exec(spoken_text);
  if (numeric_match) {
    return toIsoDate({
      day: Number(numeric_match[1]),
      month: Number(numeric_match[2]),
      year: expandYear(Number(numeric_match[3]), clock),
    });
  }
  const text_date = parseTextDate(spoken_text, clock);
  return text_date ? toIsoDate(text_date) : null;
}

export function isDateOfBirthMatch(
  spoken_text: string,
  expected_date_of_birth: string,
  clock?: ParsingClock,
): boolean {
  return (
    parseDateOfBirth(spoken_text, clock) === expected_date_of_birth.slice(0, 10)
  );
}
