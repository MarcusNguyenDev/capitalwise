import { BadRequestException } from '@nestjs/common';

export class InvalidEditedParamsError extends BadRequestException {
  readonly error_code = 'INVALID_EDITED_PARAMS';

  constructor(detail: string) {
    super(`The edited terms are not valid: ${detail}`);
  }
}
