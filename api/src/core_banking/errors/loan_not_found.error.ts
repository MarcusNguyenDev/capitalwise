import { NotFoundException } from '@nestjs/common';

export class LoanNotFoundError extends NotFoundException {
  readonly error_code = 'LOAN_NOT_FOUND';

  constructor(account_id: string) {
    super(`Account ${account_id} is not a loan account.`);
  }
}
