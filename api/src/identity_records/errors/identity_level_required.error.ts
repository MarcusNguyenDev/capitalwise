import { ForbiddenException } from '@nestjs/common';

function describeNextStep(required_level: number, current_level: number) {
  return required_level === 2 && current_level === 0
    ? 'call start_identity_check with level 1, then with level 2'
    : `call start_identity_check with level ${required_level}`;
}

// Written for the model: it says exactly what to do next.
export class IdentityLevelRequiredError extends ForbiddenException {
  readonly error_code = 'IDENTITY_LEVEL_REQUIRED';
  readonly error_details: { required_level: number; current_level: number };

  constructor(required_level: number, current_level: number) {
    super(
      `Confirm identity to level ${required_level} first: ${describeNextStep(required_level, current_level)}.`,
    );
    this.error_details = { required_level, current_level };
  }
}
