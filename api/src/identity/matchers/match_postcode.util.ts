import { extractSpokenDigits } from './spoken_number.util';

// Digits only and exact: "4220", "4 2 2 0" and "four two two oh" all match
// 4220; anything with more or fewer digits does not.
export function isPostcodeMatch(
  spoken_text: string,
  expected_postcode: string,
): boolean {
  return extractSpokenDigits(spoken_text) === expected_postcode;
}

// Cards: "the last four are 4821" / "four eight two one".
export function isCardLastFourMatch(
  spoken_text: string,
  card_last_fours: string[],
): boolean {
  const spoken_digits = extractSpokenDigits(spoken_text);
  return spoken_digits.length === 4 && card_last_fours.includes(spoken_digits);
}
