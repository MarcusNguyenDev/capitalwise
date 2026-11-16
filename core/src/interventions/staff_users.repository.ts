import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

export interface StaffUser {
  staff_id: string;
  name: string;
  role: string;
}

// engine.staff_users belongs to the api service; core only reads it.
@Injectable()
export class StaffUsersRepository {
  constructor(private readonly database_service: DatabaseService) {}

  async findById(staff_id: string): Promise<StaffUser | undefined> {
    const rows = await this.database_service.query<StaffUser>(
      `SELECT staff_id, name, role FROM engine.staff_users WHERE staff_id = $1`,
      [staff_id],
    );
    return rows[0];
  }
}
