import { isAmountMatch } from './match_amount.util';
import { isFullNameMatch } from './match_full_name.util';
import { isMerchantMatch } from './match_merchant.util';
import { isCardLastFourMatch, isPostcodeMatch } from './match_postcode.util';
import { isUnanswered } from './normalise_spoken_text.util';
import {
  isDateOfBirthMatch,
  parseDateOfBirth,
} from './parse_date_of_birth.util';
import { parseSpokenAmount } from './spoken_number.util';

const CLOCK = { current_year: 2026 };
const SARAH = { first_name: 'Sarah', last_name: 'Mitchell' };

describe('isFullNameMatch', () => {
  it.each([
    'Sarah Mitchell',
    'sarah mitchell',
    '  SARAH   MITCHELL ',
    'Sarah Jane Mitchell',
    "It's Sarah Mitchell.",
    'My name is Sarah Mitchell',
    'Mrs Sarah Mitchell',
    'Sarah Mitchell speaking',
  ])('accepts "%s"', (spoken_name) => {
    expect(isFullNameMatch(spoken_name, SARAH)).toBe(true);
  });

  it.each([
    'Sarah',
    'Mitchell',
    'Sara Mitchell',
    'Sarah Mitchel',
    'Mitchell Sarah',
    'Sarah Mitchell-Jones',
    'Emma Barker',
    '',
  ])('rejects "%s"', (spoken_name) => {
    expect(isFullNameMatch(spoken_name, SARAH)).toBe(false);
  });

  it('ignores apostrophes, hyphens and accents', () => {
    expect(
      isFullNameMatch('Sean OBrien', {
        first_name: 'Seán',
        last_name: "O'Brien",
      }),
    ).toBe(true);
    expect(
      isFullNameMatch('Ana Smith Jones', {
        first_name: 'Ana',
        last_name: 'Smith-Jones',
      }),
    ).toBe(true);
    expect(
      isFullNameMatch('Grace Papadopoulos', {
        first_name: 'Grace',
        last_name: 'Papadopoulos',
      }),
    ).toBe(true);
  });

  it('does not accept a nickname', () => {
    expect(
      isFullNameMatch('Thomas Barker', {
        first_name: 'Tom',
        last_name: 'Barker',
      }),
    ).toBe(false);
  });
});

describe('parseDateOfBirth (Australian D/M/Y)', () => {
  it.each([
    ['1948-03-03', '1948-03-03'],
    ['03/03/1948', '1948-03-03'],
    ['3/3/48', '1948-03-03'],
    ['3.3.1948', '1948-03-03'],
    ['3rd of March 1948', '1948-03-03'],
    ['the 3rd of March, 1948', '1948-03-03'],
    ['3 March 1948', '1948-03-03'],
    ['March 3rd, 1948', '1948-03-03'],
    ['March 3 1948', '1948-03-03'],
    ['the third of March nineteen forty-eight', '1948-03-03'],
    ['March the third nineteen forty eight', '1948-03-03'],
    ['14/09/1992', '1992-09-14'],
    ['fourteenth of September ninety two', '1992-09-14'],
    ['21st June 85', '1985-06-21'],
    ['twenty first of June nineteen eighty five', '1985-06-21'],
    ['30th April 2002', '2002-04-30'],
    ['thirtieth of April two thousand and two', '2002-04-30'],
    ['30 April twenty oh two', '2002-04-30'],
    ['12 Sept 1942', '1942-09-12'],
    // Speech-to-text misheard "My date of birth is"; the date itself is right.
    ['My  world is 19th of July 1990', '1990-07-19'],
  ])('reads "%s" as %s', (spoken_date, iso_date) => {
    expect(parseDateOfBirth(spoken_date, CLOCK)).toBe(iso_date);
  });

  it('reads numeric dates day first, never month first', () => {
    expect(parseDateOfBirth('04/05/1990', CLOCK)).toBe('1990-05-04');
    expect(parseDateOfBirth('12/30/1990', CLOCK)).toBeNull();
  });

  it.each(['31 February 1990', 'sometime in 1990', "I don't know", ''])(
    'returns null for "%s"',
    (spoken_date) => {
      expect(parseDateOfBirth(spoken_date, CLOCK)).toBeNull();
    },
  );

  it('matches exactly on the day', () => {
    expect(isDateOfBirthMatch('3rd of March 1948', '1948-03-03', CLOCK)).toBe(
      true,
    );
    expect(isDateOfBirthMatch('4th of March 1948', '1948-03-03', CLOCK)).toBe(
      false,
    );
  });
});

