import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { engineApiConfig } from '../config/engine_api.config';
import { EngineApiRejectedError } from './errors/engine_api_rejected.error';
import { EngineApiUnavailableError } from './errors/engine_api_unavailable.error';
import { CallerReference } from './types/caller_reference.type';
import { CustomerLookup } from './types/customer_lookup.type';
import { CustomerOverview } from './types/customer_overview.type';
import { EngineApiRequest } from './types/engine_api_request.type';
import {
  IdentityChallenge,
  IdentityCheckResult,
  SubmitIdentityAnswersRequest,
} from './types/identity_challenge.type';
import {
  EngineNotification,
  NotificationStatus,
} from './types/notification.type';
import { ConcernResult, ProposalResult } from './types/proposal_result.type';
import {
  FlagConcernRequest,
  ProposeActionRequest,
} from './types/propose_action_request.type';

type BankingResponse = Record<string, unknown>;

// The api's error envelope; any other field of an error body is a detail.
const ERROR_ENVELOPE_FIELDS = new Set(['status_code', 'error_code', 'message']);

// The only door from core into the api service (system of record). core never
// reads the `bank` schema itself.
@Injectable()
export class EngineApiClient {
  constructor(
    @Inject(engineApiConfig.KEY)
    private readonly engine_api_config: ConfigType<typeof engineApiConfig>,
  ) {}

  lookupCustomer(mobile_phone: string): Promise<CustomerLookup> {
    return this.send({
      method: 'GET',
      path: '/api/banking/customers/lookup',
      query: { mobile_phone },
    });
  }

  getCustomerOverview(caller: CallerReference): Promise<CustomerOverview> {
    return this.send({
      method: 'GET',
      path: `${this.buildCustomerPath(caller.customer_id)}/overview`,
      query: { call_id: caller.call_id },
    });
  }

  getTransactions(
    caller: CallerReference,
    filters: { account_id: string; hours?: number },
  ): Promise<BankingResponse> {
    return this.send({
      method: 'GET',
      path: `${this.buildCustomerPath(caller.customer_id)}/transactions`,
      query: {
        call_id: caller.call_id,
        account_id: filters.account_id,
        hours: filters.hours,
      },
    });
  }

  getFeeHistory(
    caller: CallerReference,
    account_id?: string,
  ): Promise<BankingResponse> {
    return this.send({
      method: 'GET',
      path: `${this.buildCustomerPath(caller.customer_id)}/fee_history`,
      query: { call_id: caller.call_id, account_id },
    });
  }

  getIncomeSummary(caller: CallerReference): Promise<BankingResponse> {
    return this.send({
      method: 'GET',
      path: `${this.buildCustomerPath(caller.customer_id)}/income_summary`,
      query: { call_id: caller.call_id },
    });
  }

  getLoanDetails(
    caller: CallerReference,
    account_id: string,
  ): Promise<BankingResponse> {
    return this.send({
      method: 'GET',
      path: `${this.buildCustomerPath(caller.customer_id)}/loans/${encodeURIComponent(account_id)}`,
      query: { call_id: caller.call_id },
    });
  }

  getHeldPayments(caller: CallerReference): Promise<BankingResponse> {
    return this.send({
      method: 'GET',
      path: `${this.buildCustomerPath(caller.customer_id)}/held_payments`,
      query: { call_id: caller.call_id },
    });
  }

  proposeAction(request_body: ProposeActionRequest): Promise<ProposalResult> {
    return this.send({
      method: 'POST',
      path: '/api/actions/propose',
      body: request_body,
    });
  }

  flagConcern(request_body: FlagConcernRequest): Promise<ConcernResult> {
    return this.send({
      method: 'POST',
      path: '/api/actions/flag_concern',
      body: request_body,
    });
  }

  notifyHumanJoined(request_body: {
    call_id: string;
    staff_id: string;
  }): Promise<{ closed_case_numbers: string[] }> {
    return this.send({
      method: 'POST',
      path: '/api/actions/human_joined',
      body: request_body,
    });
  }

