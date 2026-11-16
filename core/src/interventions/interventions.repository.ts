import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { TransactionClient } from '../database/types/transaction_client.type';
import {
  Intervention,
  InterventionType,
  InterventionWithStaff,
} from './types/intervention.type';

const INTERVENTION_WITH_STAFF_SELECT = `
  SELECT intervention.*, staff.name AS staff_name
  FROM engine.interventions AS intervention
  JOIN engine.staff_users AS staff ON staff.staff_id = intervention.staff_id`;

@Injectable()
export class InterventionsRepository {
  constructor(private readonly database_service: DatabaseService) {}

  findByCallId(call_id: string): Promise<InterventionWithStaff[]> {
    return this.database_service.query<InterventionWithStaff>(
      `${INTERVENTION_WITH_STAFF_SELECT}
       WHERE intervention.call_id = $1
       ORDER BY intervention.created_at, intervention.intervention_id`,
      [call_id],
    );
  }

  async findById(
    intervention_id: string,
  ): Promise<InterventionWithStaff | undefined> {
    const rows = await this.database_service.query<InterventionWithStaff>(
      `${INTERVENTION_WITH_STAFF_SELECT} WHERE intervention.intervention_id = $1`,
      [intervention_id],
    );
    return rows[0];
  }

  async findRecentMonitor(
    call_id: string,
    staff_id: string,
    window_seconds: number,
  ): Promise<InterventionWithStaff | undefined> {
    const rows = await this.database_service.query<InterventionWithStaff>(
      `${INTERVENTION_WITH_STAFF_SELECT}
       WHERE intervention.call_id = $1 AND intervention.staff_id = $2 AND intervention.type = 'MONITOR'
         AND intervention.created_at > now() - make_interval(secs => $3)
       ORDER BY intervention.created_at DESC
       LIMIT 1`,
      [call_id, staff_id, window_seconds],
    );
    return rows[0];
  }

  async insertIntervention(
    transaction: TransactionClient,
    new_intervention: {
      call_id: string;
      staff_id: string;
      type: InterventionType;
      text: string | null;
    },
  ): Promise<Intervention> {
    const rows = await transaction.query<Intervention>(
      `INSERT INTO engine.interventions (call_id, staff_id, type, text)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        new_intervention.call_id,
        new_intervention.staff_id,
        new_intervention.type,
        new_intervention.text,
      ],
    );
    return rows[0];
  }
}
