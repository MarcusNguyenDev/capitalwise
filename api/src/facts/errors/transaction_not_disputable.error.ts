import { BadRequestException } from '@nestjs/common';

export class TransactionNotDisputableError extends BadRequestException {
  readonly error_code = 'TRANSACTION_NOT_DISPUTABLE';

  constructor(txn_id: string) {
    super(
      `Transaction ${txn_id} is not a card purchase or direct debit that has left the account, so it cannot be disputed.`,
    );
  }
}
