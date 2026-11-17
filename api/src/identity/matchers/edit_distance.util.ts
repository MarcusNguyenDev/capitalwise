// Levenshtein distance: the number of single-letter edits between two words.
export function measureEditDistance(first: string, second: string): number {
  const previous_row = Array.from(
    { length: second.length + 1 },
    (_unused, index) => index,
  );
  for (let first_index = 1; first_index <= first.length; first_index += 1) {
    let diagonal = previous_row[0];
    previous_row[0] = first_index;
    for (
      let second_index = 1;
      second_index <= second.length;
      second_index += 1
    ) {
      const above = previous_row[second_index];
      const substitution_cost =
        first[first_index - 1] === second[second_index - 1] ? 0 : 1;
      previous_row[second_index] = Math.min(
        above + 1,
        previous_row[second_index - 1] + 1,
        diagonal + substitution_cost,
      );
      diagonal = above;
    }
  }
  return previous_row[second.length];
}
