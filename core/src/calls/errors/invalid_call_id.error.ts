import { BadRequestException } from '@nestjs/common';

export class InvalidCallIdError extends BadRequestException {
  readonly error_code = 'INVALID_CALL_ID';

  constructor() {
    super('call_id must be a UUID.');
  }
}
