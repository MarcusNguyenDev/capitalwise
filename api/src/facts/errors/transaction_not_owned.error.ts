import { ForbiddenException } from '@nestjs/common';

export class TransactionNotOwnedError extends ForbiddenException {
  readonly error_code = 'TRANSACTION_NOT_OWNED';

  constructor(txn_id: string) {
    super(`Transaction ${txn_id} is not on one of the caller's accounts.`);
  }
}
