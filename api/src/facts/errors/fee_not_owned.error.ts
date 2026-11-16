import { ForbiddenException } from '@nestjs/common';

export class FeeNotOwnedError extends ForbiddenException {
  readonly error_code = 'FEE_NOT_OWNED';

  constructor(fee_txn_id: string) {
    super(`Fee ${fee_txn_id} does not belong to the caller.`);
  }
}
