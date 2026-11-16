import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { TransactionClient } from '../database/types/transaction_client.type';
import { CaseDraft, CaseReevaluation } from './types/case_intake.type';
import { CaseExplanationRow, CaseRecord } from './types/case_record.type';

export interface CaseFilters {
  statuses: string[] | null;
  call_id: string | null;
  customer_id: string | null;
  action_code: string | null;
}

export interface CaseSubject {
  param_name: string;
  param_value: string;
}

export interface CaseDecisionUpdate {
  case_number: string;
  decision: string;
  reason_code: string;
  staff_id: string;
  params: Record<string, unknown>;
}

export interface BatchCandidate {
  case_number: string;
  customer_name: string;
  action_code: string;
  recommendation: string;
  matched_rule_id: string;
  route_reason: string;
  amount: number | null;
  summary: string;
  created_at: Date;
}

@Injectable()
export class CasesRepository {
  constructor(private readonly database: DatabaseService) {}

  async insertCase(
    transaction: TransactionClient,
    case_draft: CaseDraft,
    agent_versions: { model: string; prompt_version: string },
  ): Promise<string> {
    const { intake, policy_decision, routing_decision } = case_draft;
    const { policy, evaluation } = policy_decision;
    const case_rows = await transaction.query<{ case_number: string }>(
      `INSERT INTO engine.cases
         (call_id, customer_id, customer_name, action_code, params, tier, status, priority, summary, customer_statement,
          facts, soft_signals, recommendation, confidence, policy_id, policy_version, matched_rule_id, route_reason,
          required_skill, routing_rule, model, prompt_version, assigned_staff_id, sla_due_at, response_due_on)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10,
               $11::jsonb, $12::jsonb, $13, $14, $15, $16, $17, $18,
               $19, $20, $21, $22, $23,
               now() + make_interval(mins => $24::int), $25::date)
       RETURNING case_number`,
      [
        intake.call.call_id,
        intake.caller.customer_id,
        intake.caller.customer_name,
        intake.action_type.action_code,
        JSON.stringify(case_draft.params),
        case_draft.tier,
        case_draft.status,
        routing_decision.priority,
        intake.summary,
        intake.customer_statement,
        JSON.stringify(case_draft.facts),
        JSON.stringify(intake.soft_signals),
        evaluation.recommend,
        evaluation.confidence,
        policy.policy_id,
        policy.version,
        evaluation.matched_rule_id,
        evaluation.reason,
        routing_decision.required_skill,
        routing_decision.routing_rule,
        agent_versions.model,
        agent_versions.prompt_version,
        routing_decision.assigned_staff?.staff_id ?? null,
        routing_decision.sla_minutes,
        routing_decision.response_due_on,
      ],
    );
    return case_rows[0].case_number;
  }

  async updateCaseEvaluation(
    transaction: TransactionClient,
    reevaluation: CaseReevaluation,
  ): Promise<void> {
    const { policy, evaluation } = reevaluation.policy_decision;
    await transaction.query(
      `UPDATE engine.cases
       SET facts = $2::jsonb, soft_signals = $3::jsonb, recommendation = $4, confidence = $5,
           policy_id = $6, policy_version = $7, matched_rule_id = $8, route_reason = $9
       WHERE case_number = $1`,
      [
        reevaluation.case_number,
        JSON.stringify(reevaluation.facts),
        JSON.stringify(reevaluation.soft_signals),
        evaluation.recommend,
        evaluation.confidence,
        policy.policy_id,
        policy.version,
        evaluation.matched_rule_id,
        evaluation.reason,
      ],
    );
  }

  async updateCaseRouting(
    transaction: TransactionClient,
    reevaluation: CaseReevaluation,
    case_status: string,
  ): Promise<void> {
    const routing_decision = reevaluation.routing_decision;
    await transaction.query(
      `UPDATE engine.cases
       SET tier = $2, status = $3, priority = $4, required_skill = $5, routing_rule = $6,
           assigned_staff_id = $7, sla_due_at = now() + make_interval(mins => $8::int)
       WHERE case_number = $1`,
      [
        reevaluation.case_number,
        reevaluation.tier,
        case_status,
        routing_decision.priority,
        routing_decision.required_skill,
        routing_decision.routing_rule,
        routing_decision.assigned_staff?.staff_id ?? null,
        routing_decision.sla_minutes,
      ],
    );
  }

  async updateCaseDecision(
    transaction: TransactionClient,
    decision_update: CaseDecisionUpdate,
  ): Promise<void> {
    // The decision value doubles as the interim status (APPROVED,
    // EDITED_AND_APPROVED or REJECTED) before execution moves it to EXECUTED.
    await transaction.query(
      `UPDATE engine.cases
       SET decision = $2, status = $2, decision_reason_code = $3, decided_by = $4, decided_at = now(), params = $5::jsonb
       WHERE case_number = $1`,
      [
        decision_update.case_number,
        decision_update.decision,
        decision_update.reason_code,
        decision_update.staff_id,
        JSON.stringify(decision_update.params),
      ],
    );
  }

