/** The customer's statement followed by any quoted lines, without repeats (a flagged quote is often the statement itself). */
export function listCustomerQuotes(statement: string | null | undefined, quotes: string[] | null | undefined): string[] {
  const all_quotes = [statement, ...(quotes ?? [])].filter((quote): quote is string => Boolean(quote?.trim()));
  return [...new Set(all_quotes)];
}
