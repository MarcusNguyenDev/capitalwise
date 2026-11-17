import { BadRequestException } from '@nestjs/common';

export class UnknownIdentityQuestionError extends BadRequestException {
  readonly error_code = 'UNKNOWN_IDENTITY_QUESTION';

  constructor(question_id: string, challenge_id: string) {
    super(
      `Question ${question_id} is not part of identity check ${challenge_id}. Use the question_id values that start_identity_check returned.`,
    );
  }
}