  async updateCaseStatus(
    transaction: TransactionClient,
    case_number: string,
    case_status: string,
  ): Promise<void> {
    await transaction.query(
      `UPDATE engine.cases SET status = $2 WHERE case_number = $1`,
      [case_number, case_status],
    );
  }

  async selectCaseForUpdate(
    transaction: TransactionClient,
    case_number: string,
  ): Promise<CaseRecord | null> {
    const case_rows = await transaction.query<CaseRecord>(
      `SELECT * FROM engine.cases WHERE case_number = $1 FOR UPDATE`,
      [case_number],
    );
    return case_rows[0] ?? null;
  }

  async selectCaseExplanation(
    case_number: string,
  ): Promise<CaseExplanationRow | null> {
    const case_rows = await this.database.query<CaseExplanationRow>(
      `SELECT * FROM engine.v_decision_explanations WHERE case_number = $1`,
      [case_number],
    );
    return case_rows[0] ?? null;
  }

  selectCaseExplanations(
    filters: CaseFilters,
    row_limit: number,
  ): Promise<CaseExplanationRow[]> {
    return this.database.query<CaseExplanationRow>(
      `SELECT * FROM engine.v_decision_explanations
       WHERE ($1::text[] IS NULL OR status = ANY($1::text[]))
         AND ($2::uuid IS NULL OR call_id = $2::uuid)
         AND ($3::text IS NULL OR customer_id = $3)
         AND ($4::text IS NULL OR action_code = $4)
       ORDER BY created_at DESC, case_number DESC
       LIMIT $5`,
      [
        filters.statuses,
        filters.call_id,
        filters.customer_id,
        filters.action_code,
        row_limit,
      ],
    );
  }

  async selectOpenCase(
    call_id: string,
    action_code: string,
    case_subject: CaseSubject | null,
    statuses: string[],
  ): Promise<CaseRecord | null> {
    const case_rows = await this.database.query<CaseRecord>(
      `SELECT * FROM engine.cases
       WHERE call_id = $1 AND action_code = $2 AND status = ANY($3::text[])
         AND ($4::text IS NULL OR params ->> $4 = $5)
       ORDER BY created_at DESC
       LIMIT 1`,
      [
        call_id,
        action_code,
        statuses,
        case_subject?.param_name ?? null,
        case_subject?.param_value ?? null,
      ],
    );
    return case_rows[0] ?? null;
  }

  selectCallCases(call_id: string, statuses: string[]): Promise<CaseRecord[]> {
    return this.database.query<CaseRecord>(
      `SELECT * FROM engine.cases
       WHERE call_id = $1 AND status = ANY($2::text[])
       ORDER BY priority, created_at`,
      [call_id, statuses],
    );
  }

  async selectExecutionResult(
    case_number: string,
  ): Promise<Record<string, unknown> | null> {
    const result_rows = await this.database.query<{
      execution_result: Record<string, unknown> | null;
    }>(
      `SELECT detail -> 'result' AS execution_result
       FROM engine.audit_events
       WHERE case_number = $1 AND event_type = 'ACTION_EXECUTED'
       ORDER BY event_id DESC
       LIMIT 1`,
      [case_number],
    );
    return result_rows[0]?.execution_result ?? null;
  }

  // The spoken turns around the moment the case was raised: the 8 before it
  // and up to 2 after.
  selectTranscriptExcerpt(case_number: string) {
    return this.database.query(
      `SELECT excerpt.* FROM (
         (SELECT turn.* FROM engine.call_turns AS turn
            JOIN engine.cases AS each_case ON each_case.call_id = turn.call_id
           WHERE each_case.case_number = $1 AND turn.text IS NOT NULL AND turn.created_at <= each_case.created_at
           ORDER BY turn.seq DESC LIMIT 8)
         UNION ALL
         (SELECT turn.* FROM engine.call_turns AS turn
            JOIN engine.cases AS each_case ON each_case.call_id = turn.call_id
           WHERE each_case.case_number = $1 AND turn.text IS NOT NULL AND turn.created_at > each_case.created_at
           ORDER BY turn.seq LIMIT 2)
       ) AS excerpt
       ORDER BY excerpt.seq`,
      [case_number],
    );
  }

  selectApprovalInbox() {
    return this.database.query(
      `SELECT * FROM engine.v_approval_inbox
       ORDER BY priority, sla_due_at NULLS LAST, created_at`,
    );
  }

  selectBatchCandidates(): Promise<BatchCandidate[]> {
    return this.database.query<BatchCandidate>(
      `SELECT case_number, customer_name, action_code, recommendation, matched_rule_id, route_reason,
              (params ->> 'amount')::numeric AS amount, summary, created_at
       FROM engine.cases
       WHERE status = 'PENDING_APPROVAL' AND tier = 2 AND recommendation = 'APPROVE'
       ORDER BY created_at, case_number`,
    );
  }
}
