import { ForbiddenException } from '@nestjs/common';

export class IdentityNotVerifiedError extends ForbiddenException {
  readonly error_code = 'IDENTITY_NOT_VERIFIED';

  constructor() {
    super(
      'The caller is not verified yet. Send the identity push and wait for the caller to approve it first.',
    );
  }
}
