import { ForbiddenException } from '@nestjs/common';

export class HeldPaymentNotOwnedError extends ForbiddenException {
  readonly error_code = 'HELD_PAYMENT_NOT_OWNED';

  constructor(txn_id: string) {
    super(`Held payment ${txn_id} does not belong to the caller.`);
  }
}
