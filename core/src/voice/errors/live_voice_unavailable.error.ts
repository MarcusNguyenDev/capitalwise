import { ServiceUnavailableException } from '@nestjs/common';

export class LiveVoiceUnavailableError extends ServiceUnavailableException {
  readonly error_code = 'LIVE_VOICE_UNAVAILABLE';

  constructor(unavailable_reason: string) {
    super(
      `Live voice is unavailable: ${unavailable_reason} Use Scripted mode.`,
    );
  }
}
