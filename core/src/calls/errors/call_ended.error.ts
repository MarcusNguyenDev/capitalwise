import { ConflictException } from '@nestjs/common';

export class CallEndedError extends ConflictException {
  readonly error_code = 'CALL_ENDED';

  constructor(call_id: string) {
    super(`Call ${call_id} has already ended.`);
  }
}
