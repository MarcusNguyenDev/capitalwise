import { BadRequestException } from '@nestjs/common';

export class InvalidActionParamError extends BadRequestException {
  readonly error_code = 'INVALID_ACTION_PARAM';

  constructor(action_code: string, param_name: string, expectation: string) {
    super(`${action_code}: ${param_name} must be ${expectation}.`);
  }
}
