import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { TransactionClient } from '../database/types/transaction_client.type';
import { CallCaseSummary } from './types/call_case_summary.type';
import { CallChanges, CallRow } from './types/call_row.type';
import { LiveCall } from './types/live_call.type';
import { NewCall } from './types/new_call.type';

// Same columns as engine.v_live_calls, without its "not ended" filter, so an
// ended call can be returned in the LiveCall shape too.
const LIVE_CALL_SELECT = `
  SELECT
    call.call_id, call.caller_number, call.customer_id, call.customer_name, call.channel, call.status,
    call.handled_by_agent_id, agent.display_name AS agent_name,
    call.assigned_staff_id, staff.name AS assigned_staff_name,
    call.identity_verified, call.verified_at, call.intent, call.sentiment, call.risk_level,
    call.attention_reason, call.started_at, call.ended_at, call.ai_summary, call.metrics,
    last_turn.text AS last_line, last_turn.speaker AS last_speaker,
    EXTRACT(EPOCH FROM (COALESCE(call.ended_at, now()) - call.started_at))::int AS duration_seconds
  FROM engine.calls AS call
  LEFT JOIN engine.ai_agents AS agent ON agent.agent_id = call.handled_by_agent_id
  LEFT JOIN engine.staff_users AS staff ON staff.staff_id = call.assigned_staff_id
  LEFT JOIN LATERAL (
    SELECT turn.text, turn.speaker
    FROM engine.call_turns AS turn
    WHERE turn.call_id = call.call_id AND turn.text IS NOT NULL AND turn.speaker <> 'SYSTEM'
    ORDER BY turn.seq DESC
    LIMIT 1
  ) AS last_turn ON true`;

const JSONB_CALL_COLUMNS = new Set(['metrics']);

@Injectable()
export class CallsRepository {
  constructor(private readonly database_service: DatabaseService) {}

  findLiveCalls(): Promise<LiveCall[]> {
    return this.database_service.query<LiveCall>(
      `SELECT * FROM engine.v_live_calls
       ORDER BY CASE status WHEN 'NEEDS_ATTENTION' THEN 0 WHEN 'HUMAN_ACTIVE' THEN 1 ELSE 2 END,
                started_at DESC`,
    );
  }

  async findLiveCallById(call_id: string): Promise<LiveCall | undefined> {
    const rows = await this.database_service.query<LiveCall>(
      `${LIVE_CALL_SELECT} WHERE call.call_id = $1`,
      [call_id],
    );
    return rows[0];
  }

  async findCallById(call_id: string): Promise<CallRow | undefined> {
    const rows = await this.database_service.query<CallRow>(
      `SELECT * FROM engine.calls WHERE call_id = $1`,
      [call_id],
    );
    return rows[0];
  }

  // Locks the row so concurrent turns, tools and interventions on one call
  // are applied one after the other.
  async findCallForUpdate(
    transaction: TransactionClient,
    call_id: string,
  ): Promise<CallRow | undefined> {
    const rows = await transaction.query<CallRow>(
      `SELECT * FROM engine.calls WHERE call_id = $1 FOR UPDATE`,
      [call_id],
    );
    return rows[0];
  }

  async findActiveCallIdsByCallerNumber(
    caller_number: string,
  ): Promise<string[]> {
    const rows = await this.database_service.query<{ call_id: string }>(
      `SELECT call_id FROM engine.calls WHERE caller_number = $1 AND status <> 'ENDED'`,
      [caller_number],
    );
    return rows.map((row) => row.call_id);
  }

  async findLeastBusyOnlineAgentId(): Promise<string | null> {
    const rows = await this.database_service.query<{ agent_id: string }>(
      `SELECT agent.agent_id
       FROM engine.ai_agents AS agent
       LEFT JOIN engine.calls AS call
         ON call.handled_by_agent_id = agent.agent_id AND call.status <> 'ENDED'
       WHERE agent.status = 'ONLINE'
       GROUP BY agent.agent_id
       ORDER BY COUNT(call.call_id), agent.agent_id
       LIMIT 1`,
    );
    return rows[0]?.agent_id ?? null;
  }

  async insertCall(
    transaction: TransactionClient,
    new_call: NewCall,
  ): Promise<string> {
    const rows = await transaction.query<{ call_id: string }>(
      `INSERT INTO engine.calls (caller_number, customer_id, customer_name, channel, handled_by_agent_id, metrics)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING call_id`,
      [
        new_call.caller_number,
        new_call.customer_id,
        new_call.customer_name,
        new_call.channel,
        new_call.handled_by_agent_id,
        JSON.stringify(new_call.metrics),
      ],
    );
    return rows[0].call_id;
  }

  async updateCall(
    transaction: TransactionClient,
    call_id: string,
    call_changes: CallChanges,
  ): Promise<void> {
    const changed_columns = Object.keys(call_changes) as (keyof CallChanges)[];
    if (changed_columns.length === 0) {
      return;
    }
    const assignments = changed_columns.map((column_name, column_index) => {
      const placeholder = `$${column_index + 2}`;
      return JSONB_CALL_COLUMNS.has(column_name)
        ? `${column_name} = ${placeholder}::jsonb`
        : `${column_name} = ${placeholder}`;
    });
    const column_values = changed_columns.map((column_name) =>
      JSONB_CALL_COLUMNS.has(column_name)
        ? JSON.stringify(call_changes[column_name])
        : call_changes[column_name],
    );
    await transaction.query(
      `UPDATE engine.calls SET ${assignments.join(', ')} WHERE call_id = $1`,
      [call_id, ...column_values],
    );
  }

  // engine.cases belongs to the api service; core only reads it.
  findCasesByCallId(
    transaction: TransactionClient,
    call_id: string,
  ): Promise<CallCaseSummary[]> {
    return transaction.query<CallCaseSummary>(
      `SELECT case_number, action_code, status, tier
       FROM engine.cases WHERE call_id = $1 ORDER BY created_at, case_number`,
      [call_id],
    );
  }
}
