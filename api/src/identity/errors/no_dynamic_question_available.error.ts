import { ConflictException } from '@nestjs/common';

export class NoDynamicQuestionAvailableError extends ConflictException {
  readonly error_code = 'NO_DYNAMIC_QUESTION_AVAILABLE';

  constructor() {
    super(
      'There is no recent activity to ask the caller about, so level 2 needs a specialist: offer request_human.',
    );
  }
}
