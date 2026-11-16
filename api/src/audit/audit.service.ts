import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { SYSTEM_ACTOR } from '../shared_kernel/constants/system_actor.constant';
import { clampLimit } from '../shared_kernel/utils/clamp_limit.util';
import { AuditRepository } from './audit.repository';
import {
  DEFAULT_AUDIT_LIMIT,
  MAX_AUDIT_LIMIT,
} from './constants/audit_event_type.constant';
import { ListAuditEventsQueryDto } from './dto/list_audit_events_query.dto';

const TAMPERED_ACTOR_ID = 'tampered';

// Thrown inside the tamper test so that, if the UPDATE were ever allowed, the
// transaction still rolls back and the ledger stays untouched.
class TamperNotRejectedSignal extends Error {}

@Injectable()
export class AuditService {
  constructor(
    private readonly audit_repository: AuditRepository,
    private readonly database: DatabaseService,
  ) {}

  async listEvents(events_query: ListAuditEventsQueryDto) {
    const { limit, ...filters } = events_query;
    const row_limit = clampLimit(limit, {
      default_limit: DEFAULT_AUDIT_LIMIT,
      max_limit: MAX_AUDIT_LIMIT,
    });
    const [events, total_count, event_types] = await Promise.all([
      this.audit_repository.selectEvents(filters, row_limit),
      this.audit_repository.countEvents(filters),
      this.audit_repository.selectEventTypes(),
    ]);
    return { events, total_count, event_types };
  }

  listCaseTrail(case_number: string) {
    return this.audit_repository.selectCaseTrail(case_number);
  }

  // Proves the ledger is append-only by really trying to change it.
  async runTamperTest() {
    const latest_event_id = await this.audit_repository.selectLatestEventId();
    const attempted_sql = `UPDATE engine.audit_events SET actor_id = '${TAMPERED_ACTOR_ID}' WHERE event_id = ${latest_event_id ?? 'NULL'}`;
    try {
      await this.database.runInTransaction(
        SYSTEM_ACTOR,
        async (transaction) => {
          await this.audit_repository.updateEventActor(
            transaction,
            latest_event_id ?? 0,
            TAMPERED_ACTOR_ID,
          );
          throw new TamperNotRejectedSignal();
        },
      );
    } catch (error) {
      if (!(error instanceof TamperNotRejectedSignal)) {
        return {
          attempted_sql,
          is_rejected: true,
          database_error: (error as Error).message,
        };
      }
    }
    return { attempted_sql, is_rejected: false, database_error: null };
  }
}
