import { readSpokenNumbers } from './read_spoken_numbers.util';

// Identity answers must come from the caller, never from the model. A real
// call showed the model submitting a name the caller never said, which made a
// genuine caller fail. This compares each answer with what the caller actually
// said (or typed) on this call.

const FILLER_WORDS = new Set([
  'the',
  'and',
  'my',
  'its',
  'it',
  'is',
  'was',
  'of',
  'about',
  'around',
  'roughly',
  'dollars',
  'dollar',
  'cents',
  'name',
  'birth',
  'date',
  'postcode',
  'i',
  'im',
  'a',
]);
const MIN_SHARE_OF_TOKENS_SAID = 0.6;

function toTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/(\d),(?=\d{3}(?!\d))/g, '$1')
    .replace(/(\d+)(st|nd|rd|th)\b/g, '$1')
    .split(/[^a-z0-9.]+/)
    .map((token) => token.replace(/^\.+|\.+$/g, ''))
    .filter((token) => token.length > 0 && !FILLER_WORDS.has(token));
}

function isSaid(answer_token: string, said_tokens: Set<string>): boolean {
  if (said_tokens.has(answer_token)) {
    return true;
  }
  const answer_number = Number(answer_token);
  return (
    !Number.isNaN(answer_number) &&
    [...said_tokens].some((said_token) => Number(said_token) === answer_number)
  );
}

function isAnswerSaid(answer: string, said_tokens: Set<string>): boolean {
  const answer_tokens = toTokens(answer);
  if (answer_tokens.length === 0) {
    return true;
  }
  const is_name_like = answer_tokens.every((token) => /^[a-z]+$/.test(token));
  const said_count = answer_tokens.filter((token) =>
    isSaid(token, said_tokens),
  ).length;
  // Every word of a name must have been said; other answers may be paraphrased.
  return is_name_like
    ? said_count === answer_tokens.length
    : said_count / answer_tokens.length >= MIN_SHARE_OF_TOKENS_SAID;
}

/** Returns the question ids whose answers the caller did not say on this call. */
export function findUnsaidIdentityAnswers(
  answers: { question_id: string; answer: string }[],
  caller_lines: string[],
): string[] {
  const said_tokens = new Set([
    ...caller_lines.flatMap(toTokens),
    ...caller_lines.flatMap(readSpokenNumbers),
  ]);
  return answers
    .filter(
      (identity_answer) => !isAnswerSaid(identity_answer.answer, said_tokens),
    )
    .map((identity_answer) => identity_answer.question_id);
}

// Replies that are not an answer at all: submitting them would cost the caller
// an attempt (a real call locked an elderly caller this way).
const NON_ANSWER_WORDS = new Set([
  'yes',
  'yeah',
  'yep',
  'no',
  'nope',
  'right',
  'thats',
  'that',
  's',
  'okay',
  'ok',
  'sure',
  'thank',
  'thanks',
  'you',
  'dear',
  'love',
  'sorry',
  'pardon',
  'what',
  'hmm',
  'um',
  'uh',
  'please',
  'again',
  'sir',
  'madam',
  'well',
  'oh',
]);

/** Returns the question ids whose "answer" is only a filler such as "yes" or "thank you". */
export function findNonAnswers(
  answers: { question_id: string; answer: string }[],
): string[] {
  return answers
    .filter((identity_answer) =>
      identity_answer.answer
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
        .every((word) => NON_ANSWER_WORDS.has(word)),
    )
    .map((identity_answer) => identity_answer.question_id);
}
