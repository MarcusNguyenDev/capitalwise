import { ConflictException } from '@nestjs/common';

export class DisputeAlreadyLodgedError extends ConflictException {
  readonly error_code = 'DISPUTE_ALREADY_LODGED';

  constructor(txn_id: string, dispute_id: string) {
    super(
      `Transaction ${txn_id} already has an open dispute (${dispute_id}). Tell the caller it is being investigated.`,
    );
  }
}
