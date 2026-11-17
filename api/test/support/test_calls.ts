import { DatabaseService } from '../../src/database/database.service';
import { SYSTEM_ACTOR } from '../../src/shared_kernel/constants/system_actor.constant';

export interface TestCaller {
  customer_id: string | null;
  customer_name: string | null;
  caller_number: string;
  // Seeds passed identity attempts up to this level (0 = not verified).
  identity_level: 0 | 1 | 2;
}

// Inserts a live call the way core does, plus, for a verified caller, the
// passed identity attempts the api would have recorded.
export async function startTestCall(
  database: DatabaseService,
  test_caller: TestCaller,
): Promise<string> {
  return database.runInTransaction(SYSTEM_ACTOR, async (transaction) => {
    const call_rows = await transaction.query<{ call_id: string }>(
      `INSERT INTO engine.calls (caller_number, customer_id, customer_name, channel, status, handled_by_agent_id,
                                 identity_verified, identity_level, identity_method, verified_at)
       VALUES ($1, $2, $3, 'BROWSER', 'AI_ACTIVE', 'AI-01', $4 > 0, $4,
               CASE WHEN $4 > 0 THEN 'KNOWLEDGE' END, CASE WHEN $4 > 0 THEN now() END)
       RETURNING call_id`,
      [
        test_caller.caller_number,
        test_caller.customer_id,
        test_caller.customer_name,
        test_caller.identity_level,
      ],
    );
    const call_id = call_rows[0].call_id;
    for (let level = 1; level <= test_caller.identity_level; level += 1) {
      await transaction.query(
        `INSERT INTO engine.identity_attempts (call_id, method, level, question_kinds, is_passed, resolved_customer_id)
         VALUES ($1, 'KNOWLEDGE', $2, '{}', true, $3)`,
        [call_id, level, test_caller.customer_id],
      );
    }
    return call_id;
  });
}

// What core does after a passed answer: point the call at the verified
// customer and copy the identity state onto the call row.
export async function applyCoreIdentityUpdate(
  database: DatabaseService,
  identity_update: {
    call_id: string;
    customer_id: string;
    customer_name: string;
    identity_level: number;
  },
): Promise<void> {
  await database.runInTransaction(SYSTEM_ACTOR, (transaction) =>
    transaction.query(
      `UPDATE engine.calls
       SET customer_id = $2, customer_name = $3, identity_level = $4::smallint, identity_method = 'KNOWLEDGE',
           identity_verified = $4::smallint > 0, verified_at = COALESCE(verified_at, now())
       WHERE call_id = $1`,
      [
        identity_update.call_id,
        identity_update.customer_id,
        identity_update.customer_name,
        identity_update.identity_level,
      ],
    ),
  );
}
