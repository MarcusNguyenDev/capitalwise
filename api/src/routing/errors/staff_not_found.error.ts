import { NotFoundException } from '@nestjs/common';

export class StaffNotFoundError extends NotFoundException {
  readonly error_code = 'STAFF_NOT_FOUND';

  constructor(staff_id: string) {
    super(`Staff member ${staff_id} was not found.`);
  }
}
