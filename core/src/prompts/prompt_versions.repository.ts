import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { PromptVersion } from './types/prompt_version.type';

// engine.prompt_versions belongs to the api service; core only reads it.
@Injectable()
export class PromptVersionsRepository {
  constructor(private readonly database_service: DatabaseService) {}

  async findActive(): Promise<PromptVersion | undefined> {
    const rows = await this.database_service.query<PromptVersion>(
      `SELECT * FROM engine.prompt_versions WHERE is_active LIMIT 1`,
    );
    return rows[0];
  }
}
