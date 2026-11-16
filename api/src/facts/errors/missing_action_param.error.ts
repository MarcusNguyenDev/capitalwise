import { BadRequestException } from '@nestjs/common';

export class MissingActionParamError extends BadRequestException {
  readonly error_code = 'MISSING_ACTION_PARAM';

  constructor(action_code: string, param_name: string) {
    super(`${action_code} needs the parameter ${param_name}.`);
  }
}
