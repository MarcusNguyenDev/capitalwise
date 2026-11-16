export interface VoiceModelStatus {
  provider: string;
  model: string;
  is_reachable: boolean;
  detail: string;
}

export interface VoiceStatus {
  is_live_available: boolean;
  unavailable_reason: string | null;
  // Browser-facing LiveKit URL; null means ws://<page hostname>:7880.
  livekit_url: string | null;
  // LiveKit configured and reachable (staff listen/talk work even in Scripted mode).
  is_media_available: boolean;
  language_model: VoiceModelStatus;
  speech_to_text: VoiceModelStatus;
  text_to_speech: VoiceModelStatus & { ai_voice: string; staff_voice: string };
}
