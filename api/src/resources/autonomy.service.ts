import { Injectable } from '@nestjs/common';

import { AuditRecorderService } from '../audit/audit_recorder.service';
import { AUDIT_EVENT_TYPES } from '../audit/constants/audit_event_type.constant';
import { DatabaseService } from '../database/database.service';
import { PoliciesService } from '../policies/policies.service';
import { TEAM_LEADER_ROLE } from '../routing/constants/routing_rules.constant';
import { StaffDirectoryService } from '../routing/staff_directory.service';
import {
  AUTONOMY_SUBJECTS,
  MIN_AGREEMENT_PCT,
  MIN_DECIDED_CASES,
  PENDING_SIGN_OFF_STATUS,
} from './constants/autonomy_thresholds.constant';
import { CreateAutonomyProposalDto } from './dto/create_autonomy_proposal.dto';
import { AutonomyNotEligibleError } from './errors/autonomy_not_eligible.error';
import { AutonomyProposalAlreadyResolvedError } from './errors/autonomy_proposal_already_resolved.error';
import { AutonomyProposalNotFoundError } from './errors/autonomy_proposal_not_found.error';
import { TeamLeaderRequiredError } from './errors/team_leader_required.error';
import { ResourcesRepository } from './resources.repository';
import { AutonomyProposal, AutonomyStats } from './types/autonomy.type';

// "Earned autonomy": where staff keep agreeing with the policy, propose
// promoting the action to Tier 1. Recording or signing off a proposal NEVER
// changes live policy; that takes a new published policy version.
@Injectable()
export class AutonomyService {
  constructor(
    private readonly database: DatabaseService,
    private readonly resources_repository: ResourcesRepository,
    private readonly staff_directory_service: StaffDirectoryService,
    private readonly policies_service: PoliciesService,
    private readonly audit_recorder_service: AuditRecorderService,
  ) {}

  async getAutonomy() {
    const [autonomy_stats, proposals] = await Promise.all([
      this.resources_repository.selectAutonomyStats(),
      this.resources_repository.selectProposals(),
    ]);
    return {
      stats: autonomy_stats.map((action_stats) => ({
        ...action_stats,
        headline: this.buildHeadline(action_stats),
        is_eligible: this.isEligible(action_stats),
      })),
      proposals,
    };
  }

  async createProposal(
    new_proposal: CreateAutonomyProposalDto,
  ): Promise<AutonomyProposal> {
    const staff_member = await this.staff_directory_service.getStaffMember(
      new_proposal.staff_id,
    );
    await this.policies_service.getActionType(new_proposal.action_code);
    const autonomy_stats =
      await this.resources_repository.selectAutonomyStats();
    const action_stats = autonomy_stats.find(
      (candidate_stats) =>
        candidate_stats.action_code === new_proposal.action_code,
    );
    if (!action_stats || !this.isEligible(action_stats)) {
      throw new AutonomyNotEligibleError(new_proposal.action_code);
    }
    const matched_rule_id =
      await this.resources_repository.selectMostAgreedRule(
        new_proposal.action_code,
      );
    const title = `Promote to Tier 1: ${this.describeSubject(action_stats)}`;
    const proposal_id = await this.database.runInTransaction(
      { actor_type: 'STAFF', actor_id: staff_member.staff_id },
      async (transaction) => {
        const new_proposal_id = await this.resources_repository.insertProposal(
          transaction,
          {
            action_code: action_stats.action_code,
            matched_rule_id,
            title,
            agreement_pct: action_stats.agreement_pct,
            decided_cases: action_stats.decided_cases,
            proposed_by: staff_member.staff_id,
          },
        );
        await this.audit_recorder_service.recordEvent(transaction, {
          event_type: AUDIT_EVENT_TYPES.AUTONOMY_PROPOSED,
          detail: {
            proposal_id: new_proposal_id,
            action_code: action_stats.action_code,
            matched_rule_id,
            agreement_pct: action_stats.agreement_pct,
            decided_cases: action_stats.decided_cases,
            is_live_policy_changed: false,
          },
        });
        return new_proposal_id;
      },
    );
    return this.getProposal(proposal_id);
  }

  async signOffProposal(
    proposal_id: number,
    staff_id: string,
  ): Promise<AutonomyProposal> {
    const staff_member =
      await this.staff_directory_service.getStaffMember(staff_id);
    if (staff_member.role !== TEAM_LEADER_ROLE) {
      throw new TeamLeaderRequiredError(staff_id);
    }
    await this.database.runInTransaction(
      { actor_type: 'STAFF', actor_id: staff_id },
      async (transaction) => {
        const proposal_status =
          await this.resources_repository.selectProposalStatusForUpdate(
            transaction,
            proposal_id,
          );
        if (!proposal_status) {
          throw new AutonomyProposalNotFoundError(proposal_id);
        }
        if (proposal_status !== PENDING_SIGN_OFF_STATUS) {
          throw new AutonomyProposalAlreadyResolvedError(
            proposal_id,
            proposal_status,
          );
        }
        await this.resources_repository.markProposalSignedOff(
          transaction,
          proposal_id,
          staff_id,
        );
        await this.audit_recorder_service.recordEvent(transaction, {
          event_type: AUDIT_EVENT_TYPES.AUTONOMY_SIGNED_OFF,
          detail: { proposal_id, is_live_policy_changed: false },
        });
      },
    );
    return this.getProposal(proposal_id);
  }

  private async getProposal(proposal_id: number): Promise<AutonomyProposal> {
    const proposal =
      await this.resources_repository.selectProposal(proposal_id);
    if (!proposal) {
      throw new AutonomyProposalNotFoundError(proposal_id);
    }
    return proposal;
  }

  private isEligible(action_stats: AutonomyStats): boolean {
    return (
      action_stats.agreement_pct >= MIN_AGREEMENT_PCT &&
      action_stats.decided_cases >= MIN_DECIDED_CASES &&
      action_stats.reversible
    );
  }

  private describeSubject(action_stats: AutonomyStats): string {
    return (
      AUTONOMY_SUBJECTS[action_stats.action_code] ??
      action_stats.action_description
    );
  }

  private buildHeadline(action_stats: AutonomyStats): string {
    const agreement_summary = `${this.describeSubject(action_stats)}: ${Math.round(action_stats.agreement_pct)}% staff agreement over ${action_stats.decided_cases} decisions.`;
    if (this.isEligible(action_stats)) {
      return `${agreement_summary} Propose promoting to Tier 1?`;
    }
    const blocker = !action_stats.reversible
      ? 'the action cannot be undone, so a person always decides'
      : action_stats.agreement_pct < MIN_AGREEMENT_PCT
        ? `agreement is below ${MIN_AGREEMENT_PCT}%`
        : `fewer than ${MIN_DECIDED_CASES} decisions so far`;
    return `${agreement_summary} Not eligible for Tier 1: ${blocker}.`;
  }
}
