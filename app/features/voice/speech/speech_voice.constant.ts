/** Most preferred first: the demo bank is Australian. */
export const SPEECH_LOCALE_PREFERENCE = ["en-au", "en-gb", "en-nz", "en-ie", "en-za", "en-us", "en-in"];

/** Novelty and low-quality system voices (mostly macOS) that would spoil a recording. */
export const EXCLUDED_VOICE_NAME_PREFIXES = [
  "albert", "bad news", "bahh", "bells", "boing", "bubbles", "cellos", "good news", "jester", "organ",
  "superstar", "trinoids", "whisper", "wobble", "zarvox", "junior", "ralph", "kathy", "fred", "eddy",
  "flo", "grandma", "grandpa", "reed", "rocko", "sandy", "shelley",
];

/** Voice names that sound male, used to give the customer and staff a clearly different voice from the AI. */
export const MALE_VOICE_NAME_PATTERN = /\b(daniel|lee|gordon|james|aaron|arthur|oliver|rishi|tom|alex|william|david|george|mark|guy|ryan|male)\b/i;

export const SPEECH_LANGUAGE = "en-AU";

/** Speech synthesis speaks roughly 14 characters a second; the fallback is deliberately generous. */
export const SPEECH_TIMEOUT_MS_PER_CHARACTER = 95;
export const SPEECH_TIMEOUT_BASE_MS = 2500;

/** Reading pace used when the browser cannot speak at all and captions are the only output. */
export const SILENT_READING_MS_PER_CHARACTER = 60;
export const SILENT_READING_MIN_MS = 1200;
export const SILENT_READING_MAX_MS = 6000;

export const VOICE_LIST_WAIT_MS = 1000;
