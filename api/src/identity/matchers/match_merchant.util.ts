import { measureEditDistance } from './edit_distance.util';
import { splitWords } from './normalise_spoken_text.util';

// Words that do not identify a business on their own.
const GENERIC_MERCHANT_WORDS = new Set([
  'the',
  'and',
  'a',
  'at',
  'co',
  'company',
  'pty',
  'ltd',
  'cafe',
  'coffee',
  'shop',
  'store',
  'market',
  'foods',
  'food',
  'fresh',
  'restaurant',
  'bar',
  'i',
  'went',
  'to',
  'was',
  'it',
  'its',
  'some',
  'place',
  'called',
  'used',
  'my',
  'card',
  'there',
]);

const MIN_DISTINCTIVE_WORD_LENGTH = 4;
const MIN_WHOLE_NAME_SIMILARITY = 0.8;

function distinctiveWords(text: string): string[] {
  return splitWords(text).filter((word) => !GENERIC_MERCHANT_WORDS.has(word));
}

function allowedTypos(word: string): number {
  return word.length >= 7 ? 2 : word.length >= 5 ? 1 : 0;
}

function isSimilarWord(spoken_word: string, merchant_word: string): boolean {
  return (
    measureEditDistance(spoken_word, merchant_word) <=
    allowedTypos(merchant_word)
  );
}

function measureSimilarity(first: string, second: string): number {
  const longest_length = Math.max(first.length, second.length);
  return longest_length === 0
    ? 0
    : 1 - measureEditDistance(first, second) / longest_length;
}

function isMerchantNamed(spoken_text: string, merchant: string): boolean {
  const spoken_words = distinctiveWords(spoken_text);
  const merchant_words = distinctiveWords(merchant);
  if (spoken_words.length === 0 || merchant_words.length === 0) {
    return false;
  }
  // "Pulse" names Pulse Gym Cafe; "gym" alone (short, generic) does not.
  const has_distinctive_overlap = merchant_words.some(
    (merchant_word) =>
      merchant_word.length >= MIN_DISTINCTIVE_WORD_LENGTH &&
      spoken_words.some((spoken_word) =>
        isSimilarWord(spoken_word, merchant_word),
      ),
  );
  // "reel house" -> Reelhouse, "green fields" -> Greenfields.
  const is_whole_name_similar =
    measureSimilarity(spoken_words.join(''), merchant_words.join('')) >=
    MIN_WHOLE_NAME_SIMILARITY;
  return has_distinctive_overlap || is_whole_name_similar;
}

// Fuzzy: shared distinctive words (allowing a typo or two in longer words) or
// a whole-name similarity of at least 80%.
export function isMerchantMatch(
  spoken_text: string,
  recent_merchants: string[],
): boolean {
  return recent_merchants.some((merchant) =>
    isMerchantNamed(spoken_text, merchant),
  );
}
