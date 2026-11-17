import { Injectable } from '@nestjs/common';

import { CustomerNotFoundError } from './errors/customer_not_found.error';
import { IdentityKnowledgeRepository } from './identity_knowledge.repository';
import {
  IdentityCandidate,
  IdentityKnowledge,
} from './types/identity_knowledge.type';

// Identity answers are checked against these values inside the api. Nothing
// here is ever returned to the AI or the browser.
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
}
