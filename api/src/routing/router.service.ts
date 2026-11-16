import { Injectable } from '@nestjs/common';

import { ACTION_CODES } from '../facts/constants/action_code.constant';
import {
  AUTO_TIER,
  ESCALATION_TIER,
} from '../policies/constants/route_tier.constant';
import { formatLongDate } from '../shared_kernel/utils/format_long_date.util';
import {
  AVAILABLE_STATUS,
  BASE_WAIT_MINUTES,
  DEFAULT_SKILL,
  ESCALATION_PRIORITY,
  ESCALATION_SLA_MINUTES,
  HARDSHIP_PRIORITY,
  HARDSHIP_RESPONSE_DAYS,
  HARDSHIP_SLA_MINUTES,
  REFUND_SLA_MINUTES,
  STANDARD_PRIORITY,
  TEAM_LEADER_ROLE,
} from './constants/routing_rules.constant';
import { StaffDirectoryRepository } from './staff_directory.repository';
import {
  RoutingDecision,
  RoutingRequest,
  TimingRequest,
} from './types/routing_decision.type';
import { StaffMember } from './types/staff_member.type';

interface StaffAssignment {
  assigned_staff: StaffMember | null;
  routing_rule: string;
}

// Resource management: sends each case to the least-loaded available
// specialist with the right skill, falling back to the team leader.
@Injectable()
export class RouterService {
  constructor(
    private readonly staff_directory_repository: StaffDirectoryRepository,
  ) {}

  async routeCase(routing_request: RoutingRequest): Promise<RoutingDecision> {
    const response_due_on = await this.resolveResponseDueOn(
      routing_request.action_code,
    );
    if (routing_request.tier === AUTO_TIER) {
      return this.buildAutomaticRoute(routing_request, response_due_on);
    }
    const required_skill = routing_request.required_skill ?? DEFAULT_SKILL;
    const staff_members =
      await this.staff_directory_repository.selectStaffWithLoad();
    const assignment = this.assignStaff(staff_members, required_skill);
    const expected_wait_minutes =
      routing_request.tier === ESCALATION_TIER
        ? this.estimateWaitMinutes(assignment.assigned_staff)
        : null;
    return {
      required_skill,
      routing_rule: assignment.routing_rule,
      assigned_staff: assignment.assigned_staff,
      priority: this.resolvePriority(routing_request),
      sla_minutes: this.resolveSlaMinutes(routing_request),
      expected_wait_minutes,
      expected_timing: this.describeTiming({
        action_code: routing_request.action_code,
        tier: routing_request.tier,
        expected_wait_minutes,
        response_due_on,
      }),
      response_due_on,
    };
  }

  estimateWaitMinutes(assigned_staff: StaffMember | null): number {
    return BASE_WAIT_MINUTES + (assigned_staff?.current_load ?? 0);
  }

  describeTiming(timing_request: TimingRequest): string {
    if (timing_request.tier === AUTO_TIER) {
      return 'straight away';
    }
    if (timing_request.tier === ESCALATION_TIER) {
      const wait_minutes =
        timing_request.expected_wait_minutes ?? BASE_WAIT_MINUTES;
      return `about ${wait_minutes} ${wait_minutes === 1 ? 'minute' : 'minutes'}`;
    }
    if (
      timing_request.action_code === ACTION_CODES.HARDSHIP_REQUEST &&
      timing_request.response_due_on
    ) {
      return `within 2 business days, and no later than ${formatLongDate(timing_request.response_due_on)}`;
    }
    return 'within 4 business hours';
  }

  // Pure selection so it can be unit tested without a database.
  assignStaff(
    staff_members: StaffMember[],
    required_skill: string,
  ): StaffAssignment {
    const candidates = staff_members
      .filter(
        (staff_member) =>
          staff_member.status === AVAILABLE_STATUS &&
          staff_member.role !== TEAM_LEADER_ROLE &&
          staff_member.skills.includes(required_skill) &&
          staff_member.current_load < staff_member.max_concurrent_supervision,
      )
      .sort(
        (first, second) =>
          first.current_load - second.current_load ||
          first.staff_id.localeCompare(second.staff_id),
      );
    if (candidates.length > 0) {
      return {
        assigned_staff: candidates[0],
        routing_rule: `Least-loaded available specialist with the ${required_skill} skill`,
      };
    }
    const team_leader =
      staff_members
        .filter((staff_member) => staff_member.role === TEAM_LEADER_ROLE)
        .sort((first, second) =>
          first.staff_id.localeCompare(second.staff_id),
        )[0] ?? null;
    return {
      assigned_staff: team_leader,
      routing_rule: `No available ${required_skill} specialist, fell back to team leader`,
    };
  }

  private buildAutomaticRoute(
    routing_request: RoutingRequest,
    response_due_on: string | null,
  ): RoutingDecision {
    return {
      required_skill: null,
      routing_rule: 'Tier 1 automatic action, no staff needed',
      assigned_staff: null,
      priority: STANDARD_PRIORITY,
      sla_minutes: null,
      expected_wait_minutes: null,
      expected_timing: this.describeTiming({
        action_code: routing_request.action_code,
        tier: AUTO_TIER,
        expected_wait_minutes: null,
        response_due_on,
      }),
      response_due_on,
    };
  }

  private resolveResponseDueOn(action_code: string): Promise<string | null> {
    if (action_code !== ACTION_CODES.HARDSHIP_REQUEST) {
      return Promise.resolve(null);
    }
    return this.staff_directory_repository.selectDateFromToday(
      HARDSHIP_RESPONSE_DAYS,
    );
  }

  private resolvePriority(routing_request: RoutingRequest): number {
    if (routing_request.tier === ESCALATION_TIER) {
      return ESCALATION_PRIORITY;
    }
    return routing_request.action_code === ACTION_CODES.HARDSHIP_REQUEST
      ? HARDSHIP_PRIORITY
      : STANDARD_PRIORITY;
  }

  private resolveSlaMinutes(routing_request: RoutingRequest): number {
    if (routing_request.tier === ESCALATION_TIER) {
      return ESCALATION_SLA_MINUTES;
    }
    return routing_request.action_code === ACTION_CODES.HARDSHIP_REQUEST
      ? HARDSHIP_SLA_MINUTES
      : REFUND_SLA_MINUTES;
  }
}
