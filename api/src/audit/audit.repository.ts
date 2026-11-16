import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { TransactionClient } from '../database/types/transaction_client.type';
import { AuditEventFilters, NewAuditEvent } from './types/audit_event.type';

interface FilterClause {
  where_sql: string;
  params: unknown[];
}

@Injectable()
export class AuditRepository {
  constructor(private readonly database: DatabaseService) {}

  async insertEvent(
    transaction: TransactionClient,
    new_audit_event: NewAuditEvent,
  ): Promise<void> {
    await transaction.query(
      `INSERT INTO engine.audit_events (actor_type, actor_id, event_type, call_id, case_number, detail)
       VALUES (COALESCE($1::text, engine.current_actor_type()),
               CASE WHEN $1::text IS NULL THEN engine.current_actor_id() ELSE $2::text END,
               $3, $4, $5, $6::jsonb)`,
      [
        new_audit_event.actor?.actor_type ?? null,
        new_audit_event.actor?.actor_id ?? null,
        new_audit_event.event_type,
        new_audit_event.call_id ?? null,
        new_audit_event.case_number ?? null,
        JSON.stringify(new_audit_event.detail),
      ],
    );
  }

  selectEvents(filters: AuditEventFilters, row_limit: number) {
    const filter_clause = this.buildFilterClause(filters, true);
    return this.database.query(
      `SELECT event.event_id, event.occurred_at, event.actor_type, event.actor_id, event.event_type,
              event.call_id, event.case_number, event.detail,
              COALESCE(staff.name, agent.display_name) AS actor_name
       FROM engine.audit_events AS event
       LEFT JOIN engine.staff_users AS staff ON event.actor_type = 'STAFF' AND staff.staff_id = event.actor_id
       LEFT JOIN engine.ai_agents AS agent ON event.actor_type = 'AI' AND agent.agent_id = event.actor_id
       ${filter_clause.where_sql}
       ORDER BY event.occurred_at DESC, event.event_id DESC
       LIMIT $${filter_clause.params.length + 1}`,
      [...filter_clause.params, row_limit],
    );
  }

  async countEvents(filters: AuditEventFilters): Promise<number> {
    const filter_clause = this.buildFilterClause(filters, false);
    const count_rows = await this.database.query<{ total_count: number }>(
      `SELECT COUNT(*)::int AS total_count FROM engine.audit_events AS event ${filter_clause.where_sql}`,
      filter_clause.params,
    );
    return count_rows[0].total_count;
  }

  async selectEventTypes(): Promise<string[]> {
    const type_rows = await this.database.query<{ event_type: string }>(
      `SELECT DISTINCT event_type FROM engine.audit_events ORDER BY event_type`,
    );
    return type_rows.map((type_row) => type_row.event_type);
  }

  selectCaseTrail(case_number: string) {
    return this.selectEvents({ case_number }, 500).then((events) =>
      [...events].reverse(),
    );
  }

  async selectLatestEventId(): Promise<number | null> {
    const event_rows = await this.database.query<{ event_id: number }>(
      `SELECT event_id FROM engine.audit_events ORDER BY event_id DESC LIMIT 1`,
    );
    return event_rows[0]?.event_id ?? null;
  }

  async updateEventActor(
    transaction: TransactionClient,
    event_id: number,
    actor_id: string,
  ): Promise<void> {
    await transaction.query(
      `UPDATE engine.audit_events SET actor_id = $2 WHERE event_id = $1`,
      [event_id, actor_id],
    );
  }

  private buildFilterClause(
    filters: AuditEventFilters,
    should_page: boolean,
  ): FilterClause {
    const conditions: string[] = [];
    const params: unknown[] = [];
    const addCondition = (condition_sql: string, param: unknown) => {
      params.push(param);
      conditions.push(condition_sql.replace('?', `$${params.length}`));
    };
    if (filters.actor_type)
      addCondition('event.actor_type = ?', filters.actor_type);
    if (filters.actor_id) addCondition('event.actor_id = ?', filters.actor_id);
    if (filters.event_type)
      addCondition('event.event_type = ?', filters.event_type);
    if (filters.call_id)
      addCondition('event.call_id = ?::uuid', filters.call_id);
    if (filters.case_number)
      addCondition('event.case_number = ?', filters.case_number);
    if (filters.search) {
      addCondition(
        `concat_ws(' ', event.event_type, event.actor_id, event.case_number, event.detail::text) ILIKE '%' || ? || '%'`,
        filters.search,
      );
    }
    if (should_page && filters.before_event_id) {
      // Seeded history is back-dated, so "older than" follows the ledger's
      // time order rather than the insert order.
      addCondition(
        '(event.occurred_at, event.event_id) < (SELECT cursor_event.occurred_at, cursor_event.event_id FROM engine.audit_events AS cursor_event WHERE cursor_event.event_id = ?)',
        filters.before_event_id,
      );
    }
    return {
      where_sql:
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      params,
    };
  }
}
