import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { TransactionClient } from '../database/types/transaction_client.type';
import { RECENT_ROUTE_COUNT } from './constants/autonomy_thresholds.constant';
import {
  AutonomyProposal,
  AutonomyStats,
  NewAutonomyProposal,
} from './types/autonomy.type';

const PROPOSALS_WITH_NAMES_SQL = `
  SELECT proposal.*, proposer.name AS proposed_by_name, signer.name AS signed_off_by_name
  FROM engine.autonomy_proposals AS proposal
  LEFT JOIN engine.staff_users AS proposer ON proposer.staff_id = proposal.proposed_by
  LEFT JOIN engine.staff_users AS signer ON signer.staff_id = proposal.signed_off_by`;

@Injectable()
export class ResourcesRepository {
  constructor(private readonly database: DatabaseService) {}

  selectWorkforce() {
    return this.database.query(
      `SELECT * FROM engine.v_workforce ORDER BY staff_id`,
    );
  }

  async selectWorkforceMember(staff_id: string) {
    const workforce_rows = await this.database.query(
      `SELECT * FROM engine.v_workforce WHERE staff_id = $1`,
      [staff_id],
    );
    return workforce_rows[0] ?? null;
  }

  selectAiAgents() {
    return this.database.query(
      `SELECT agent.agent_id, agent.display_name, agent.model, agent.prompt_version, agent.status,
              agent.max_concurrent_calls,
              (SELECT COUNT(*)::int FROM engine.calls AS call
                WHERE call.handled_by_agent_id = agent.agent_id AND call.status <> 'ENDED') AS active_call_count
       FROM engine.ai_agents AS agent
       ORDER BY agent.agent_id`,
    );
  }

  async updateStaffStatus(
    transaction: TransactionClient,
    staff_id: string,
    staff_status: string,
  ): Promise<void> {
    await transaction.query(
      `UPDATE engine.staff_users SET status = $2 WHERE staff_id = $1`,
      [staff_id, staff_status],
    );
  }

  selectWaitingCaseCounts() {
    return this.database.query<{ skill: string; waiting_case_count: number }>(
      `SELECT required_skill AS skill, COUNT(*)::int AS waiting_case_count
       FROM engine.cases
       WHERE status IN ('PENDING_APPROVAL', 'ESCALATED') AND required_skill IS NOT NULL
       GROUP BY required_skill`,
    );
  }

  selectRecentRoutes() {
    return this.database.query(
      `SELECT each_case.case_number, each_case.call_id, each_case.customer_name, each_case.action_code,
              each_case.tier, each_case.status, each_case.required_skill, each_case.routing_rule,
              staff.name AS assigned_staff_name, each_case.created_at
       FROM engine.cases AS each_case
       LEFT JOIN engine.staff_users AS staff ON staff.staff_id = each_case.assigned_staff_id
       WHERE each_case.tier IN (2, 3)
       ORDER BY each_case.created_at DESC, each_case.case_number DESC
       LIMIT $1`,
      [RECENT_ROUTE_COUNT],
    );
  }

  selectPromptVersions() {
    return this.database.query(
      `SELECT version, created_at, content, change_note, is_active
       FROM engine.prompt_versions
       ORDER BY created_at DESC`,
    );
  }

  selectAutonomyStats(): Promise<AutonomyStats[]> {
    return this.database.query<AutonomyStats>(
      `SELECT stats.*, action.reversible, action.description AS action_description
       FROM engine.v_autonomy_stats AS stats
       JOIN engine.action_types AS action ON action.action_code = stats.action_code
       ORDER BY stats.agreement_pct DESC, stats.action_code`,
    );
  }

  // The rule behind most of the approvals staff agreed with: the one a
  // promotion to Tier 1 would be about.
  async selectMostAgreedRule(action_code: string): Promise<string | null> {
    const rule_rows = await this.database.query<{ matched_rule_id: string }>(
      `SELECT matched_rule_id
       FROM engine.cases
       WHERE action_code = $1 AND recommendation = 'APPROVE' AND decision = 'APPROVED'
       GROUP BY matched_rule_id
       ORDER BY COUNT(*) DESC, matched_rule_id
       LIMIT 1`,
      [action_code],
    );
    return rule_rows[0]?.matched_rule_id ?? null;
  }

  selectProposals(): Promise<AutonomyProposal[]> {
    return this.database.query<AutonomyProposal>(
      `${PROPOSALS_WITH_NAMES_SQL} ORDER BY proposal.created_at DESC, proposal.proposal_id DESC`,
    );
  }

  async selectProposal(proposal_id: number): Promise<AutonomyProposal | null> {
    const proposal_rows = await this.database.query<AutonomyProposal>(
      `${PROPOSALS_WITH_NAMES_SQL} WHERE proposal.proposal_id = $1`,
      [proposal_id],
    );
    return proposal_rows[0] ?? null;
  }

  async insertProposal(
    transaction: TransactionClient,
    new_proposal: NewAutonomyProposal,
  ): Promise<number> {
    const proposal_rows = await transaction.query<{ proposal_id: number }>(
      `INSERT INTO engine.autonomy_proposals (action_code, matched_rule_id, title, agreement_pct, decided_cases, proposed_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING proposal_id`,
      [
        new_proposal.action_code,
        new_proposal.matched_rule_id,
        new_proposal.title,
        new_proposal.agreement_pct,
        new_proposal.decided_cases,
        new_proposal.proposed_by,
      ],
    );
    return proposal_rows[0].proposal_id;
  }

  async selectProposalStatusForUpdate(
    transaction: TransactionClient,
    proposal_id: number,
  ): Promise<string | null> {
    const proposal_rows = await transaction.query<{ status: string }>(
      `SELECT status FROM engine.autonomy_proposals WHERE proposal_id = $1 FOR UPDATE`,
      [proposal_id],
    );
    return proposal_rows[0]?.status ?? null;
  }

  async markProposalSignedOff(
    transaction: TransactionClient,
    proposal_id: number,
    staff_id: string,
  ): Promise<void> {
    await transaction.query(
      `UPDATE engine.autonomy_proposals
       SET status = 'SIGNED_OFF', signed_off_by = $2, signed_off_at = now()
       WHERE proposal_id = $1`,
      [proposal_id, staff_id],
    );
  }
}
