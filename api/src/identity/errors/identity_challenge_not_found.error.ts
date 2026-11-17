import { NotFoundException } from '@nestjs/common';

export class IdentityChallengeNotFoundError extends NotFoundException {
  readonly error_code = 'IDENTITY_CHALLENGE_NOT_FOUND';

  constructor(challenge_id: string) {
    super(
      `Identity check ${challenge_id} was not found on this call. Start a new one with start_identity_check.`,
    );
  }
}
