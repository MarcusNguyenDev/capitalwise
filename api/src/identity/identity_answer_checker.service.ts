import { Injectable } from '@nestjs/common';

import { IdentityKnowledgeAdapter } from '../core_banking/identity_knowledge.adapter';
import { IdentityCandidate } from '../core_banking/types/identity_knowledge.type';
import {
  IdentityChallenge,
  IdentityQuestionKind,
} from '../identity_records/types/identity_challenge.type';
import { RECENT_CARD_MERCHANT_DAYS } from './constants/identity_question.constant';
import { IdentityAnswerDto } from './dto/submit_identity_answers.dto';
import { isUnanswered } from './matchers/normalise_spoken_text.util';
import { parseDateOfBirth } from './matchers/parse_date_of_birth.util';
import { extractSpokenDigits } from './matchers/spoken_number.util';
import { AnswerVerdict } from './types/identity_check.type';
import {
  isLevelOneAnswerCorrect,
  isLevelTwoAnswerCorrect,
} from './utils/check_identity_answer.util';
import { resolveIdentityCustomer } from './utils/resolve_identity_customer.util';

const POSTCODE_LENGTH = 4;

interface AnsweredQuestion {
  kind: IdentityQuestionKind;
  answer: string;
}

// Compares what the caller said with the bank's records. The expected values
// never leave this service.
@Injectable()
export class IdentityAnswerCheckerService {
  constructor(
    private readonly identity_knowledge_adapter: IdentityKnowledgeAdapter,
  ) {}

  // Level 1: name, date of birth and postcode must all match one customer.
  async checkLevelOne(
    challenge: IdentityChallenge,
    answers: IdentityAnswerDto[],
    caller_id_customer_id: string | null,
  ): Promise<AnswerVerdict> {
    const answered = this.pairAnswers(challenge, answers);
    const answer_of = (kind: IdentityQuestionKind) =>
      answered.find((answered_question) => answered_question.kind === kind)
        ?.answer ?? '';
    const candidates = await this.findCandidates(
      answer_of('DATE_OF_BIRTH'),
      answer_of('POSTCODE'),
    );
    const matching_candidates = candidates.filter((candidate) =>
      answered.every((answered_question) =>
        isLevelOneAnswerCorrect(
          answered_question.kind,
          answered_question.answer,
          candidate,
        ),
      ),
    );
    const resolution = resolveIdentityCustomer(
      matching_candidates.map((candidate) => candidate.customer_id),
      caller_id_customer_id,
    );
    const resolved_candidate =
      matching_candidates.find(
        (candidate) => candidate.customer_id === resolution.customer_id,
      ) ?? null;
    return {
      is_passed: resolved_candidate !== null,
      resolved_customer: resolved_candidate,
      resolution: resolution.resolution,
    };
  }

  // Level 2: at least one question answered, and every answer given correct.
  // "I don't know" to one question and a right answer to the other passes.
  async checkLevelTwo(
    challenge: IdentityChallenge,
    answers: IdentityAnswerDto[],
    subject_customer_id: string,
  ): Promise<AnswerVerdict> {
    const knowledge = await this.identity_knowledge_adapter.getKnowledge(
      subject_customer_id,
      RECENT_CARD_MERCHANT_DAYS,
    );
    const given_answers = this.pairAnswers(challenge, answers).filter(
      (answered_question) => !isUnanswered(answered_question.answer),
    );
    const is_passed =
      given_answers.length > 0 &&
      given_answers.every((answered_question) =>
        isLevelTwoAnswerCorrect(
          answered_question.kind,
          answered_question.answer,
          knowledge,
        ),
      );
    return {
      is_passed,
      resolved_customer: is_passed ? knowledge : null,
      resolution: is_passed ? 'KNOWLEDGE' : 'NO_MATCH',
    };
  }

  // Answers are validated against the challenge before they get here.
  private pairAnswers(
    challenge: IdentityChallenge,
    answers: IdentityAnswerDto[],
  ): AnsweredQuestion[] {
    return answers.flatMap((answer) => {
      const question = challenge.questions.find(
        (candidate_question) =>
          candidate_question.question_id === answer.question_id,
      );
      return question ? [{ kind: question.kind, answer: answer.answer }] : [];
    });
  }

  private findCandidates(
    date_of_birth_answer: string,
    postcode_answer: string,
  ): Promise<IdentityCandidate[]> {
    const date_of_birth = parseDateOfBirth(date_of_birth_answer);
    const postcode = extractSpokenDigits(postcode_answer);
    if (!date_of_birth || postcode.length !== POSTCODE_LENGTH) {
      return Promise.resolve([]);
    }
    return this.identity_knowledge_adapter.findCandidates(
      date_of_birth,
      postcode,
    );
  }
}
