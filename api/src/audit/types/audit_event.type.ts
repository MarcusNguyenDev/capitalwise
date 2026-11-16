import { Actor } from '../../shared_kernel/types/actor.type';

export interface NewAuditEvent {
  event_type: string;
  call_id?: string | null;
  case_number?: string | null;
  detail: Record<string, unknown>;
  // Defaults to the actor of the surrounding transaction.
  actor?: Actor;
}

export interface AuditEventFilters {
  actor_type?: string;
  actor_id?: string;
  event_type?: string;
  call_id?: string;
  case_number?: string;
  search?: string;
  before_event_id?: number;
}
