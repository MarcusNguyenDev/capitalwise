import { PolicyRoute } from '../types/policy_definition.type';

export const ROUTE_TIERS: Record<PolicyRoute, number> = {
  AUTO: 1,
  APPROVE: 2,
  ESCALATE: 3,
};

export const TIER_ROUTES: Record<number, PolicyRoute> = {
  1: 'AUTO',
  2: 'APPROVE',
  3: 'ESCALATE',
};

export const ESCALATION_TIER = 3;
export const AUTO_TIER = 1;
