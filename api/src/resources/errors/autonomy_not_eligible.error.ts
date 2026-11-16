import { ConflictException } from '@nestjs/common';

export class AutonomyNotEligibleError extends ConflictException {
  readonly error_code = 'AUTONOMY_NOT_ELIGIBLE';

  constructor(action_code: string) {
    super(`${action_code} is not eligible for an autonomy proposal yet.`);
  }
}
