import { NotFoundException } from '@nestjs/common';

export class TransactionNotFoundError extends NotFoundException {
  readonly error_code = 'TRANSACTION_NOT_FOUND';

  constructor(txn_id: string) {
    super(`Transaction ${txn_id} was not found.`);
  }
}
