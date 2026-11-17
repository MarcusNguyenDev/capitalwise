import { splitWords } from './normalise_spoken_text.util';

const LEADING_FILLER_WORDS = new Set([
  'hi',
  'hello',
  'yes',
  'yeah',
  'sure',
  'ok',
  'okay',
  'my',
  'name',
  'names',
  'is',
  'its',
  'it',
  'this',
  'i',
  'im',
  'am',
  'speaking',
  'mr',
  'mrs',
  'ms',
  'miss',
  'mister',
  'dr',
  'doctor',
  'full',
]);

const TRAILING_FILLER_WORDS = new Set(['here', 'speaking', 'thanks', 'please']);

export interface CustomerName {
  first_name: string;
  last_name: string;
}

function compactName(name: string): string {
  return splitWords(name).join('');
}

function stripFillers(words: string[]): string[] {
  let start = 0;
  let end = words.length;
  while (start < end && LEADING_FILLER_WORDS.has(words[start])) {
    start += 1;
  }
  while (end > start && TRAILING_FILLER_WORDS.has(words[end - 1])) {
    end -= 1;
  }
  return words.slice(start, end);
}

// Forgiving on form, exact on substance: case, spacing, punctuation, titles
// and "my name is" are ignored, middle names are optional, and hyphenated or
// multi-word names may be said with or without the break. The first name must
// be said first and the surname last. Nicknames are not accepted.
export function isFullNameMatch(
  spoken_text: string,
  customer_name: CustomerName,
): boolean {
  const words = stripFillers(splitWords(spoken_text));
  const first_name = compactName(customer_name.first_name);
  const last_name = compactName(customer_name.last_name);
  if (words.length < 2 || first_name === '' || last_name === '') {
    return false;
  }
  for (let first_end = 1; first_end < words.length; first_end += 1) {
    if (words.slice(0, first_end).join('') !== first_name) {
      continue;
    }
    for (
      let last_start = first_end;
      last_start < words.length;
      last_start += 1
    ) {
      if (words.slice(last_start).join('') === last_name) {
        return true;
      }
    }
  }
  return false;
}
