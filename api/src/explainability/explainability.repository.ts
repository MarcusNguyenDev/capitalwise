import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

const CALL_WITH_NAMES_SQL = `
  SELECT call.call_id, call.caller_number, call.customer_id, call.customer_name, call.channel, call.status,
         call.handled_by_agent_id, agent.display_name AS agent_name,
         call.assigned_staff_id, staff.name AS assigned_staff_name,
         call.identity_verified, call.verified_at, call.intent, call.sentiment, call.risk_level,
         call.attention_reason, call.started_at, call.ended_at, call.ai_summary, call.metrics,
         EXTRACT(EPOCH FROM (COALESCE(call.ended_at, now()) - call.started_at))::int AS duration_seconds
  FROM engine.calls AS call
  LEFT JOIN engine.ai_agents AS agent ON agent.agent_id = call.handled_by_agent_id
  LEFT JOIN engine.staff_users AS staff ON staff.staff_id = call.assigned_staff_id`;

export interface TimelineCall {
  call_id: string;
  started_at: Date;
  [column: string]: unknown;
}

export interface TimelineTurn {
  seq: number;
  speaker: string;
  text: string | null;
  tool_name: string | null;
  tool_args: unknown;
  tool_result: unknown;
  latency_ms: number | null;
  created_at: Date;
}

export interface TimelineIntervention {
  intervention_id: string;
  type: string;
  staff_id: string;
  staff_name: string | null;
  text: string | null;
  created_at: Date;
}

@Injectable()
export class ExplainabilityRepository {
  constructor(private readonly database: DatabaseService) {}

  // Tool calls on the call up to the moment the case was created, plus the
  // tool call that created it (core writes that turn just after we respond).
  selectCaseToolCalls(case_number: string) {
    return this.database.query(
      `SELECT turn.seq, turn.tool_name, turn.tool_args, turn.tool_result, turn.latency_ms, turn.created_at
       FROM engine.call_turns AS turn
       JOIN engine.cases AS each_case ON each_case.call_id = turn.call_id
       WHERE each_case.case_number = $1
         AND turn.tool_name IS NOT NULL
         AND (
           turn.created_at <= each_case.created_at
           OR turn.turn_id = (
             SELECT creating_turn.turn_id
             FROM engine.call_turns AS creating_turn
             WHERE creating_turn.call_id = each_case.call_id
               AND creating_turn.tool_name IS NOT NULL
               AND creating_turn.created_at > each_case.created_at
               AND creating_turn.tool_result::text LIKE '%' || each_case.case_number || '%'
             ORDER BY creating_turn.seq
             LIMIT 1
           )
         )
       ORDER BY turn.seq`,
      [case_number],
    );
  }

  selectCallInterventions(call_id: string): Promise<TimelineIntervention[]> {
    return this.database.query<TimelineIntervention>(
      `SELECT intervention.intervention_id, intervention.type, intervention.staff_id, staff.name AS staff_name,
              intervention.text, intervention.created_at
       FROM engine.interventions AS intervention
       LEFT JOIN engine.staff_users AS staff ON staff.staff_id = intervention.staff_id
       WHERE intervention.call_id = $1
       ORDER BY intervention.created_at, intervention.intervention_id`,
      [call_id],
    );
  }

  selectCalls(call_status: 'ended' | 'live' | 'all', row_limit: number) {
    return this.database.query(
      `SELECT call.call_id, call.customer_name, call.intent, call.channel, call.status, call.started_at, call.ended_at,
              EXTRACT(EPOCH FROM (COALESCE(call.ended_at, now()) - call.started_at))::int AS duration_seconds,
              (SELECT COUNT(*)::int FROM engine.call_turns AS turn WHERE turn.call_id = call.call_id) AS turn_count
       FROM engine.calls AS call
       WHERE ($1 = 'all')
          OR ($1 = 'ended' AND call.status = 'ENDED')
          OR ($1 = 'live' AND call.status <> 'ENDED')
       ORDER BY call.started_at DESC
       LIMIT $2`,
      [call_status, row_limit],
    );
  }

  async selectCall(call_id: string): Promise<TimelineCall | null> {
    const call_rows = await this.database.query<TimelineCall>(
      `${CALL_WITH_NAMES_SQL} WHERE call.call_id = $1`,
      [call_id],
    );
    return call_rows[0] ?? null;
  }

  selectCallTurns(call_id: string): Promise<TimelineTurn[]> {
    return this.database.query<TimelineTurn>(
      `SELECT seq, speaker, text, tool_name, tool_args, tool_result, latency_ms, created_at
       FROM engine.call_turns
       WHERE call_id = $1
       ORDER BY seq`,
      [call_id],
    );
  }
}
