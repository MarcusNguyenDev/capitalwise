import { ConflictException } from '@nestjs/common';

export class IdentityLockedError extends ConflictException {
  readonly error_code = 'IDENTITY_LOCKED';

  constructor(call_id: string) {
    super(
      `Identity checks are locked on call ${call_id} after failed attempts. Do not discuss the account; tell the caller kindly that a specialist will help.`,
    );
  }
}
