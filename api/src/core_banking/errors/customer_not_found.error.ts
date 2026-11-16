import { NotFoundException } from '@nestjs/common';

export class CustomerNotFoundError extends NotFoundException {
  readonly error_code = 'CUSTOMER_NOT_FOUND';

  constructor(customer_id: string) {
    super(`Customer ${customer_id} was not found.`);
  }
}
