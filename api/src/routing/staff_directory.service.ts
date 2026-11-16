import { Injectable } from '@nestjs/common';

import { StaffNotFoundError } from './errors/staff_not_found.error';
import { StaffDirectoryRepository } from './staff_directory.repository';
import { StaffMember } from './types/staff_member.type';

@Injectable()
export class StaffDirectoryService {
  constructor(
    private readonly staff_directory_repository: StaffDirectoryRepository,
  ) {}

  listStaff(): Promise<StaffMember[]> {
    return this.staff_directory_repository.selectStaffWithLoad();
  }

  findStaffMember(staff_id: string): Promise<StaffMember | null> {
    return this.staff_directory_repository.selectStaffMember(staff_id);
  }

  async getStaffMember(staff_id: string): Promise<StaffMember> {
    const staff_member = await this.findStaffMember(staff_id);
    if (!staff_member) {
      throw new StaffNotFoundError(staff_id);
    }
    return staff_member;
  }
}
