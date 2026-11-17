import { IdentityKnowledge } from '../../core_banking/types/identity_knowledge.type';
import {
  buildLevelOneQuestions,
  buildLevelTwoQuestions,
} from './build_identity_questions.util';
import {
  isLevelOneAnswerCorrect,
  isLevelTwoAnswerCorrect,
} from './check_identity_answer.util';
import { resolveIdentityCustomer } from './resolve_identity_customer.util';

const SARAH_KNOWLEDGE: IdentityKnowledge = {
  customer_id: 'CUS-1001',
  first_name: 'Sarah',
  last_name: 'Mitchell',
  date_of_birth: '1992-09-14',
  postcode: '4220',
  last_income: { amount: 3180, txn_type: 'SALARY' },
  recent_card_merchants: ['Pulse Gym Cafe', 'Harvest Lane Foods'],
  card_last_fours: ['4821'],
  loan_repayment_amounts: [],
};

describe('resolveIdentityCustomer', () => {
  it('uses the caller-ID customer when the answers fit them', () => {
    expect(resolveIdentityCustomer(['CUS-1001'], 'CUS-1001')).toEqual({
      customer_id: 'CUS-1001',
      resolution: 'CALLER_ID',
    });
  });

  it('binds a landline that is not on file to the one customer who fits', () => {
    expect(resolveIdentityCustomer(['CUS-3002'], null)).toEqual({
      customer_id: 'CUS-3002',
      resolution: 'SOLE_MATCH',
    });
  });

  it("binds a spouse on a shared number to their own record, not the number's owner", () => {
    expect(resolveIdentityCustomer(['CUS-1006'], 'CUS-1005')).toEqual({
      customer_id: 'CUS-1006',
      resolution: 'SOLE_MATCH',
    });
  });

  it('prefers the caller-ID customer when several customers fit', () => {
    expect(
      resolveIdentityCustomer(['CUS-1005', 'CUS-1006'], 'CUS-1006'),
    ).toMatchObject({ customer_id: 'CUS-1006' });
  });

  it('fails when nobody fits, or more than one does', () => {
    expect(resolveIdentityCustomer([], 'CUS-1001')).toEqual({
      customer_id: null,
      resolution: 'NO_MATCH',
    });
    expect(resolveIdentityCustomer(['CUS-1005', 'CUS-1006'], null)).toEqual({
      customer_id: null,
      resolution: 'AMBIGUOUS',
    });
  });
});

describe('identity questions', () => {
  it('level 1 asks name, date of birth and postcode, in plain words', () => {
    expect(buildLevelOneQuestions()).toEqual([
      {
        question_id: 'Q1',
        kind: 'FULL_NAME',
        prompt: 'Could I have your full name, please?',
      },
      {
        question_id: 'Q2',
        kind: 'DATE_OF_BIRTH',
        prompt: "What's your date of birth?",
      },
      {
        question_id: 'Q3',
        kind: 'POSTCODE',
        prompt: "And what's the postcode where you live?",
      },
    ]);
  });

  it('level 2 offers two questions the data supports, income first', () => {
    expect(
      buildLevelTwoQuestions(SARAH_KNOWLEDGE).map((question) => question.kind),
    ).toEqual(['LAST_INCOME_AMOUNT', 'RECENT_CARD_MERCHANT']);
  });

  it('asks about a pension for a government payment', () => {
    const margaret = {
      ...SARAH_KNOWLEDGE,
      last_income: { amount: 1144.4, txn_type: 'GOVT_BENEFIT' },
    };
    expect(buildLevelTwoQuestions(margaret)[0].prompt).toBe(
      'Roughly how much was your last pension or Centrelink payment?',
    );
  });

  it('falls back to a loan repayment, then the last four digits of a card', () => {
    const quiet_customer = {
      ...SARAH_KNOWLEDGE,
      last_income: null,
      recent_card_merchants: [],
      loan_repayment_amounts: [1745],
    };
    expect(
      buildLevelTwoQuestions(quiet_customer).map((question) => question.kind),
    ).toEqual(['LOAN_REPAYMENT_AMOUNT', 'CARD_LAST_FOUR']);
    expect(
      buildLevelTwoQuestions({
        ...quiet_customer,
        loan_repayment_amounts: [],
        card_last_fours: [],
      }),
    ).toEqual([]);
  });

  it('never puts the expected answer in a prompt', () => {
    const prompts = buildLevelTwoQuestions(SARAH_KNOWLEDGE)
      .map((question) => question.prompt)
      .join(' ');
    expect(prompts).not.toMatch(/3180|3,180|Pulse|Harvest|4821/);
  });
});

describe('checking answers', () => {
  it('level 1 checks each answer against one candidate', () => {
    expect(
      isLevelOneAnswerCorrect('FULL_NAME', 'Sarah Mitchell', SARAH_KNOWLEDGE),
    ).toBe(true);
    expect(
      isLevelOneAnswerCorrect(
        'DATE_OF_BIRTH',
        '14th of September 1992',
        SARAH_KNOWLEDGE,
      ),
    ).toBe(true);
    expect(
      isLevelOneAnswerCorrect('POSTCODE', 'four two two one', SARAH_KNOWLEDGE),
    ).toBe(false);
  });

  it('level 2 checks the dynamic answer', () => {
    expect(
      isLevelTwoAnswerCorrect(
        'LAST_INCOME_AMOUNT',
        'about three thousand two hundred',
        SARAH_KNOWLEDGE,
      ),
    ).toBe(true);
    expect(
      isLevelTwoAnswerCorrect(
        'RECENT_CARD_MERCHANT',
        'the gym cafe at Pulse',
        SARAH_KNOWLEDGE,
      ),
    ).toBe(true);
    expect(
      isLevelTwoAnswerCorrect('CARD_LAST_FOUR', '4821', SARAH_KNOWLEDGE),
    ).toBe(true);
    expect(
      isLevelTwoAnswerCorrect('LOAN_REPAYMENT_AMOUNT', '1745', SARAH_KNOWLEDGE),
    ).toBe(false);
  });
});
