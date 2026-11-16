import { BadRequestException } from '@nestjs/common';

export class RequestValidationError extends BadRequestException {
  readonly error_code = 'VALIDATION_FAILED';

  constructor(validation_messages: string[]) {
    super(validation_messages.join('; '));
  }
}
