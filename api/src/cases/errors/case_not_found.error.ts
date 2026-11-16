import { NotFoundException } from '@nestjs/common';

export class CaseNotFoundError extends NotFoundException {
  readonly error_code = 'CASE_NOT_FOUND';

  constructor(case_number: string) {
    super(`Case ${case_number} was not found.`);
  }
}