  startIdentityChallenge(request_body: {
    call_id: string;
    level: number;
  }): Promise<IdentityChallenge> {
    return this.send({
      method: 'POST',
      path: '/api/identity/challenges',
      body: request_body,
    });
  }

  submitIdentityAnswers(
    challenge_id: string,
    request_body: SubmitIdentityAnswersRequest,
  ): Promise<IdentityCheckResult> {
    return this.send({
      method: 'POST',
      path: `/api/identity/challenges/${encodeURIComponent(challenge_id)}/answers`,
      body: request_body,
    });
  }

  createIdentityCheck(call_id: string): Promise<EngineNotification> {
    return this.send({
      method: 'POST',
      path: '/api/notifications/identity_check',
      body: { call_id },
    });
  }

  respondToNotification(
    notification_id: string,
    response: Extract<NotificationStatus, 'APPROVED' | 'DENIED'>,
  ): Promise<EngineNotification> {
    return this.send({
      method: 'POST',
      path: `/api/notifications/${encodeURIComponent(notification_id)}/response`,
      body: { response },
    });
  }

  expireNotification(notification_id: string): Promise<EngineNotification> {
    return this.send({
      method: 'POST',
      path: `/api/notifications/${encodeURIComponent(notification_id)}/expire`,
    });
  }

  private buildCustomerPath(customer_id: string): string {
    return `/api/banking/customers/${encodeURIComponent(customer_id)}`;
  }

  private buildUrl(api_request: EngineApiRequest): string {
    const url = new URL(
      `${this.engine_api_config.base_url}${api_request.path}`,
    );
    for (const [query_key, query_value] of Object.entries(
      api_request.query ?? {},
    )) {
      if (query_value !== undefined) {
        url.searchParams.set(query_key, String(query_value));
      }
    }
    return url.toString();
  }

  private async send<ResponseBody>(
    api_request: EngineApiRequest,
  ): Promise<ResponseBody> {
    const request_label = `${api_request.method} ${api_request.path}`;
    const response = await this.fetchResponse(api_request, request_label);
    const response_body = await this.readJsonBody(response);
    if (response.ok) {
      return response_body as ResponseBody;
    }
    if (response.status >= 400 && response.status < 500) {
      throw this.buildRejection(response.status, response_body);
    }
    throw new EngineApiUnavailableError(
      request_label,
      `HTTP ${response.status}`,
    );
  }

  private async fetchResponse(
    api_request: EngineApiRequest,
    request_label: string,
  ): Promise<Response> {
    try {
      return await fetch(this.buildUrl(api_request), {
        method: api_request.method,
        headers: { 'Content-Type': 'application/json' },
        body:
          api_request.method === 'POST'
            ? JSON.stringify(api_request.body ?? {})
            : undefined,
        signal: AbortSignal.timeout(this.engine_api_config.request_timeout_ms),
      });
    } catch (error) {
      throw new EngineApiUnavailableError(
        request_label,
        (error as Error).message,
      );
    }
  }

  private async readJsonBody(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  private buildRejection(
    status_code: number,
    response_body: unknown,
  ): EngineApiRejectedError {
    const error_body = (response_body ?? {}) as {
      status_code?: unknown;
      error_code?: unknown;
      message?: unknown;
      [detail_field: string]: unknown;
    };
    const api_details = Object.fromEntries(
      Object.entries(error_body).filter(
        ([field_name]) => !ERROR_ENVELOPE_FIELDS.has(field_name),
      ),
    );
    const api_message = Array.isArray(error_body.message)
      ? error_body.message.join('; ')
      : error_body.message;
    return new EngineApiRejectedError({
      api_status_code: status_code,
      api_error_code:
        typeof error_body.error_code === 'string'
          ? error_body.error_code
          : 'API_REQUEST_REJECTED',
      api_message:
        typeof api_message === 'string'
          ? api_message
          : `The request was rejected with HTTP ${status_code}.`,
      api_details,
    });
  }
}
