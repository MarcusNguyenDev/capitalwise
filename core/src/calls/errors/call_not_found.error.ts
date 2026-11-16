import { NotFoundException } from '@nestjs/common';

export class CallNotFoundError extends NotFoundException {
  readonly error_code = 'CALL_NOT_FOUND';

  constructor(call_id: string) {
    super(`Call ${call_id} was not found.`);
  }
}
