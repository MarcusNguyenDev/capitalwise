import { Injectable } from '@nestjs/common';

import { TransactionClient } from '../database/types/transaction_client.type';
import { AuditEventInput } from './types/audit_event_input.type';

@Injectable()
export class AuditEventsRepository {
  // The actor comes from the transaction settings, the same source the
  // database triggers use, so explicit and trigger events always agree.
  async insertEvent(
    transaction: TransactionClient,
    audit_event: AuditEventInput,
  ): Promise<void> {
    await transaction.query(
      `INSERT INTO engine.audit_events (actor_type, actor_id, event_type, call_id, case_number, detail)
       VALUES (engine.current_actor_type(), engine.current_actor_id(), $1, $2, $3, $4::jsonb)`,
      [
        audit_event.event_type,
        audit_event.call_id,
        audit_event.case_number ?? null,
        JSON.stringify(audit_event.detail),
      ],
    );
  }

  async hasInstructionAppliedEvent(
    transaction: TransactionClient,
    intervention_id: string,
  ): Promise<boolean> {
    const rows = await transaction.query(
      `SELECT 1 FROM engine.audit_events
       WHERE event_type = 'INSTRUCTION_APPLIED' AND detail ->> 'intervention_id' = $1
       LIMIT 1`,
      [intervention_id],
    );
    return rows.length > 0;
  }
}
