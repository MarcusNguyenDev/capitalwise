import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { SYSTEM_ACTOR } from '../shared_kernel/types/actor.type';

// engine.ai_agents belongs to the api service. core only stamps the model
// it really runs, so cases record it (the api copies it onto each case).
@Injectable()
export class AiAgentsRepository {
  constructor(private readonly database_service: DatabaseService) {}

  async updateModelOfAllAgents(model_label: string): Promise<number> {
    return this.database_service.runInTransaction(
      SYSTEM_ACTOR,
      async (transaction) => {
        const updated_rows = await transaction.query<{ agent_id: string }>(
          `UPDATE engine.ai_agents SET model = $1 WHERE model IS DISTINCT FROM $1 RETURNING agent_id`,
          [model_label],
        );
        return updated_rows.length;
      },
    );
  }
}
