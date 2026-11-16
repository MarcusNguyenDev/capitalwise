import { ConflictException } from '@nestjs/common';

export class FeeAlreadyRefundedError extends ConflictException {
  readonly error_code = 'FEE_ALREADY_REFUNDED';

  constructor(fee_txn_id: string) {
    super(`Fee ${fee_txn_id} has already been refunded.`);
  }
}
