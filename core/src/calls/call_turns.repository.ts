import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { TransactionClient } from '../database/types/transaction_client.type';
import { CallTurn, NewCallTurn } from './types/call_turn.type';

@Injectable()
export class CallTurnsRepository {
  constructor(private readonly database_service: DatabaseService) {}

  findTurnsByCallId(call_id: string): Promise<CallTurn[]> {
    return this.database_service.query<CallTurn>(
      `SELECT * FROM engine.call_turns WHERE call_id = $1 ORDER BY seq`,
      [call_id],
    );
  }

  // The caller must hold the call row lock (CallsRepository.findCallForUpdate)
  // so two turns never compute the same seq.
  async insertTurn(
    transaction: TransactionClient,
    new_turn: NewCallTurn,
  ): Promise<CallTurn> {
    const rows = await transaction.query<CallTurn>(
      `INSERT INTO engine.call_turns (call_id, seq, speaker, text, tool_name, tool_args, tool_result, latency_ms)
       VALUES (
         $1,
         (SELECT COALESCE(MAX(seq), 0) + 1 FROM engine.call_turns WHERE call_id = $1),
         $2, $3, $4, $5::jsonb, $6::jsonb, $7
       )
       RETURNING *`,
      [
        new_turn.call_id,
        new_turn.speaker,
        new_turn.text ?? null,
        new_turn.tool_name ?? null,
        new_turn.tool_args ? JSON.stringify(new_turn.tool_args) : null,
        new_turn.tool_result ? JSON.stringify(new_turn.tool_result) : null,
        new_turn.latency_ms ?? null,
      ],
    );
    return rows[0];
  }
}
