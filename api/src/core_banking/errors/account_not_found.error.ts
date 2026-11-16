import { NotFoundException } from '@nestjs/common';

export class AccountNotFoundError extends NotFoundException {
  readonly error_code = 'ACCOUNT_NOT_FOUND';

  constructor(customer_id: string) {
    super(`Customer ${customer_id} has no account to show.`);
  }
}
