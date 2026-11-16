const CURRENCY_FORMATTER = new Intl.NumberFormat('en-AU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(amount: number): string {
  return `$${CURRENCY_FORMATTER.format(Math.abs(amount))}`;
}
