import { Injectable } from '@nestjs/common';

import { AuditRecorderService } from '../audit/audit_recorder.service';
import { AUDIT_EVENT_TYPES } from '../audit/constants/audit_event_type.constant';
import { DatabaseService } from '../database/database.service';
import { STAFF_ROOM } from '../live_events/constants/live_events_channel.constant';
import { LiveEventsPublisher } from '../live_events/live_events.publisher';
import { PoliciesService } from '../policies/policies.service';
import {
  AVAILABLE_STATUS,
  SKILLS,
  TEAM_LEADER_ROLE,
} from '../routing/constants/routing_rules.constant';
import { RouterService } from '../routing/router.service';
import { StaffDirectoryService } from '../routing/staff_directory.service';
import { ResourcesRepository } from './resources.repository';

@Injectable()
export class WorkforceService {
  constructor(
    private readonly database: DatabaseService,
    private readonly resources_repository: ResourcesRepository,
    private readonly staff_directory_service: StaffDirectoryService,
    private readonly router_service: RouterService,
    private readonly policies_service: PoliciesService,
    private readonly audit_recorder_service: AuditRecorderService,
    private readonly live_events_publisher: LiveEventsPublisher,
  ) {}

  async getWorkforce() {
    const [staff, ai_agents] = await Promise.all([
      this.resources_repository.selectWorkforce(),
      this.resources_repository.selectAiAgents(),
    ]);
    return { staff, ai_agents };
  }

  async updateStaffStatus(staff_id: string, staff_status: string) {
    const staff_member =
      await this.staff_directory_service.getStaffMember(staff_id);
    await this.database.runInTransaction(
      { actor_type: 'STAFF', actor_id: staff_id },
      async (transaction) => {
        await this.resources_repository.updateStaffStatus(
          transaction,
          staff_id,
          staff_status,
        );
        await this.audit_recorder_service.recordEvent(transaction, {
          event_type: AUDIT_EVENT_TYPES.STAFF_STATUS_CHANGED,
          detail: { staff_id, from: staff_member.status, to: staff_status },
        });
      },
    );
    const workforce_member =
      await this.resources_repository.selectWorkforceMember(staff_id);
    await this.live_events_publisher.publish({
      event: 'staff.updated',
      payload: workforce_member as object,
      rooms: [STAFF_ROOM],
    });
    return workforce_member;
  }

  async getRouting() {
    const [staff_members, waiting_case_counts, recent_routes] =
      await Promise.all([
        this.staff_directory_service.listStaff(),
        this.resources_repository.selectWaitingCaseCounts(),
        this.resources_repository.selectRecentRoutes(),
      ]);
    const queues = SKILLS.map((skill) => {
      const assignment = this.router_service.assignStaff(staff_members, skill);
      return {
        skill,
        waiting_case_count:
          waiting_case_counts.find((waiting) => waiting.skill === skill)
            ?.waiting_case_count ?? 0,
        available_staff_count: staff_members.filter(
          (staff_member) =>
            staff_member.status === AVAILABLE_STATUS &&
            staff_member.role !== TEAM_LEADER_ROLE &&
            staff_member.skills.includes(skill),
        ).length,
        expected_wait_minutes: this.router_service.estimateWaitMinutes(
          assignment.assigned_staff,
        ),
      };
    });
    return { queues, recent_routes };
  }

  async getRegistry() {
    return { actions: await this.policies_service.listRegistry() };
  }

  listPromptVersions() {
    return this.resources_repository.selectPromptVersions();
  }
}
