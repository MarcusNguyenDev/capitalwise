import { BadGatewayException } from '@nestjs/common';

export class VoiceSessionMintFailedError extends BadGatewayException {
  readonly error_code = 'VOICE_SESSION_MINT_FAILED';

  constructor(failure_reason: string) {
    super(`OpenAI did not issue a Realtime client secret: ${failure_reason}`);
  }
}
