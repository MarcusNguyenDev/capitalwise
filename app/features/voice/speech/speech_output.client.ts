import { selectSpeechVoices } from "./select_speech_voices.util";
import type { SpeechRole, SpeechVoiceProfiles } from "./speech_role.type";
import {
  SILENT_READING_MAX_MS,
  SILENT_READING_MIN_MS,
  SILENT_READING_MS_PER_CHARACTER,
  SPEECH_LANGUAGE,
  SPEECH_TIMEOUT_BASE_MS,
  SPEECH_TIMEOUT_MS_PER_CHARACTER,
  VOICE_LIST_WAIT_MS,
} from "./speech_voice.constant";

function getSpeechSynthesis(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

/** Chrome fills the voice list asynchronously, so the first read is often empty. */
function loadSpeechVoices(speech_synthesis: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const loaded_voices = speech_synthesis.getVoices();
  if (loaded_voices.length > 0) {
    return Promise.resolve(loaded_voices);
  }
  return new Promise((resolve) => {
    const finishLoading = () => {
      clearTimeout(wait_timer);
      speech_synthesis.removeEventListener("voiceschanged", finishLoading);
      resolve(speech_synthesis.getVoices());
    };
    const wait_timer = setTimeout(finishLoading, VOICE_LIST_WAIT_MS);
    speech_synthesis.addEventListener("voiceschanged", finishLoading);
  });
}

function estimateSilentReadingMs(text: string): number {
  return Math.min(SILENT_READING_MAX_MS, Math.max(SILENT_READING_MIN_MS, text.length * SILENT_READING_MS_PER_CHARACTER));
}

/**
 * Speaks lines one after another with the browser's speech synthesis, one
 * voice per role. Without speech synthesis it waits a reading pause instead,
 * so captions still pace the call.
 */
export class SpeechOutput {
  private readonly is_customer_male: boolean;
  private voice_profiles: SpeechVoiceProfiles | null = null;
  private speech_queue: Promise<void> = Promise.resolve();
  // Lines queued before a cancel carry an older generation and are skipped.
  private generation = 0;
  private finishCurrentLine: (() => void) | null = null;
  // Chrome can garbage-collect an utterance mid-speech unless something holds it.
  private current_utterance: SpeechSynthesisUtterance | null = null;

  constructor(voice_preferences: { is_customer_male: boolean }) {
    this.is_customer_male = voice_preferences.is_customer_male;
  }

  /** Resolves when the line has been spoken, skipped by a cancel, or timed out. */
  speak(text: string, speech_role: SpeechRole): Promise<void> {
    const queued_generation = this.generation;
    this.speech_queue = this.speech_queue.then(() => (queued_generation === this.generation ? this.speakLine(text, speech_role) : undefined));
    return this.speech_queue;
  }

  cancelAll(): void {
    this.generation += 1;
    getSpeechSynthesis()?.cancel();
    this.finishCurrentLine?.();
  }

  private async speakLine(text: string, speech_role: SpeechRole): Promise<void> {
    const speech_synthesis = getSpeechSynthesis();
    if (!speech_synthesis || typeof SpeechSynthesisUtterance === "undefined") {
      return this.waitUnlessCancelled(estimateSilentReadingMs(text));
    }
    const line_generation = this.generation;
    const voice_profiles = await this.loadVoiceProfiles(speech_synthesis);
    if (line_generation !== this.generation) {
      return;
    }
    const utterance = this.buildUtterance(text, voice_profiles[speech_role]);
    return this.playUtterance(speech_synthesis, utterance);
  }

  private async loadVoiceProfiles(speech_synthesis: SpeechSynthesis): Promise<SpeechVoiceProfiles> {
    if (!this.voice_profiles) {
      this.voice_profiles = selectSpeechVoices(await loadSpeechVoices(speech_synthesis), this.is_customer_male);
    }
    return this.voice_profiles;
  }

  private buildUtterance(text: string, voice_profile: SpeechVoiceProfiles[SpeechRole]): SpeechSynthesisUtterance {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice_profile.voice?.lang ?? SPEECH_LANGUAGE;
    utterance.voice = voice_profile.voice;
    utterance.pitch = voice_profile.pitch;
    utterance.rate = voice_profile.rate;
    return utterance;
  }

  private playUtterance(speech_synthesis: SpeechSynthesis, utterance: SpeechSynthesisUtterance): Promise<void> {
    return new Promise((resolve) => {
      // `onend` is unreliable in some browsers, so a timeout based on the text length backs it up.
      const timeout_ms = SPEECH_TIMEOUT_BASE_MS + utterance.text.length * SPEECH_TIMEOUT_MS_PER_CHARACTER;
      const finishLine = () => {
        clearTimeout(timeout_timer);
        utterance.onend = null;
        utterance.onerror = null;
        this.current_utterance = null;
        this.finishCurrentLine = null;
        resolve();
      };
      const timeout_timer = setTimeout(() => {
        speech_synthesis.cancel();
        finishLine();
      }, timeout_ms);

      utterance.onend = finishLine;
      utterance.onerror = finishLine;
      this.current_utterance = utterance;
      this.finishCurrentLine = finishLine;
      speech_synthesis.speak(utterance);
    });
  }

  private waitUnlessCancelled(wait_ms: number): Promise<void> {
    return new Promise((resolve) => {
      const finishWaiting = () => {
        clearTimeout(wait_timer);
        this.finishCurrentLine = null;
        resolve();
      };
      const wait_timer = setTimeout(finishWaiting, wait_ms);
      this.finishCurrentLine = finishWaiting;
    });
  }
}
