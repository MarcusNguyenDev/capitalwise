import { InternalServerErrorException } from '@nestjs/common';

export class PolicyNotConfiguredError extends InternalServerErrorException {
  readonly error_code = 'POLICY_NOT_CONFIGURED';

  constructor(action_code: string) {
    super(`No active policy is configured for ${action_code}.`);
  }
}
