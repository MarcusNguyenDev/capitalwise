import { BadRequestException } from '@nestjs/common';

export class RequestValidationError extends BadRequestException {
  readonly error_code = 'REQUEST_VALIDATION';

  constructor(validation_messages: string[]) {
    super(`The request is invalid: ${validation_messages.join('; ')}`);
  }
}
