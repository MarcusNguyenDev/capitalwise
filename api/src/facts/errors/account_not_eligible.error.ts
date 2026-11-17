import { BadRequestException } from '@nestjs/common';

export class AccountNotEligibleError extends BadRequestException {
  readonly error_code = 'ACCOUNT_NOT_ELIGIBLE';

  constructor(account_id: string, expectation: string) {
    super(`Account ${account_id} is not eligible: ${expectation}.`);
  }
}
