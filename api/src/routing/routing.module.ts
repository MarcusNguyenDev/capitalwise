import { Module } from '@nestjs/common';

import { RouterService } from './router.service';
import { StaffDirectoryRepository } from './staff_directory.repository';
import { StaffDirectoryService } from './staff_directory.service';

@Module({
  providers: [StaffDirectoryRepository, StaffDirectoryService, RouterService],
  exports: [StaffDirectoryService, RouterService],
})
export class RoutingModule {}
