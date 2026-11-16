import { ConflictException } from '@nestjs/common';

export class StaffCannotPublishError extends ConflictException {
  readonly error_code = 'STAFF_CANNOT_PUBLISH';

  constructor(call_id: string, staff_id: string) {
    super(
      `${staff_id} can only talk on call ${call_id} after taking it over (the call must be HUMAN_ACTIVE and assigned to them). Listen-in is allowed.`,
    );
  }
}
