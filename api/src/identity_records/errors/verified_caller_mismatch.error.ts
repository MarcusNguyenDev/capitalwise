import { ConflictException } from '@nestjs/common';

// The answers resolved to a customer, but the call record has not been
// pointed at that customer yet (core does that after a passed answer).
export class VerifiedCallerMismatchError extends ConflictException {
  readonly error_code = 'VERIFIED_CALLER_MISMATCH';

  constructor(call_id: string) {
    super(
      `Call ${call_id} is not linked to the verified customer. Set the call's customer_id to the customer_id returned by submit_identity_answers first.`,
    );
  }
}
