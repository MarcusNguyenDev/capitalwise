import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { CallRecord } from './types/call_record.type';

@Injectable()
export class CallRecordsRepository {
  constructor(private readonly database: DatabaseService) {}

  async findCall(call_id: string): Promise<CallRecord | null> {
    const call_rows = await this.database.query<CallRecord>(
      `SELECT call.call_id, call.caller_number, call.customer_id, call.customer_name, call.channel, call.status,
              call.handled_by_agent_id, call.assigned_staff_id, call.identity_verified, call.risk_level,
              call.started_at, call.ended_at,
              agent.model AS agent_model, agent.prompt_version AS agent_prompt_version
       FROM engine.calls AS call
       LEFT JOIN engine.ai_agents AS agent ON agent.agent_id = call.handled_by_agent_id
       WHERE call.call_id = $1`,
      [call_id],
    );
    return call_rows[0] ?? null;
  }
}
