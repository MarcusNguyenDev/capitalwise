import { ForbiddenException } from '@nestjs/common';

export class CustomerNotVerifiedCallerError extends ForbiddenException {
  readonly error_code = 'CUSTOMER_NOT_VERIFIED_CALLER';

  constructor(customer_id: string) {
    super(`Customer ${customer_id} is not the verified caller on this call.`);
  }
}
