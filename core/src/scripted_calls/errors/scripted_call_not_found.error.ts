import { NotFoundException } from '@nestjs/common';

export class ScriptedCallNotFoundError extends NotFoundException {
  readonly error_code = 'SCRIPTED_CALL_NOT_FOUND';

  constructor(customer_id: string) {
    super(`There is no scripted call for customer ${customer_id}.`);
  }
}
