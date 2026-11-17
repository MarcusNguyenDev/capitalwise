import { Injectable } from '@nestjs/common';

import { CallRecordsService } from '../call_records/call_records.service';
import { CallRecord } from '../call_records/types/call_record.type';
import { TransactionClient } from '../database/types/transaction_client.type';
import {
  IDENTITY_LEVELS,
  IDENTITY_METHODS,
} from './constants/identity_level.constant';
import { CustomerNotVerifiedCallerError } from './errors/customer_not_verified_caller.error';
import { IdentityLevelRequiredError } from './errors/identity_level_required.error';
import { IdentityLockedError } from './errors/identity_locked.error';
import { VerifiedCallerMismatchError } from './errors/verified_caller_mismatch.error';
import { IdentityRecordsRepository } from './identity_records.repository';
import { CallIdentity, IdentitySummary } from './types/identity_attempt.type';
import { summariseIdentityAttempts } from './utils/summarise_identity_attempts.util';

export interface AccountAccessRequest {
  call_id: string;
  customer_id: string;
  required_level: number;
}

// Answers "who is this caller, and how sure are we?" from engine.identity_attempts,
// and enforces it on everything that touches an account.
@Injectable()
export class IdentityRecordsService {
  constructor(
    private readonly identity_records_repository: IdentityRecordsRepository,
    private readonly call_records_service: CallRecordsService,
  ) {}

  async summariseCall(call_id: string): Promise<IdentitySummary> {
    const attempts =
      await this.identity_records_repository.selectAttempts(call_id);
    return summariseIdentityAttempts(attempts);
  }

  async getCallIdentity(call_id: string): Promise<CallIdentity> {
    await this.call_records_service.getCall(call_id);
    const summary = await this.summariseCall(call_id);
    return {
      call_id,
      identity_level: summary.identity_level,
      method: summary.method,
      is_locked: summary.is_locked,
      failed_attempts: summary.failed_attempts,
      customer_id: summary.customer_id,
      concern_case_number: summary.is_locked
        ? await this.identity_records_repository.selectLockoutCaseNumber(
            call_id,
          )
        : null,
    };
  }

  // The caller is the customer of the latest passed attempt, the call record
  // must already point at them, and their level must meet the requirement.
  async assertVerifiedCaller(
    call: CallRecord,
    required_level: number,
  ): Promise<IdentitySummary> {
    const summary = await this.summariseCall(call.call_id);
    if (required_level <= IDENTITY_LEVELS.NONE) {
      return summary;
    }
    if (summary.is_locked) {
      throw new IdentityLockedError(call.call_id);
    }
    if (summary.identity_level < required_level) {
      throw new IdentityLevelRequiredError(
        required_level,
        summary.identity_level,
      );
    }
    if (call.customer_id !== summary.customer_id) {
      throw new VerifiedCallerMismatchError(call.call_id);
    }
    return summary;
  }

  async assertAccountAccess(
    access_request: AccountAccessRequest,
  ): Promise<IdentitySummary> {
    const call = await this.call_records_service.getCall(
      access_request.call_id,
    );
    const summary = await this.assertVerifiedCaller(
      call,
      access_request.required_level,
    );
    if (summary.customer_id !== access_request.customer_id) {
      throw new CustomerNotVerifiedCallerError(access_request.customer_id);
    }
    return summary;
  }

  // The optional app push grants level 1 only.
  async recordAppPushVerification(
    transaction: TransactionClient,
    verification: { call_id: string; customer_id: string },
  ): Promise<void> {
    await this.identity_records_repository.insertAttempt(transaction, {
      call_id: verification.call_id,
      challenge_id: null,
      method: IDENTITY_METHODS.APP_PUSH,
      level: IDENTITY_LEVELS.BASIC,
      question_kinds: [],
      is_passed: true,
      resolved_customer_id: verification.customer_id,
    });
  }
}
