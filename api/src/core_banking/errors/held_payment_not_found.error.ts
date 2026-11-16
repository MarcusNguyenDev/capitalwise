import { NotFoundException } from '@nestjs/common';

export class HeldPaymentNotFoundError extends NotFoundException {
  readonly error_code = 'HELD_PAYMENT_NOT_FOUND';

  constructor(detail: string) {
    super(`No held payment was found: ${detail}`);
  }
}
