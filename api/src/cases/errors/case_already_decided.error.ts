import { ConflictException } from '@nestjs/common';

export class CaseAlreadyDecidedError extends ConflictException {
  readonly error_code = 'CASE_ALREADY_DECIDED';

  constructor(case_number: string, status: string) {
    super(`Case ${case_number} has already been decided (status ${status}).`);
  }
}
