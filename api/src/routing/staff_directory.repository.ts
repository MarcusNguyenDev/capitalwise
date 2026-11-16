import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { StaffMember } from './types/staff_member.type';

const STAFF_WITH_LOAD_SQL = `
  SELECT staff.staff_id, staff.name, staff.role, staff.skills, staff.status, staff.max_concurrent_supervision,
         (SELECT COUNT(*)::int FROM engine.calls AS call
           WHERE call.assigned_staff_id = staff.staff_id AND call.status <> 'ENDED')
         + (SELECT COUNT(*)::int FROM engine.cases AS each_case
             WHERE each_case.assigned_staff_id = staff.staff_id AND each_case.status = 'ESCALATED') AS current_load
  FROM engine.staff_users AS staff`;

@Injectable()
export class StaffDirectoryRepository {
  constructor(private readonly database: DatabaseService) {}

  selectStaffWithLoad(): Promise<StaffMember[]> {
    return this.database.query<StaffMember>(
      `${STAFF_WITH_LOAD_SQL} ORDER BY staff.staff_id`,
    );
  }

  async selectStaffMember(staff_id: string): Promise<StaffMember | null> {
    const staff_rows = await this.database.query<StaffMember>(
      `${STAFF_WITH_LOAD_SQL} WHERE staff.staff_id = $1`,
      [staff_id],
    );
    return staff_rows[0] ?? null;
  }

  async selectDateFromToday(day_count: number): Promise<string> {
    const date_rows = await this.database.query<{ target_date: string }>(
      `SELECT current_date + $1::int AS target_date`,
      [day_count],
    );
    return date_rows[0].target_date;
  }
}
