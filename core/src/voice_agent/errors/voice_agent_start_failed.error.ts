import { ServiceUnavailableException } from '@nestjs/common';

export class VoiceAgentStartFailedError extends ServiceUnavailableException {
  readonly error_code = 'VOICE_AGENT_START_FAILED';

  constructor(call_id: string, failure_reason: string) {
    super(
      `The AI voice agent could not join call ${call_id}: ${failure_reason}. Use Scripted mode.`,
    );
  }
}
