import { EXCLUDED_VOICE_NAME_PREFIXES, MALE_VOICE_NAME_PATTERN, SPEECH_LOCALE_PREFERENCE } from "./speech_voice.constant";
import type { SpeechVoiceProfiles } from "./speech_role.type";

function normaliseLocale(voice: SpeechSynthesisVoice): string {
  return voice.lang.toLowerCase().replace("_", "-");
}

function isUsableEnglishVoice(voice: SpeechSynthesisVoice): boolean {
  const voice_name = voice.name.toLowerCase();
  return normaliseLocale(voice).startsWith("en") && !EXCLUDED_VOICE_NAME_PREFIXES.some((prefix) => voice_name.startsWith(prefix));
}

function rankVoice(voice: SpeechSynthesisVoice): number {
  const locale_index = SPEECH_LOCALE_PREFERENCE.indexOf(normaliseLocale(voice));
  const locale_rank = locale_index === -1 ? SPEECH_LOCALE_PREFERENCE.length : locale_index;
  // Network voices stop working offline, and the demo must run without internet.
  return (voice.localService ? 0 : 100) + locale_rank;
}

function isMaleVoice(voice: SpeechSynthesisVoice): boolean {
  return MALE_VOICE_NAME_PATTERN.test(voice.name);
}

/**
 * Picks three clearly different voices: the AI specialist, the customer and
 * the staff member. When the browser offers fewer voices, pitch keeps them apart.
 */
export function selectSpeechVoices(available_voices: SpeechSynthesisVoice[], is_customer_male: boolean): SpeechVoiceProfiles {
  const ranked_voices = available_voices.filter(isUsableEnglishVoice).sort((first, second) => rankVoice(first) - rankVoice(second));

  const ai_voice = ranked_voices.find((voice) => !isMaleVoice(voice)) ?? ranked_voices[0] ?? null;
  const customer_candidates = ranked_voices.filter((voice) => voice !== ai_voice);
  const customer_voice = customer_candidates.find((voice) => isMaleVoice(voice) === is_customer_male) ?? customer_candidates[0] ?? null;
  const staff_candidates = customer_candidates.filter((voice) => voice !== customer_voice);
  const staff_voice = staff_candidates.find((voice) => isMaleVoice(voice) !== is_customer_male) ?? staff_candidates[0] ?? null;

  return {
    AI: { voice: ai_voice, pitch: 1, rate: 1.02 },
    CUSTOMER: { voice: customer_voice ?? ai_voice, pitch: customer_voice ? 1.05 : 1.45, rate: 1 },
    STAFF: { voice: staff_voice ?? ai_voice, pitch: staff_voice ? 0.95 : 0.6, rate: 0.98 },
  };
}
