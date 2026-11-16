import { ServiceUnavailableException } from '@nestjs/common';

export class LiveVoiceUnavailableError extends ServiceUnavailableException {
  readonly error_code = 'LIVE_VOICE_UNAVAILABLE';

  constructor() {
    super(
      'Live voice is not configured on this server (no OPENAI_API_KEY). Use Scripted mode.',
    );
  }
}
