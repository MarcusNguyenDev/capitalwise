import type { IdentityLevel, IdentityMethod, LiveCall } from "@/shared/types/call.type";

import type { CallIdentityState } from "./status_wording.constant";

type CallIdentityFields = Pick<LiveCall, "identity_verified"> & Partial<Pick<LiveCall, "identity_level" | "identity_method" | "is_identity_locked">>;

/** The identity level, falling back to `identity_verified` for a call row written before levels existed. */
export function readIdentityLevel(call: CallIdentityFields): IdentityLevel {
  const recorded_level = call.identity_level ?? 0;
  return recorded_level === 0 && call.identity_verified ? 1 : recorded_level;
}

function describeConfirmedState(identity_level: IdentityLevel, identity_method: IdentityMethod | null | undefined): CallIdentityState {
  // A verified call with no method predates the knowledge checks, when the app check was the only method.
  const is_app_check = identity_method === "APP_PUSH" || (!identity_method && identity_level === 1);
  if (is_app_check && identity_level === 1) {
    return "APP_LEVEL_1";
  }
  return identity_level >= 2 ? "QUESTIONS_LEVEL_2" : "QUESTIONS_LEVEL_1";
}

/** One state for the call's identity: locked wins over any level reached before the lock. */
export function describeCallIdentity(call: CallIdentityFields): CallIdentityState {
  if (call.is_identity_locked) {
    return "LOCKED";
  }
  const identity_level = readIdentityLevel(call);
  return identity_level === 0 ? "NOT_CONFIRMED" : describeConfirmedState(identity_level, call.identity_method);
}

/** "1 failed attempt", "2 failed attempts" */
export function describeFailedAttempts(failed_attempt_count: number): string {
  return failed_attempt_count === 1 ? "1 failed attempt" : `${failed_attempt_count} failed attempts`;
}
