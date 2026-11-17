import { readSpokenNumbers } from './read_spoken_numbers.util';

describe('readSpokenNumbers', () => {
  it.each([
    ['about seven hundred and ninety dollars', '790'],
    ['eleven hundred and forty-four dollars and forty cents', '1144'],
    ['the twelfth of May nineteen forty-two', '1942'],
    ['the twelfth of May nineteen forty-two', '12'],
    ['my postcode is four two two five', '4225'],
    ['forty-two twenty-five', '4225'],
    ['three thousand four hundred and twelve', '3412'],
    ['Four double two one.', '4221'],
    ['four two double oh', '4200'],
    ['triple three nine', '3339'],
  ])('reads "%s" as including %s', (spoken_text, expected_number) => {
    expect(readSpokenNumbers(spoken_text)).toContain(expected_number);
  });
});
