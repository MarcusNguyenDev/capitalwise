import { Injectable } from '@nestjs/common';

import { describeFact } from '../facts/constants/fact_catalogue.constant';
import { NotificationsService } from '../notifications/notifications.service';
import { explainPolicy } from '../policies/policy_engine';
import { clampLimit } from '../shared_kernel/utils/clamp_limit.util';
import { CasesRepository } from './cases.repository';
import {
  DEFAULT_CASE_LIMIT,
  MAX_CASE_LIMIT,
} from './constants/case_status.constant';
import {
  APPROVE_REASON_CODES,
  REJECT_REASON_CODES,
} from './constants/reason_code.constant';
import { ListCasesQueryDto } from './dto/list_cases_query.dto';
import { CaseNotFoundError } from './errors/case_not_found.error';
import { CaseExplanationRow } from './types/case_record.type';

export interface EvidenceRow {
  fact: string;
  label: string;
  value: unknown;
  source: string;
  is_required: boolean;
}

@Injectable()
export class CasesService {
  constructor(
    private readonly cases_repository: CasesRepository,
    private readonly notifications_service: NotificationsService,
  ) {}

  listCases(cases_query: ListCasesQueryDto): Promise<CaseExplanationRow[]> {
    const statuses = cases_query.status
      ? cases_query.status
          .split(',')
          .map((status) => status.trim().toUpperCase())
          .filter((status) => status !== '')
      : null;
    return this.cases_repository.selectCaseExplanations(
      {
        statuses: statuses && statuses.length > 0 ? statuses : null,
        call_id: cases_query.call_id ?? null,
        customer_id: cases_query.customer_id ?? null,
        action_code: cases_query.action_code ?? null,
      },
      clampLimit(cases_query.limit, {
        default_limit: DEFAULT_CASE_LIMIT,
        max_limit: MAX_CASE_LIMIT,
      }),
    );
  }

  async getCase(case_number: string): Promise<CaseExplanationRow> {
    const case_explanation =
      await this.cases_repository.selectCaseExplanation(case_number);
    if (!case_explanation) {
      throw new CaseNotFoundError(case_number);
    }
    return case_explanation;
  }

  // Everything a staff member needs to decide without leaving the queue.
  async getCasePack(case_number: string) {
    const case_explanation = await this.getCase(case_number);
    const [transcript_excerpt, notifications] = await Promise.all([
      this.cases_repository.selectTranscriptExcerpt(case_number),
      this.notifications_service.listCaseNotifications(case_number),
    ]);
    return {
      case: case_explanation,
      evidence: this.buildEvidence(case_explanation),
      rules: explainPolicy(
        case_explanation.policy_definition,
        case_explanation.facts,
      ),
      transcript_excerpt,
      notifications,
      reason_codes: {
        approve: APPROVE_REASON_CODES,
        reject: REJECT_REASON_CODES,
      },
    };
  }

  // Every fact, with the evidence the action type requires listed first.
  buildEvidence(case_explanation: CaseExplanationRow): EvidenceRow[] {
    const required_facts = case_explanation.required_evidence ?? [];
    const other_facts = Object.keys(case_explanation.facts).filter(
      (fact) => !required_facts.includes(fact),
    );
    return [...required_facts, ...other_facts].map((fact) => ({
      fact,
      ...describeFact(fact),
      value: case_explanation.facts[fact] ?? null,
      is_required: required_facts.includes(fact),
    }));
  }
}
