import { PolicyDefinition } from './policy_definition.type';

export interface ActionType {
  action_code: string;
  description: string;
  risk_class: string;
  reversible: boolean;
  required_evidence: string[];
  required_skill: string | null;
  // 0 anyone, 1 name + date of birth + postcode, 2 plus recent activity.
  required_identity_level: number;
}

export interface PolicyRecord {
  policy_id: string;
  action_code: string;
  version: number;
  is_active: boolean;
  definition: PolicyDefinition;
  created_at: Date;
  approved_by: string;
}
