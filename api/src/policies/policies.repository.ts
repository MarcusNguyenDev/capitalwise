import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { ActionType, PolicyRecord } from './types/policy_registry.type';

@Injectable()
export class PoliciesRepository {
  constructor(private readonly database: DatabaseService) {}

  selectActionTypes(): Promise<ActionType[]> {
    return this.database.query<ActionType>(
      `SELECT action_code, description, risk_class, reversible, required_evidence, required_skill
       FROM engine.action_types
       ORDER BY action_code`,
    );
  }

  async selectActionType(action_code: string): Promise<ActionType | null> {
    const action_rows = await this.database.query<ActionType>(
      `SELECT action_code, description, risk_class, reversible, required_evidence, required_skill
       FROM engine.action_types
       WHERE action_code = $1`,
      [action_code],
    );
    return action_rows[0] ?? null;
  }

  async selectActivePolicy(action_code: string): Promise<PolicyRecord | null> {
    const policy_rows = await this.database.query<PolicyRecord>(
      `SELECT policy_id, action_code, version, is_active, definition, created_at, approved_by
       FROM engine.policies
       WHERE action_code = $1 AND is_active`,
      [action_code],
    );
    return policy_rows[0] ?? null;
  }

  selectPolicies(): Promise<PolicyRecord[]> {
    return this.database.query<PolicyRecord>(
      `SELECT policy_id, action_code, version, is_active, definition, created_at, approved_by
       FROM engine.policies
       ORDER BY action_code, version DESC`,
    );
  }
}
