import { BadRequestException } from '@nestjs/common';

export class NotAFeeError extends BadRequestException {
  readonly error_code = 'NOT_A_FEE';

  constructor(fee_txn_id: string) {
    super(
      `Transaction ${fee_txn_id} is not a fee, so it cannot be refunded as one.`,
    );
  }
}
