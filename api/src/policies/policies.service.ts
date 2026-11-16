import { Injectable } from '@nestjs/common';

import { PolicyNotConfiguredError } from './errors/policy_not_configured.error';
import { UnknownActionCodeError } from './errors/unknown_action_code.error';
import { PoliciesRepository } from './policies.repository';
import { evaluatePolicy } from './policy_engine';
import { PolicyFacts } from './types/policy_definition.type';
import { PolicyEvaluation } from './types/policy_evaluation.type';
import { ActionType, PolicyRecord } from './types/policy_registry.type';

export interface PolicyDecision {
  policy: PolicyRecord;
  evaluation: PolicyEvaluation;
}

// The action registry and policy store. The decision itself is the pure
// function in policy_engine.ts; this service only loads what it runs on.
@Injectable()
export class PoliciesService {
  constructor(private readonly policies_repository: PoliciesRepository) {}

  async getActionType(action_code: string): Promise<ActionType> {
    const action_type =
      await this.policies_repository.selectActionType(action_code);
    if (!action_type) {
      throw new UnknownActionCodeError(action_code);
    }
    return action_type;
  }

  async getActivePolicy(action_code: string): Promise<PolicyRecord> {
    const policy =
      await this.policies_repository.selectActivePolicy(action_code);
    if (!policy) {
      throw new PolicyNotConfiguredError(action_code);
    }
    return policy;
  }

  async decide(
    action_code: string,
    facts: PolicyFacts,
  ): Promise<PolicyDecision> {
    const policy = await this.getActivePolicy(action_code);
    return { policy, evaluation: evaluatePolicy(policy.definition, facts) };
  }

  async listRegistry() {
    const [action_types, policies] = await Promise.all([
      this.policies_repository.selectActionTypes(),
      this.policies_repository.selectPolicies(),
    ]);
    return action_types.map((action_type) => {
      const policy_history = policies.filter(
        (policy) => policy.action_code === action_type.action_code,
      );
      return {
        ...action_type,
        active_policy:
          policy_history.find((policy) => policy.is_active) ?? null,
        policy_history,
      };
    });
  }
}
