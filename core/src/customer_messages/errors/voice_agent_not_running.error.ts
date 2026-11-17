import { ConflictException } from '@nestjs/common';

export class VoiceAgentNotRunningError extends ConflictException {
  readonly error_code = 'VOICE_AGENT_NOT_RUNNING';

  constructor(call_id: string) {
    super(
      `No AI specialist is listening on call ${call_id} yet. Join the call's audio first.`,
    );
  }
}
