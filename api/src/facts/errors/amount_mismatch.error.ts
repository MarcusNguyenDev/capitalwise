import { BadRequestException } from '@nestjs/common';

export class AmountMismatchError extends BadRequestException {
  readonly error_code = 'AMOUNT_MISMATCH';

  constructor(fee_txn_id: string, actual_amount: number) {
    super(
      `The amount does not match the bank record for fee ${fee_txn_id}, which is ${actual_amount.toFixed(2)}. Leave the amount out and the bank record is used.`,
    );
  }
}
