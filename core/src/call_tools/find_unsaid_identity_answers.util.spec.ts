import {
  findNonAnswers,
  findUnsaidIdentityAnswers,
} from './find_unsaid_identity_answers.util';

describe('findUnsaidIdentityAnswers', () => {
  const caller_lines = [
    "Hello dear, it's Dorothy Evans speaking.",
    'My date of birth is the 12th of May 1942, and my postcode is 4225.',
    'My pension was $1,144.40.',
  ];

  it('accepts answers the caller said, including paraphrased dates and amounts', () => {
    expect(
      findUnsaidIdentityAnswers(
        [
          { question_id: 'Q1', answer: 'Dorothy Evans' },
          { question_id: 'Q2', answer: '12 May 1942' },
          { question_id: 'Q3', answer: '4225' },
          { question_id: 'Q4', answer: 'about 1144.40' },
        ],
        caller_lines,
      ),
    ).toEqual([]);
  });

  it('rejects a name the caller never said (a model hallucination seen on a real call)', () => {
    expect(
      findUnsaidIdentityAnswers(
        [
          { question_id: 'Q1', answer: 'Margaret Ellis' },
          { question_id: 'Q2', answer: 'the 12th of May 1942' },
        ],
        caller_lines,
      ),
    ).toEqual(['Q1']);
  });

  it('accepts digits for numbers the caller said in words', () => {
    expect(
      findUnsaidIdentityAnswers(
        [
          { question_id: 'Q1', answer: 'about $790' },
          { question_id: 'Q2', answer: '12/05/1942' },
          { question_id: 'Q3', answer: '4225' },
        ],
        [
          'The JobSeeker payment, about seven hundred and ninety dollars.',
          'The twelfth of May nineteen forty-two, and my postcode is four two two five.',
        ],
      ),
    ).toEqual([]);
  });

  it('rejects answers given before the caller has said anything', () => {
    expect(
      findUnsaidIdentityAnswers([{ question_id: 'Q3', answer: '4225' }], []),
    ).toEqual(['Q3']);
  });
});

describe('findNonAnswers', () => {
  it('flags replies that are not answers, and keeps real ones', () => {
    expect(
      findNonAnswers([
        { question_id: 'Q1', answer: "Yes, that's right, dear." },
        { question_id: 'Q2', answer: 'Thank you.' },
        { question_id: 'Q3', answer: 'Pulse Gym Cafe' },
        { question_id: 'Q4', answer: 'about 790' },
      ]),
    ).toEqual(['Q1', 'Q2']);
  });
});
