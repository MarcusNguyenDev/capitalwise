import { BadRequestException } from '@nestjs/common';

export class LoanSelectionRequiredError extends BadRequestException {
  readonly error_code = 'LOAN_SELECTION_REQUIRED';

  constructor(loan_count: number) {
    super(
      loan_count === 0
        ? 'The caller has no loan account, so a hardship request cannot be raised.'
        : 'The caller has more than one loan. Pass the account_id of the loan the request is about.',
    );
  }
}
