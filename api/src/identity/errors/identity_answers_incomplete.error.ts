import { BadRequestException } from '@nestjs/common';

export class IdentityAnswersIncompleteError extends BadRequestException {
  readonly error_code = 'IDENTITY_ANSWERS_INCOMPLETE';

  constructor(missing_question_ids: string[]) {
    super(
      `Level 1 needs an answer to every question; still missing ${missing_question_ids.join(', ')}. Ask the caller, then submit all the answers together.`,
    );
  }
}
