export type SpeechRole = "AI" | "CUSTOMER" | "STAFF";

export interface SpeechVoiceProfile {
  voice: SpeechSynthesisVoice | null;
  pitch: number;
  rate: number;
}

export type SpeechVoiceProfiles = Record<SpeechRole, SpeechVoiceProfile>;
