import { Injectable } from '@nestjs/common';

import { TransactionClient } from '../database/types/transaction_client.type';
import { AuditRepository } from './audit.repository';
import { NewAuditEvent } from './types/audit_event.type';

// Explicit audit events. Status changes on cases, calls and notifications are
// written by database triggers, so the application cannot forget them.
@Injectable()
export class AuditRecorderService {
  constructor(private readonly audit_repository: AuditRepository) {}

  recordEvent(
    transaction: TransactionClient,
    new_audit_event: NewAuditEvent,
  ): Promise<void> {
    return this.audit_repository.insertEvent(transaction, new_audit_event);
  }
}
