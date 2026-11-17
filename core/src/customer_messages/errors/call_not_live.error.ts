import { ConflictException } from '@nestjs/common';

export class CallNotLiveError extends ConflictException {
  readonly error_code = 'CALL_NOT_LIVE';

  constructor(call_id: string) {
    super(
      `Call ${call_id} is not a Live call. Typed messages go to the live AI specialist only.`,
    );
  }
}
