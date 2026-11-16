import { RouterService } from './router.service';
import { StaffDirectoryRepository } from './staff_directory.repository';
import { StaffMember } from './types/staff_member.type';

function buildStaffMember(overrides: Partial<StaffMember>): StaffMember {
  return {
    staff_id: 'STF-99',
    name: 'Test Person',
    role: 'FRONTLINE',
    skills: ['FRONTLINE'],
    status: 'AVAILABLE',
    max_concurrent_supervision: 6,
    current_load: 0,
    ...overrides,
  };
}

const SEEDED_STAFF: StaffMember[] = [
  buildStaffMember({
    staff_id: 'STF-01',
    name: 'Alex Chen',
    role: 'TEAM_LEADER',
    skills: ['FRONTLINE', 'HARDSHIP', 'FRAUD', 'CARE'],
    max_concurrent_supervision: 12,
  }),
  buildStaffMember({
    staff_id: 'STF-02',
    name: 'Jordan Lee',
    max_concurrent_supervision: 8,
  }),
  buildStaffMember({
    staff_id: 'STF-03',
    name: 'Sam Patel',
    role: 'HARDSHIP_SPECIALIST',
    skills: ['HARDSHIP', 'CARE'],
  }),
  buildStaffMember({
    staff_id: 'STF-04',
    name: 'Morgan Taylor',
    role: 'FRAUD_SPECIALIST',
    skills: ['FRAUD'],
  }),
  buildStaffMember({
    staff_id: 'STF-05',
    name: 'Casey Brown',
    role: 'FRAUD_SPECIALIST',
    skills: ['FRAUD'],
    status: 'ON_BREAK',
  }),
];

describe('RouterService', () => {
  const selectStaffWithLoad = jest.fn();
  const selectDateFromToday = jest.fn();
  const router_service = new RouterService({
    selectStaffWithLoad,
    selectDateFromToday,
  } as unknown as StaffDirectoryRepository);

  beforeEach(() => {
    selectStaffWithLoad.mockReset().mockResolvedValue(SEEDED_STAFF);
    selectDateFromToday.mockReset().mockResolvedValue('2026-12-07');
  });

  describe('assignStaff', () => {
    it.each([
      ['FRONTLINE', 'Jordan Lee'],
      ['HARDSHIP', 'Sam Patel'],
      ['FRAUD', 'Morgan Taylor'],
      ['CARE', 'Sam Patel'],
    ])('routes %s to %s on the seeded roster', (skill, expected_name) => {
      const assignment = router_service.assignStaff(SEEDED_STAFF, skill);
      expect(assignment.assigned_staff?.name).toBe(expected_name);
      expect(assignment.routing_rule).toBe(
        `Least-loaded available specialist with the ${skill} skill`,
      );
    });

    it('picks the least loaded specialist and breaks ties by staff id', () => {
      const fraud_team = [
        buildStaffMember({
          staff_id: 'STF-07',
          skills: ['FRAUD'],
          current_load: 1,
        }),
        buildStaffMember({
          staff_id: 'STF-06',
          skills: ['FRAUD'],
          current_load: 1,
        }),
        buildStaffMember({
          staff_id: 'STF-05',
          skills: ['FRAUD'],
          current_load: 3,
        }),
      ];
      expect(
        router_service.assignStaff(fraud_team, 'FRAUD').assigned_staff
          ?.staff_id,
      ).toBe('STF-06');
    });

    it('skips staff who are unavailable or at their supervision limit', () => {
      const busy_roster = SEEDED_STAFF.map((staff_member) =>
        staff_member.staff_id === 'STF-04'
          ? { ...staff_member, current_load: 6 }
          : staff_member,
      );
      const assignment = router_service.assignStaff(busy_roster, 'FRAUD');
      expect(assignment.assigned_staff?.name).toBe('Alex Chen');
      expect(assignment.routing_rule).toBe(
        'No available FRAUD specialist, fell back to team leader',
      );
    });

    it('never picks the team leader while a specialist is available', () => {
      const idle_leader_roster = SEEDED_STAFF.map((staff_member) =>
        staff_member.staff_id === 'STF-02'
          ? { ...staff_member, current_load: 5 }
          : staff_member,
      );
      expect(
        router_service.assignStaff(idle_leader_roster, 'FRONTLINE')
          .assigned_staff?.name,
      ).toBe('Jordan Lee');
    });
  });

  describe('routeCase', () => {
    it('Tier 1 needs no staff', async () => {
      const routing_decision = await router_service.routeCase({
        action_code: 'LOCK_CARD',
        tier: 1,
        required_skill: null,
      });
      expect(routing_decision).toMatchObject({
        assigned_staff: null,
        required_skill: null,
        sla_minutes: null,
        expected_wait_minutes: null,
        priority: 3,
      });
      expect(selectStaffWithLoad).not.toHaveBeenCalled();
    });

    it('a fee refund goes to frontline with a 4 hour SLA', async () => {
      const routing_decision = await router_service.routeCase({
        action_code: 'REFUND_FEE',
        tier: 2,
        required_skill: 'FRONTLINE',
      });
      expect(routing_decision).toMatchObject({
        priority: 3,
        sla_minutes: 240,
        expected_timing: 'within 4 business hours',
        expected_wait_minutes: null,
        response_due_on: null,
      });
      expect(routing_decision.assigned_staff?.name).toBe('Jordan Lee');
    });

    it('a hardship request carries the 21-day response date', async () => {
      const routing_decision = await router_service.routeCase({
        action_code: 'HARDSHIP_REQUEST',
        tier: 2,
        required_skill: 'HARDSHIP',
      });
      expect(selectDateFromToday).toHaveBeenCalledWith(21);
      expect(routing_decision).toMatchObject({
        priority: 2,
        sla_minutes: 1440,
        response_due_on: '2026-12-07',
        expected_timing:
          'within 2 business days, and no later than 7 December 2026',
      });
      expect(routing_decision.assigned_staff?.name).toBe('Sam Patel');
    });

    it('Tier 3 is top priority with a 5 minute SLA and a wait of 1 + load minutes', async () => {
      selectStaffWithLoad.mockResolvedValue(
        SEEDED_STAFF.map((staff_member) =>
          staff_member.staff_id === 'STF-04'
            ? { ...staff_member, current_load: 1 }
            : staff_member,
        ),
      );
      const routing_decision = await router_service.routeCase({
        action_code: 'RELEASE_HELD_PAYMENT',
        tier: 3,
        required_skill: 'FRAUD',
      });
      expect(routing_decision).toMatchObject({
        priority: 1,
        sla_minutes: 5,
        expected_wait_minutes: 2,
        expected_timing: 'about 2 minutes',
      });
      expect(routing_decision.assigned_staff?.name).toBe('Morgan Taylor');
    });

    it('falls back to FRONTLINE when an escalated action has no skill of its own', async () => {
      const routing_decision = await router_service.routeCase({
        action_code: 'LOCK_CARD',
        tier: 3,
        required_skill: null,
      });
      expect(routing_decision.required_skill).toBe('FRONTLINE');
      expect(routing_decision.expected_timing).toBe('about 1 minute');
    });
  });
});