describe('isPostcodeMatch and isCardLastFourMatch (digits only)', () => {
  it.each([
    '4220',
    '4 2 2 0',
    'four two two oh',
    "It's 4220.",
    'four 2 2 zero',
  ])('accepts "%s" for 4220', (spoken_postcode) => {
    expect(isPostcodeMatch(spoken_postcode, '4220')).toBe(true);
  });

  it.each(['4221', '422', '42200', 'Burleigh Heads', ''])(
    'rejects "%s" for 4220',
    (spoken_postcode) => {
      expect(isPostcodeMatch(spoken_postcode, '4220')).toBe(false);
    },
  );

  it.each([
    ['Four double two one.', '4221'],
    ['four double 2 one', '4221'],
    ['4 double 2 1', '4221'],
    ['four two double oh', '4200'],
    ['triple four one', '4441'],
  ])('reads repeated digits in "%s" as %s', (spoken_postcode, postcode) => {
    expect(isPostcodeMatch(spoken_postcode, postcode)).toBe(true);
  });

  it('matches the last four digits of any card the customer holds', () => {
    expect(isCardLastFourMatch('six one four two', ['3390', '6142'])).toBe(
      true,
    );
    expect(
      isCardLastFourMatch('the last four are 3390', ['3390', '6142']),
    ).toBe(true);
    expect(isCardLastFourMatch('double three nine oh', ['3390', '6142'])).toBe(
      true,
    );
    expect(isCardLastFourMatch('1234', ['3390', '6142'])).toBe(false);
  });
});

describe('parseSpokenAmount and isAmountMatch', () => {
  it.each([
    ['$3,180.00', 3180],
    ['3180', 3180],
    ['about 3.2k', 3200],
    ['three thousand one hundred and eighty dollars', 3180],
    ['eleven hundred and forty', 1140],
    ['eleven forty four', 1144],
    ['seven hundred and ninety three dollars sixty', 793.6],
    ['a hundred and fifty bucks', 150],
    ['roughly two grand', 2000],
  ])('reads "%s" as %s', (spoken_amount, amount) => {
    expect(parseSpokenAmount(spoken_amount)).toBeCloseTo(amount, 2);
  });

  it('returns null when no amount was said', () => {
    expect(parseSpokenAmount("I'm not sure")).toBeNull();
  });

  const income_tolerance = { ratio: 0.1, absolute: 50 };

  it('accepts within 10% of the expected amount', () => {
    expect(isAmountMatch('about three thousand', 3180, income_tolerance)).toBe(
      true,
    );
    expect(isAmountMatch('3490', 3180, income_tolerance)).toBe(true);
    expect(isAmountMatch('3500', 3180, income_tolerance)).toBe(false);
    expect(isAmountMatch('2850', 3180, income_tolerance)).toBe(false);
  });

  it('accepts within $50 when that is more forgiving than 10%', () => {
    expect(isAmountMatch('three hundred', 340, income_tolerance)).toBe(true);
    expect(isAmountMatch('280', 340, income_tolerance)).toBe(false);
  });

  it('loan repayments are within 10% only', () => {
    const loan_tolerance = { ratio: 0.1, absolute: 0 };
    expect(isAmountMatch('about 1700', 1745, loan_tolerance)).toBe(true);
    expect(isAmountMatch('1500', 1745, loan_tolerance)).toBe(false);
  });
});

describe('isMerchantMatch (fuzzy)', () => {
  const sarah_merchants = [
    'Bean There Cafe',
    'Harvest Lane Foods',
    'Pulse Gym Cafe',
    'Reelhouse',
    'The Daily Grind',
  ];

  it.each([
    'Pulse Gym Cafe',
    'the pulse gym',
    'Pulse',
    'pulse gim cafe',
    'Harvest Lane',
    'harvest',
    'the daily grind',
    'reel house',
    'Reelhous',
    'Bean There',
  ])('accepts "%s"', (spoken_merchant) => {
    expect(isMerchantMatch(spoken_merchant, sarah_merchants)).toBe(true);
  });

  it.each(['the gym', 'a cafe', 'Coles', 'Northshore Electronics', ''])(
    'rejects "%s"',
    (spoken_merchant) => {
      expect(isMerchantMatch(spoken_merchant, sarah_merchants)).toBe(false);
    },
  );
});

describe('isUnanswered', () => {
  it.each([
    '',
    '   ',
    "I don't know",
    'not sure',
    "can't remember",
    'No idea.',
  ])('treats "%s" as not answered', (spoken_answer) => {
    expect(isUnanswered(spoken_answer)).toBe(true);
  });

  it('treats a real answer as answered', () => {
    expect(isUnanswered('about three thousand')).toBe(false);
  });
});
