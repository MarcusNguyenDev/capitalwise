// Lower case, accents removed, apostrophes dropped ("O'Brien" -> "obrien"),
// every other symbol turned into a space, whitespace collapsed.
export function normaliseSpokenText(spoken_text: string): string {
  return spoken_text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9.$]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitWords(spoken_text: string): string[] {
  return normaliseSpokenText(spoken_text)
    .replace(/[.$]/g, ' ')
    .split(' ')
    .filter((word) => word !== '');
}

const NOT_KNOWN_PATTERN =
  /\b(?:dont know|do not know|not sure|no idea|cant remember|can not remember|cannot remember|dont remember|do not remember|cant recall|forgot|forget|pass|skip)\b/;
const MAX_NOT_KNOWN_WORDS = 7;

// Blank, or a short "I'm not sure" / "I don't know". Such an answer is neither
// right nor wrong; it only matters if every answer is like this.
export function isUnanswered(spoken_text: string | null | undefined): boolean {
  const normalised = normaliseSpokenText(spoken_text ?? '').replace(
    /[.$]/g,
    '',
  );
  if (normalised === '') {
    return true;
  }
  const word_count = normalised.split(' ').length;
  return (
    word_count <= MAX_NOT_KNOWN_WORDS &&
    !/\d/.test(normalised) &&
    NOT_KNOWN_PATTERN.test(normalised)
  );
}
