import { Module } from '@nestjs/common';

import { InterventionsRepository } from './interventions.repository';
import { StaffUsersRepository } from './staff_users.repository';

// Data access only, so the calls module can read interventions for the call
// detail without depending on the interventions feature (which depends on calls).
@Module({
  providers: [InterventionsRepository, StaffUsersRepository],
  exports: [InterventionsRepository, StaffUsersRepository],
})
export class InterventionRecordsModule {}
