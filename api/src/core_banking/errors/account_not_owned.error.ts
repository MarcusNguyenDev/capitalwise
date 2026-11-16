import { ForbiddenException } from '@nestjs/common';

export class AccountNotOwnedError extends ForbiddenException {
  readonly error_code = 'ACCOUNT_NOT_OWNED';

  constructor(account_id: string) {
    super(`Account ${account_id} does not belong to this customer.`);
  }
}
