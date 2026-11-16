import { ConflictException } from '@nestjs/common';

export class CallerNotMatchedError extends ConflictException {
  readonly error_code = 'CALLER_NOT_MATCHED';

  constructor(call_id: string) {
    super(
      `Call ${call_id} is not matched to a customer, so this cannot be done for the caller.`,
    );
  }
}
