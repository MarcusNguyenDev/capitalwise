import { parseSpokenAmount } from './spoken_number.util';

export interface AmountTolerance {
  // 0.1 = within 10% of the expected amount.
  ratio: number;
  // Also accepted when within this many dollars, whichever is more forgiving.
  absolute: number;
}

export function isAmountMatch(
  spoken_text: string,
  expected_amount: number,
  tolerance: AmountTolerance,
): boolean {
  const spoken_amount = parseSpokenAmount(spoken_text);
  if (spoken_amount === null || spoken_amount <= 0) {
    return false;
  }
  const allowed_difference = Math.max(
    Math.abs(expected_amount) * tolerance.ratio,
    tolerance.absolute,
  );
  return (
    Math.abs(spoken_amount - Math.abs(expected_amount)) <= allowed_difference
  );
}
