import { UnprocessableEntityException } from '@nestjs/common';

export class InvalidCallScriptError extends UnprocessableEntityException {
  readonly error_code = 'INVALID_CALL_SCRIPT';

  constructor(script_label: string, problem: string) {
    super(`Call script ${script_label} is not valid: ${problem}`);
  }
}
