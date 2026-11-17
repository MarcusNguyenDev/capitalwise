import { Injectable } from '@nestjs/common';

import { CustomerNotFoundError } from './errors/customer_not_found.error';
import { IdentityKnowledgeRepository } from './identity_knowledge.repository';
import { CallerDetails } from './types/caller_details.type';
import {
  IdentityCandidate,
  IdentityKnowledge,
} from './types/identity_knowledge.type';

// Identity answers are checked against these values inside the api. Nothing
// here is ever returned to the AI; the browser only gets getCallerDetails,
// through the demo-only endpoint.
@Injectable()
export class IdentityKnowledgeAdapter {
  constructor(
    private readonly identity_knowledge_repository: IdentityKnowledgeRepository,
  ) {}

  findCandidates(
    date_of_birth: string,
    postcode: string,
  ): Promise<IdentityCandidate[]> {
    return this.identity_knowledge_repository.selectCandidates(
      date_of_birth,
      postcode,
    );
  }

  async getKnowledge(
    customer_id: string,
    merchant_window_days: number,
  ): Promise<IdentityKnowledge> {
    const candidate =
      await this.identity_knowledge_repository.selectCandidate(customer_id);
    if (!candidate) {
      throw new CustomerNotFoundError(customer_id);
    }
    const [
      last_income,
      recent_card_merchants,
      card_last_fours,
      loan_repayment_amounts,
    ] = await Promise.all([
      this.identity_knowledge_repository.selectLastIncome(customer_id),
      this.identity_knowledge_repository.selectRecentCardMerchants(
        customer_id,
        merchant_window_days,
      ),
      this.identity_knowledge_repository.selectCardLastFours(customer_id),
      this.identity_knowledge_repository.selectLoanRepaymentAmounts(
        customer_id,
      ),
    ]);
    return {
      ...candidate,
      last_income,
      recent_card_merchants,
      card_last_fours,
      loan_repayment_amounts,
    };
  }

  // Demo only (the caller's own crib sheet on the simulated phone): the
  // answers to every question the AI could ask this customer.
  async getCallerDetails(
    customer_id: string,
    merchant_window_days: number,
  ): Promise<CallerDetails> {
    const [knowledge, contact] = await Promise.all([
      this.getKnowledge(customer_id, merchant_window_days),
      this.identity_knowledge_repository.selectCallerContact(customer_id),
    ]);
    if (!contact) {
      throw new CustomerNotFoundError(customer_id);
    }
    return {
      customer_id,
      full_name: `${knowledge.first_name} ${knowledge.last_name}`,
      date_of_birth: knowledge.date_of_birth,
      mobile_phone: contact.mobile_phone,
      street_address: contact.street_address,
      suburb: contact.suburb,
      state: contact.state,
      postcode: knowledge.postcode,
      last_income: knowledge.last_income
        ? {
            amount: knowledge.last_income.amount,
            kind:
              knowledge.last_income.txn_type === 'GOVT_BENEFIT'
                ? 'GOVT_BENEFIT'
                : 'SALARY',
            posted_at: contact.last_income_at?.toISOString() ?? null,
          }
        : null,
      recent_card_merchants: knowledge.recent_card_merchants,
      card_last_fours: knowledge.card_last_fours,
      loan_repayment_amounts: knowledge.loan_repayment_amounts,
    };
  }
}
